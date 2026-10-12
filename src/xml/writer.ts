import { XmlSchemaError } from '../common/errors.ts';
import { NAMESPACES } from './generated/schema.ts';
import type { RawXml } from './raw-xml.ts';
import { assertWire, elementType, typeDef } from './schema-walk.ts';
import type { Particle, SchemaKey } from './schema-types.ts';

/**
 * Serializador XML genérico dirigido por los metadatos del XSD (`src/xml/generated/schema.ts`):
 * el orden de los elementos y la cardinalidad salen del esquema, no del código.
 *
 * La salida es compacta (sin espacios entre elementos), en UTF-8 y con los namespaces declarados
 * en el elemento raíz.
 */

/** Prefijos que usa la librería. Coinciden con los de la documentación y los ejemplos de la AEAT. */
export const DEFAULT_PREFIXES: Readonly<Record<SchemaKey | 'ds', string>> = {
  sfLR: 'sum',
  sf: 'sum1',
  sfLRC: 'con',
  sfR: 'tikR',
  sfLRRC: 'tikLRRC',
  sfEv: 'sf',
  sfVNV: 'tikVNV',
  ds: 'ds',
};

/** Escapa texto para el contenido de un elemento XML. */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#xD;');
}

/** Escapa texto para el valor de un atributo XML entre comillas dobles. */
export function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;');
}

export interface WriteOptions {
  /** Validar el objeto contra el esquema antes de serializarlo. Por defecto, `true`. */
  readonly validate?: boolean;
  /** Prefijos alternativos por namespace. */
  readonly prefixes?: Partial<Record<SchemaKey | 'ds', string>>;
}

/**
 * Serializa un elemento global del esquema (`sf:RegistroAlta`, `sfLR:RegFactuSistemaFacturacion`…).
 *
 * @throws XmlSchemaError si el objeto no se ajusta al esquema.
 */
export function writeElement(
  element: `${SchemaKey}:${string}`,
  value: unknown,
  options: WriteOptions = {},
): string {
  const type = elementType(element);
  const [ns, name] = element.split(':') as [SchemaKey, string];
  if (options.validate ?? true) assertWire(type, value, name);
  const prefixes = { ...DEFAULT_PREFIXES, ...options.prefixes };
  const used = new Set<SchemaKey | 'ds'>();
  const body = new Writer(prefixes, used).element(name, ns, type, value);
  // Declara los namespaces usados en el elemento raíz.
  const decls = [...used]
    .filter((k) => k !== 'ds')
    .map((k) => ` xmlns:${prefixes[k]}="${escapeAttribute(NAMESPACES[k])}"`)
    .join('');
  const open = `<${prefixes[ns]}:${name}`;
  return open + decls + body.slice(open.length);
}

class Writer {
  private readonly prefixes: Readonly<Record<SchemaKey | 'ds', string>>;
  private readonly used: Set<SchemaKey | 'ds'>;

  constructor(prefixes: Readonly<Record<SchemaKey | 'ds', string>>, used: Set<SchemaKey | 'ds'>) {
    this.prefixes = prefixes;
    this.used = used;
  }

  element(name: string, ns: SchemaKey | 'ds', type: string, value: unknown): string {
    if (type === 'ds:Signature') return (value as RawXml).raw;
    this.used.add(ns);
    const tag = `${this.prefixes[ns]}:${name}`;
    const def = typeDef(type);
    if (def?.kind !== 'complex') {
      if (typeof value !== 'string')
        throw new XmlSchemaError(name, 'se esperaba un valor de texto');
      return `<${tag}>${escapeText(value)}</${tag}>`;
    }
    return `<${tag}>${this.particles(def.content, value as Record<string, unknown>)}</${tag}>`;
  }

  private particles(particles: readonly Particle[], obj: Record<string, unknown>): string {
    let out = '';
    for (const p of particles) {
      if (p.kind === 'element') {
        const v = obj[p.name];
        if (v === undefined) continue;
        const items = p.max > 1 ? (v as unknown[]) : [v];
        for (const item of items) out += this.element(p.name, p.ns, p.type, item);
      } else {
        for (const opt of p.options) out += this.particles(opt, obj);
      }
    }
    return out;
  }
}
