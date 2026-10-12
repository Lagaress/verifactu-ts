import { XmlParseError, XmlSchemaError } from '../common/errors.ts';
import { NAMESPACES } from './generated/schema.ts';
import { typeDef } from './schema-walk.ts';
import type { Particle, SchemaKey } from './schema-types.ts';

/**
 * Lector XML mínimo y endurecido, sin dependencias.
 *
 * Admite lo necesario para leer respuestas SOAP y registros de la AEAT: elementos, atributos,
 * namespaces, texto, CDATA, comentarios y la declaración XML. **Rechaza** `<!DOCTYPE>` y cualquier
 * entidad que no sea una de las 5 predefinidas o una referencia numérica, lo que elimina por
 * construcción los ataques de entidades (XXE, «billion laughs»).
 */

/** Nodo de elemento del árbol leído. */
export interface XmlElement {
  /** Nombre tal como aparece (con prefijo). */
  readonly qname: string;
  /** Nombre local. */
  readonly local: string;
  /** URI del namespace (cadena vacía si no tiene). */
  readonly ns: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: readonly XmlElement[];
  /** Texto directo del elemento (concatenado, sin el de los hijos). */
  readonly text: string;
  /** Posición del elemento en la entrada. */
  readonly start: number;
  /** Posición siguiente al cierre del elemento en la entrada. */
  readonly end: number;
}

const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const NAME_RE = /^[A-Za-z_À-￯][\w.\-·À-￯]*(?::[A-Za-z_À-￯][\w.\-·À-￯]*)?$/;
const PREDEFINED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Límites de seguridad del lector. */
export interface ParseLimits {
  /** Tamaño máximo de la entrada en caracteres. Por defecto, 50 MB. */
  readonly maxLength?: number;
  /** Profundidad máxima de anidamiento. Por defecto, 64. */
  readonly maxDepth?: number;
}

interface MutableElement {
  qname: string;
  local: string;
  ns: string;
  attributes: Map<string, string>;
  children: MutableElement[];
  text: string;
  start: number;
  end: number;
  scope: Map<string, string>;
}

/**
 * Lee un documento XML y devuelve su elemento raíz.
 *
 * @throws XmlParseError si el XML no está bien formado o usa construcciones no admitidas.
 */
export function parseXml(input: string, limits: ParseLimits = {}): XmlElement {
  const maxLength = limits.maxLength ?? 50 * 1024 * 1024;
  const maxDepth = limits.maxDepth ?? 64;
  if (input.length > maxLength)
    throw new XmlParseError(`El XML supera el tamaño máximo (${maxLength} caracteres)`);

  let i = 0;
  if (input.charCodeAt(0) === 0xfeff) i = 1;
  const stack: MutableElement[] = [];
  let root: MutableElement | undefined;
  const rootScope = new Map<string, string>([['xml', XML_NS]]);

  const fail = (msg: string, at: number = i): never => {
    throw new XmlParseError(msg, at);
  };

  const decode = (raw: string, at: number): string =>
    raw.replace(/&([^;&]*);?/g, (match, ref: string) => {
      if (!match.endsWith(';')) fail('Carácter «&» sin escapar', at);
      if (ref.startsWith('#x') || ref.startsWith('#X'))
        return codePoint(Number.parseInt(ref.slice(2), 16), at);
      if (ref.startsWith('#')) return codePoint(Number.parseInt(ref.slice(1), 10), at);
      const v = PREDEFINED[ref];
      if (v === undefined) fail(`Entidad no admitida: &${ref};`, at);
      return v ?? '';
    });

  const codePoint = (cp: number, at: number): string => {
    const valid =
      Number.isInteger(cp) &&
      (cp === 0x9 ||
        cp === 0xa ||
        cp === 0xd ||
        (cp >= 0x20 && cp <= 0xd7ff) ||
        (cp >= 0xe000 && cp <= 0xfffd) ||
        (cp >= 0x10000 && cp <= 0x10ffff));
    if (!valid) fail('Referencia a un carácter no válido en XML', at);
    return String.fromCodePoint(cp);
  };

  const appendText = (text: string, at: number): void => {
    const current = stack[stack.length - 1];
    if (current) current.text += text;
    else if (text.trim() !== '') fail('Texto fuera del elemento raíz', at);
  };

  while (i < input.length) {
    const lt = input.indexOf('<', i);
    if (lt === -1) {
      appendText(decode(input.slice(i), i), i);
      break;
    }
    if (lt > i) {
      const raw = input.slice(i, lt);
      if (raw.includes(']]>')) fail('Secuencia «]]>» no permitida en el texto', i);
      appendText(decode(raw, i), i);
    }
    i = lt;

    if (input.startsWith('<?', i)) {
      const end = input.indexOf('?>', i);
      if (end === -1) fail('Instrucción de procesamiento sin cerrar');
      const target = /^<\?([^\s?]+)/.exec(input.slice(i, end))?.[1] ?? '';
      if (
        target.toLowerCase() === 'xml' &&
        i !== 0 &&
        !(i === 1 && input.charCodeAt(0) === 0xfeff)
      ) {
        fail('La declaración XML solo puede aparecer al principio');
      }
      i = end + 2;
    } else if (input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4);
      if (end === -1) fail('Comentario sin cerrar');
      i = end + 3;
    } else if (input.startsWith('<![CDATA[', i)) {
      const end = input.indexOf(']]>', i + 9);
      if (end === -1) fail('Sección CDATA sin cerrar');
      if (stack.length === 0) fail('CDATA fuera del elemento raíz');
      appendText(input.slice(i + 9, end), i);
      i = end + 3;
    } else if (input.startsWith('<!', i)) {
      fail('Declaraciones DOCTYPE/ENTITY no admitidas');
    } else if (input.startsWith('</', i)) {
      const end = input.indexOf('>', i);
      if (end === -1) fail('Etiqueta de cierre sin terminar');
      const name = input.slice(i + 2, end).trim();
      const current = stack.pop();
      if (current?.qname !== name) return fail(`Etiqueta de cierre inesperada </${name}>`);
      i = end + 1;
      current.end = i;
    } else {
      const start = i;
      const { name, attrs, selfClosing, next } = readTag(input, i, fail);
      i = next;
      if (stack.length === 0 && root) fail('Hay más de un elemento raíz', start);
      if (stack.length >= maxDepth) fail(`Se supera la profundidad máxima (${maxDepth})`, start);

      const parentScope = stack[stack.length - 1]?.scope ?? rootScope;
      const scope = new Map(parentScope);
      const attributes = new Map<string, string>();
      for (const [k, v] of attrs) {
        const value = decode(v, start);
        if (k === 'xmlns') scope.set('', value);
        else if (k.startsWith('xmlns:')) scope.set(k.slice(6), value);
        else {
          if (attributes.has(k)) fail(`Atributo duplicado: ${k}`, start);
          attributes.set(k, value);
        }
      }
      const colon = name.indexOf(':');
      const prefix = colon === -1 ? '' : name.slice(0, colon);
      const ns = scope.get(prefix);
      if (prefix && ns === undefined) fail(`Prefijo de namespace no declarado: ${prefix}`, start);

      const el: MutableElement = {
        qname: name,
        local: colon === -1 ? name : name.slice(colon + 1),
        ns: ns ?? '',
        attributes,
        children: [],
        text: '',
        start,
        end: i,
        scope,
      };
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(el);
      else root = el;
      if (!selfClosing) stack.push(el);
    }
  }

  if (stack.length > 0) fail(`Elemento sin cerrar: <${stack[stack.length - 1]?.qname ?? ''}>`);
  if (!root) fail('El documento no contiene ningún elemento');
  return root as XmlElement;
}

function readTag(
  input: string,
  start: number,
  fail: (msg: string, at?: number) => never,
): { name: string; attrs: [string, string][]; selfClosing: boolean; next: number } {
  let i = start + 1;
  const nameMatch = /^[^\s/>]+/.exec(input.slice(i, i + 256));
  const name = nameMatch?.[0] ?? '';
  if (!NAME_RE.test(name)) fail(`Nombre de elemento no válido: ${JSON.stringify(name)}`, start);
  i += name.length;
  const attrs: [string, string][] = [];
  for (;;) {
    while (i < input.length && /\s/.test(input.charAt(i))) i++;
    const ch = input.charAt(i);
    if (ch === '>') return { name, attrs, selfClosing: false, next: i + 1 };
    if (ch === '/' && input.charAt(i + 1) === '>')
      return { name, attrs, selfClosing: true, next: i + 2 };
    if (ch === '') fail('Etiqueta sin terminar', start);
    const m = /^([^\s=/>]+)\s*=\s*(["'])/.exec(input.slice(i, i + 512));
    if (!m) return fail('Atributo mal formado', i);
    const [whole, attrName = '', quote = '"'] = m;
    if (!NAME_RE.test(attrName)) fail(`Nombre de atributo no válido: ${attrName}`, i);
    const valueStart = i + whole.length;
    const valueEnd = input.indexOf(quote, valueStart);
    if (valueEnd === -1) fail('Valor de atributo sin cerrar', i);
    const value = input.slice(valueStart, valueEnd);
    if (value.includes('<')) fail('Carácter «<» no permitido en un atributo', i);
    attrs.push([attrName, value]);
    i = valueEnd + 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Deserialización guiada por el esquema

const NS_TO_KEY = new Map<string, SchemaKey | 'ds'>(
  Object.entries(NAMESPACES).map(([k, v]) => [v, k as SchemaKey | 'ds']),
);

export interface ReadOptions {
  /**
   * Qué hacer con elementos que el esquema no contempla: `error` (por defecto) o `ignore`
   * (útil para respuestas, por si la AEAT añade campos nuevos).
   */
  readonly unknownElements?: 'error' | 'ignore';
}

/**
 * Convierte un elemento leído en un objeto «de cable» según un tipo del esquema. Los elementos
 * repetibles se devuelven como listas y los simples como cadenas. `ds:Signature` se conserva como
 * fragmento XML opaco ({@link RawXml}) extraído de `source`.
 */
export function readWire(
  type: string,
  el: XmlElement,
  source: string,
  options: ReadOptions = {},
  path = el.local,
): unknown {
  const def = typeDef(type);
  if (type === 'ds:Signature') return { raw: source.slice(el.start, el.end) };
  if (def?.kind !== 'complex') {
    if (el.children.length > 0) throw new XmlSchemaError(path, 'se esperaba un valor de texto');
    return el.text;
  }
  const out: Record<string, unknown> = {};
  const index = buildIndex(def.content);
  for (const child of el.children) {
    const key = NS_TO_KEY.get(child.ns);
    const particle = index.get(child.local);
    if (!particle || particle.ns !== key) {
      if (options.unknownElements === 'ignore') continue;
      throw new XmlSchemaError(`${path}/${child.local}`, 'elemento no admitido por el esquema');
    }
    const value = readWire(particle.type, child, source, options, `${path}/${child.local}`);
    if (particle.max > 1) {
      const list = (out[child.local] ??= []) as unknown[];
      list.push(value);
    } else {
      if (child.local in out)
        throw new XmlSchemaError(`${path}/${child.local}`, 'elemento repetido');
      out[child.local] = value;
    }
  }
  return out;
}

function buildIndex(
  particles: readonly Particle[],
  into = new Map<string, { ns: SchemaKey | 'ds'; type: string; max: number }>(),
) {
  for (const p of particles) {
    if (p.kind === 'element') into.set(p.name, { ns: p.ns, type: p.type, max: p.max });
    else for (const opt of p.options) buildIndex(opt, into);
  }
  return into;
}

/** Busca el primer hijo con un namespace y nombre local dados. */
export function childElement(el: XmlElement, ns: string, local: string): XmlElement | undefined {
  return el.children.find((c) => c.ns === ns && c.local === local);
}
