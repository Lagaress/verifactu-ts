/**
 * Genera, a partir de los XSD oficiales de la AEAT (spec/current), los «tipos de cable»:
 *
 *  - src/xml/generated/schema.ts  → metadatos en runtime: orden de elementos, cardinalidad,
 *                                   namespaces y facetas (enumeraciones, patrones, longitudes).
 *  - src/xml/generated/<clave>.ts → tipos TypeScript que reflejan la estructura XML exacta.
 *
 * El serializador, el lector y el validador estructural se apoyan en estos metadatos, así que el
 * orden de los elementos nunca se escribe a mano. La salida se versiona y un test comprueba que
 * regenerarla no produce cambios.
 *
 *   node --experimental-strip-types scripts/gen-wire-types.ts [--check]
 */
import { DOMParser, type Element } from '@xmldom/xmldom';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const XS = 'http://www.w3.org/2001/XMLSchema';
const DS = 'http://www.w3.org/2000/09/xmldsig#';
const OUT = join(ROOT, 'src/xml/generated');
const BASE_NS =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/';

/** Clave estable de cada esquema. Se usa en el registro y como prefijo XML por defecto. */
const SCHEMAS = [
  { key: 'sf', file: 'SuministroInformacion.xsd', module: 'suministro-informacion' },
  { key: 'sfLR', file: 'SuministroLR.xsd', module: 'suministro-lr' },
  { key: 'sfR', file: 'RespuestaSuministro.xsd', module: 'respuesta-suministro' },
  { key: 'sfLRC', file: 'ConsultaLR.xsd', module: 'consulta-lr' },
  { key: 'sfLRRC', file: 'RespuestaConsultaLR.xsd', module: 'respuesta-consulta-lr' },
  { key: 'sfEv', file: 'EventosSIF.xsd', module: 'eventos-sif' },
  {
    key: 'sfVNV',
    file: 'RespuestaValRegistNoVeriFactu.xsd',
    module: 'respuesta-val-regist-no-verifactu',
  },
] as const;
type SchemaKey = (typeof SCHEMAS)[number]['key'];

const NS_TO_KEY = new Map<string, SchemaKey | 'ds'>([
  ...SCHEMAS.map((s) => [BASE_NS + s.file, s.key] as [string, SchemaKey]),
  [DS, 'ds'],
]);

// ---------------------------------------------------------------------------------------------
// Modelo intermedio

interface ElementParticle {
  kind: 'element';
  name: string;
  /** Clave del namespace del elemento (el del esquema que lo declara, o el del `ref`). */
  ns: SchemaKey | 'ds';
  /** Referencia de tipo `clave:Nombre`, `xs:<builtin>` o `ds:Signature`. */
  type: string;
  min: number;
  max: number;
  doc?: string;
}
interface ChoiceParticle {
  kind: 'choice';
  options: Particle[][];
  min: number;
  max: number;
}
type Particle = ElementParticle | ChoiceParticle;

interface ComplexType {
  kind: 'complex';
  content: Particle[];
  doc?: string;
}
interface SimpleType {
  kind: 'simple';
  base: string;
  enumeration?: { value: string; doc?: string }[];
  pattern?: string[];
  length?: number;
  minLength?: number;
  maxLength?: number;
  doc?: string;
}
type TypeDef = ComplexType | SimpleType;

interface SchemaModel {
  key: SchemaKey;
  ns: string;
  module: string;
  types: Map<string, TypeDef>;
  elements: Map<string, string>;
}

// ---------------------------------------------------------------------------------------------
// Lectura de los XSD

const children = (el: Element, local?: string): Element[] => {
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).namespaceURI === XS) {
      const e = n as Element;
      if (!local || e.localName === local) out.push(e);
    }
  }
  return out;
};
const child = (el: Element, local: string): Element | undefined => children(el, local)[0];

function docOf(el: Element): string | undefined {
  const ann = child(el, 'annotation');
  const doc = ann && child(ann, 'documentation');
  const text = doc?.textContent?.replace(/\s+/g, ' ').trim();
  return text === undefined || text === '' ? undefined : text;
}

function occurs(el: Element): { min: number; max: number } {
  const min = el.getAttribute('minOccurs');
  const max = el.getAttribute('maxOccurs');
  return {
    min: min === null || min === '' ? 1 : Number(min),
    max: max === null || max === '' ? 1 : max === 'unbounded' ? Infinity : Number(max),
  };
}

class Reader {
  readonly model: SchemaModel;
  private readonly root: Element;
  constructor(root: Element, key: SchemaKey, module: string) {
    this.root = root;
    const ns = root.getAttribute('targetNamespace') ?? '';
    if (NS_TO_KEY.get(ns) !== key) throw new Error(`Namespace inesperado en ${key}: ${ns}`);
    this.model = { key, ns, module, types: new Map(), elements: new Map() };
  }

  /** Resuelve un QName del XSD (`sf:Foo`, `string`) a `clave:Foo` / `xs:string`. */
  private qname(ctx: Element, qn: string): string {
    const [prefix, local] = qn.includes(':') ? qn.split(':') : ['', qn];
    const uri = prefix
      ? ctx.lookupNamespaceURI(prefix)
      : (ctx.lookupNamespaceURI(null) ?? this.root.getAttribute('xmlns'));
    if (uri === XS) return `xs:${local}`;
    const key = uri ? NS_TO_KEY.get(uri) : undefined;
    if (!key) throw new Error(`No se puede resolver el QName ${qn} (namespace ${uri ?? '—'})`);
    return `${key}:${local}`;
  }

  read(): SchemaModel {
    for (const el of children(this.root)) {
      const name = el.getAttribute('name') ?? '';
      switch (el.localName ?? '') {
        case 'complexType':
          this.model.types.set(name, this.complex(el, name));
          break;
        case 'simpleType':
          this.model.types.set(name, this.simple(el));
          break;
        case 'element': {
          const type = el.getAttribute('type');
          if (type) {
            this.model.elements.set(name, this.qname(el, type));
          } else {
            const anon = child(el, 'complexType');
            if (!anon) throw new Error(`Elemento global ${name} sin tipo`);
            const typeName = `${name}Type`;
            if (this.model.types.has(typeName)) throw new Error(`Colisión de nombre ${typeName}`);
            this.model.types.set(typeName, this.complex(anon, typeName));
            this.model.elements.set(name, `${this.model.key}:${typeName}`);
          }
          break;
        }
        case 'import':
        case 'annotation':
          break;
        default:
          throw new Error(`Construcción XSD no soportada a nivel global: ${el.localName}`);
      }
    }
    return this.model;
  }

  private complex(el: Element, name: string): ComplexType {
    const doc = docOf(el);
    const cc = child(el, 'complexContent');
    if (cc) {
      const ext = child(cc, 'extension');
      if (!ext) throw new Error(`${name}: complexContent sin extension`);
      const base = this.qname(ext, ext.getAttribute('base') ?? '');
      const own = this.groupContent(ext, name);
      // La extensión se resuelve más tarde (puede referirse a un tipo aún no leído).
      return {
        kind: 'complex',
        content: [
          { kind: 'element', name: '__extends__', ns: this.model.key, type: base, min: 1, max: 1 },
          ...own,
        ],
        ...(doc && { doc }),
      };
    }
    for (const c of children(el)) {
      if (!['sequence', 'choice', 'annotation'].includes(c.localName ?? '')) {
        throw new Error(`${name}: construcción no soportada en complexType: ${c.localName}`);
      }
    }
    return { kind: 'complex', content: this.groupContent(el, name), ...(doc && { doc }) };
  }

  /** Contenido de un complexType/extension: una sequence o una choice. */
  private groupContent(el: Element, owner: string): Particle[] {
    const seq = child(el, 'sequence');
    const ch = child(el, 'choice');
    if (seq) return this.sequence(seq, owner);
    if (ch) return [this.choice(ch, owner)];
    return [];
  }

  private sequence(seq: Element, owner: string): Particle[] {
    const out: Particle[] = [];
    const { min, max } = occurs(seq);
    if (min !== 1 || max !== 1) throw new Error(`${owner}: sequence con cardinalidad no soportada`);
    for (const c of children(seq)) {
      if (c.localName === 'element') out.push(this.element(c, owner));
      else if (c.localName === 'choice') out.push(this.choice(c, owner));
      else if (c.localName === 'sequence') out.push(...this.sequence(c, owner));
      else if (c.localName !== 'annotation')
        throw new Error(`${owner}: ${c.localName} no soportado en sequence`);
    }
    return out;
  }

  private choice(ch: Element, owner: string): ChoiceParticle {
    const options: Particle[][] = [];
    for (const c of children(ch)) {
      if (c.localName === 'element') options.push([this.element(c, owner)]);
      else if (c.localName === 'sequence') options.push(this.sequence(c, owner));
      else if (c.localName !== 'annotation')
        throw new Error(`${owner}: ${c.localName} no soportado en choice`);
    }
    return { kind: 'choice', options, ...occurs(ch) };
  }

  private element(el: Element, owner: string): ElementParticle {
    const { min, max } = occurs(el);
    const doc = docOf(el);
    const ref = el.getAttribute('ref');
    if (ref) {
      const q = this.qname(el, ref);
      const [ns, local] = q.split(':') as [SchemaKey | 'ds', string];
      return {
        kind: 'element',
        name: local,
        ns,
        type: ns === 'ds' ? 'ds:Signature' : `@element:${q}`,
        min,
        max,
        ...(doc && { doc }),
      };
    }
    const name = el.getAttribute('name') ?? '';
    const type = el.getAttribute('type');
    let typeRef: string;
    if (type) {
      typeRef = this.qname(el, type);
    } else {
      const anonC = child(el, 'complexType');
      const anonS = child(el, 'simpleType');
      const typeName = `${owner}_${name}`;
      if (this.model.types.has(typeName)) throw new Error(`Colisión de nombre ${typeName}`);
      if (anonC) this.model.types.set(typeName, this.complex(anonC, typeName));
      else if (anonS) this.model.types.set(typeName, this.simple(anonS));
      else throw new Error(`${owner}.${name}: elemento sin tipo`);
      typeRef = `${this.model.key}:${typeName}`;
    }
    return {
      kind: 'element',
      name,
      ns: this.model.key,
      type: typeRef,
      min,
      max,
      ...(doc && { doc }),
    };
  }

  private simple(el: Element): SimpleType {
    const doc = docOf(el);
    const r = child(el, 'restriction');
    if (!r) throw new Error('simpleType sin restriction no soportado');
    const t: SimpleType = {
      kind: 'simple',
      base: this.qname(r, r.getAttribute('base') ?? ''),
      ...(doc && { doc }),
    };
    for (const f of children(r)) {
      const v = f.getAttribute('value') ?? '';
      switch (f.localName ?? '') {
        case 'enumeration': {
          const d = docOf(f);
          (t.enumeration ??= []).push({ value: v, ...(d && { doc: d }) });
          break;
        }
        case 'pattern':
          (t.pattern ??= []).push(v);
          break;
        case 'length':
          t.length = Number(v);
          break;
        case 'minLength':
          t.minLength = Number(v);
          break;
        case 'maxLength':
          t.maxLength = Number(v);
          break;
        case 'annotation':
          break;
        default:
          throw new Error(`Faceta no soportada: ${f.localName}`);
      }
    }
    return t;
  }
}

// ---------------------------------------------------------------------------------------------
// Resolución de referencias

function resolve(models: Map<SchemaKey, SchemaModel>): void {
  const lookupType = (ref: string): TypeDef => {
    const [key, name] = ref.split(':') as [SchemaKey, string];
    const t = models.get(key)?.types.get(name);
    if (!t) throw new Error(`Tipo no encontrado: ${ref}`);
    return t;
  };
  const fix = (particles: Particle[]): void => {
    for (const p of particles) {
      if (p.kind === 'choice') p.options.forEach(fix);
      else if (p.type.startsWith('@element:')) {
        const [key, name] = p.type.slice('@element:'.length).split(':') as [SchemaKey, string];
        const t = models.get(key)?.elements.get(name);
        if (!t) throw new Error(`Elemento global no encontrado: ${key}:${name}`);
        p.type = t;
      }
    }
  };
  for (const m of models.values()) {
    for (const t of m.types.values()) if (t.kind === 'complex') fix(t.content);
  }
  // Extensiones: se aplanan (contenido base + propio).
  const flatten = (t: ComplexType): void => {
    const first = t.content[0];
    if (first?.kind === 'element' && first.name === '__extends__') {
      const base = lookupType(first.type);
      if (base.kind !== 'complex') throw new Error('Extensión de tipo simple no soportada');
      flatten(base);
      t.content = [...base.content, ...t.content.slice(1)];
    }
  };
  for (const m of models.values())
    for (const t of m.types.values()) if (t.kind === 'complex') flatten(t);
}

// ---------------------------------------------------------------------------------------------
// Emisión

const HEADER = `// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar \`npm run gen:wire\`.
/* eslint-disable */
`;

const ident = (name: string): string => name.replace(/[^A-Za-z0-9_$]/g, '_');
const jsdoc = (doc: string | undefined, indent = ''): string =>
  doc ? `${indent}/** ${doc.replace(/\*\//g, '* /')} */\n` : '';

function tsTypeRef(ref: string, current: SchemaKey, imports: Map<SchemaKey, Set<string>>): string {
  if (ref.startsWith('xs:')) return 'string';
  if (ref === 'ds:Signature') return 'RawXml';
  const [key, name] = ref.split(':') as [SchemaKey, string];
  if (key !== current) {
    let set = imports.get(key);
    if (!set) imports.set(key, (set = new Set()));
    set.add(ident(name));
  }
  return ident(name);
}

function particleFields(
  ps: Particle[],
  cur: SchemaKey,
  imports: Map<SchemaKey, Set<string>>,
  indent: string,
): { fields: string; choices: string[] } {
  let fields = '';
  const choices: string[] = [];
  for (const p of ps) {
    if (p.kind === 'element') {
      const base = tsTypeRef(p.type, cur, imports);
      const t = p.max > 1 ? `readonly ${base}[]` : base;
      fields +=
        jsdoc(p.doc, indent) + `${indent}readonly ${p.name}${p.min === 0 ? '?' : ''}: ${t};\n`;
    } else {
      const allNames = p.options.flatMap(namesOf);
      const variants = p.options.map((opt) => {
        const inner = particleFields(opt, cur, imports, indent + '  ');
        const own = new Set(namesOf(opt));
        const never = allNames
          .filter((n) => !own.has(n))
          .map((n) => `${indent}  readonly ${n}?: never;\n`)
          .join('');
        const body = `{\n${inner.fields}${never}${indent}}`;
        return inner.choices.length ? `(${body} & ${inner.choices.join(' & ')})` : body;
      });
      if (p.max > 1) throw new Error('choice con maxOccurs > 1 no soportada');
      const union = variants.join(' | ');
      choices.push(
        p.min === 0
          ? `(${union} | { ${allNames.map((n) => `readonly ${n}?: never`).join('; ')} })`
          : `(${union})`,
      );
    }
  }
  return { fields, choices };
}

function namesOf(ps: Particle[]): string[] {
  return ps.flatMap((p) => (p.kind === 'element' ? [p.name] : p.options.flatMap(namesOf)));
}

function emitTypes(m: SchemaModel): string {
  const imports = new Map<SchemaKey, Set<string>>();
  let body = '';
  for (const [name, t] of m.types) {
    const id = ident(name);
    if (t.kind === 'simple') {
      if (t.enumeration) {
        body += jsdoc(t.doc);
        body += `export type ${id} =\n${t.enumeration.map((e) => `${e.doc ? `  /** ${e.doc.replace(/\*\//g, '* /')} */\n` : ''}  | ${JSON.stringify(e.value)}`).join('\n')};\n`;
        body += `export const ${id}_VALUES = [${t.enumeration.map((e) => JSON.stringify(e.value)).join(', ')}] as const;\n\n`;
      } else {
        body += jsdoc(t.doc) + `export type ${id} = string;\n\n`;
      }
    } else {
      const { fields, choices } = particleFields(t.content, m.key, imports, '  ');
      body += jsdoc(t.doc);
      body += choices.length
        ? `export type ${id} = ${fields ? `{\n${fields}} & ` : ''}${choices.join(' & ')};\n\n`
        : `export interface ${id} {\n${fields}}\n\n`;
    }
  }
  let head =
    HEADER + (body.includes('RawXml') ? `import type { RawXml } from '../raw-xml.ts';\n` : '');
  for (const [key, names] of [...imports].sort(([a], [b]) => a.localeCompare(b))) {
    const mod = SCHEMAS.find((s) => s.key === key)!.module;
    head += `import type { ${[...names].sort().join(', ')} } from './${mod}.ts';\n`;
  }
  return `${head}\n/** Namespace: ${m.ns} */\n\n${body}`;
}

function emitRegistry(models: Map<SchemaKey, SchemaModel>): string {
  const ser = (v: unknown): string =>
    JSON.stringify(v, (k: string, x: unknown): unknown =>
      k === 'doc' ? undefined : x === Infinity ? 'Infinity' : x,
    );
  let out = HEADER + `import type { SchemaRegistry } from '../schema-types.ts';\n\n`;
  out += `export const NAMESPACES = {\n${[...models.values()].map((m) => `  ${m.key}: ${JSON.stringify(m.ns)},`).join('\n')}\n  ds: ${JSON.stringify(DS)},\n} as const;\n\n`;
  out += `export const SCHEMA: SchemaRegistry = {\n  types: {\n`;
  for (const m of models.values()) {
    for (const [name, t] of m.types) {
      const clean =
        t.kind === 'simple' && t.enumeration
          ? { ...t, enumeration: t.enumeration.map((e) => e.value) }
          : t;
      out += `    ${JSON.stringify(`${m.key}:${name}`)}: ${ser(clean).replace(/"Infinity"/g, 'Infinity')},\n`;
    }
  }
  out += `  },\n  elements: {\n`;
  for (const m of models.values()) {
    for (const [name, type] of m.elements)
      out += `    ${JSON.stringify(`${m.key}:${name}`)}: ${JSON.stringify(type)},\n`;
  }
  out += `  },\n};\n`;
  return out;
}

// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const { id } = JSON.parse(await readFile(join(ROOT, 'spec/current.json'), 'utf8')) as {
    id: string;
  };
  const dir = join(ROOT, 'spec/aeat', id, 'xsd');
  const models = new Map<SchemaKey, SchemaModel>();
  for (const s of SCHEMAS) {
    const xml = await readFile(join(dir, s.file), 'utf8');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    models.set(
      s.key,
      new Reader(doc.documentElement as unknown as Element, s.key, s.module).read(),
    );
  }
  resolve(models);

  const outputs = new Map<string, string>();
  outputs.set('schema.ts', emitRegistry(models));
  for (const m of models.values()) outputs.set(`${m.module}.ts`, emitTypes(m));

  await mkdir(OUT, { recursive: true });
  let stale = false;
  for (const [file, content] of outputs) {
    const path = join(OUT, file);
    if (check) {
      const prev = await readFile(path, 'utf8').catch(() => '');
      if (prev !== content) {
        stale = true;
        console.error(`✗ ${file} no coincide con los XSD (ejecuta npm run gen:wire)`);
      }
    } else {
      await writeFile(path, content);
    }
  }
  if (check && stale) process.exitCode = 1;
  if (!check) console.log(`Generados ${outputs.size} ficheros desde spec/aeat/${id}.`);
}

await main();
