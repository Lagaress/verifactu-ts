import { XmlSchemaError } from '../common/errors.ts';
import type {
  ComplexTypeDef,
  ElementParticle,
  Particle,
  SchemaRegistry,
  SimpleTypeDef,
  TypeDef,
} from './schema-types.ts';

/** Busca la definición de un tipo `clave:Nombre`. Devuelve `undefined` para `xs:*` y `ds:Signature`. */
export function typeDef(s: SchemaRegistry, ref: string): TypeDef | undefined {
  if (ref.startsWith('xs:') || ref === 'ds:Signature') return undefined;
  const def = s.types[ref];
  if (!def) throw new Error(`Tipo de esquema desconocido: ${ref}`);
  return def;
}

export function isComplex(s: SchemaRegistry, ref: string): boolean {
  return typeDef(s, ref)?.kind === 'complex';
}

export function complexDef(s: SchemaRegistry, ref: string): ComplexTypeDef {
  const def = typeDef(s, ref);
  if (def?.kind !== 'complex') throw new Error(`Se esperaba un tipo complejo: ${ref}`);
  return def;
}

/** Tipo de un elemento global (`clave:Nombre`). */
export function elementType(s: SchemaRegistry, ref: string): string {
  const t = s.elements[ref];
  if (!t) throw new Error(`Elemento global desconocido: ${ref}`);
  return t;
}

/** Nombres de todos los elementos que pueden aparecer en una lista de partículas. */
export function particleNames(particles: readonly Particle[]): string[] {
  return particles.flatMap((p) =>
    p.kind === 'element' ? [p.name] : p.options.flatMap(particleNames),
  );
}

/** Busca la partícula de elemento con un nombre dado (en cualquier nivel de `choice`). */
export function findElement(
  particles: readonly Particle[],
  name: string,
): ElementParticle | undefined {
  for (const p of particles) {
    if (p.kind === 'element') {
      if (p.name === name) return p;
    } else {
      for (const opt of p.options) {
        const found = findElement(opt, name);
        if (found) return found;
      }
    }
  }
  return undefined;
}

const patternCache = new Map<string, RegExp>();

/** Convierte un patrón XSD (anclado implícitamente) a `RegExp`. */
function xsdPattern(pattern: string): RegExp {
  let re = patternCache.get(pattern);
  if (!re) {
    re = new RegExp(`^(?:${pattern})$`, 'u');
    patternCache.set(pattern, re);
  }
  return re;
}

/** Caracteres válidos en XML 1.0. */
// eslint-disable-next-line no-control-regex
const XML_CHAR_RE = /^[\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]*$/u;

/**
 * Comprueba un valor simple contra las facetas del XSD. Devuelve un mensaje de error o `undefined`.
 */
export function checkSimple(s: SchemaRegistry, ref: string, value: string): string | undefined {
  if (!XML_CHAR_RE.test(value)) return 'contiene caracteres no permitidos en XML';
  const def = typeDef(s, ref) as SimpleTypeDef | undefined;
  if (!def) return checkBuiltin(ref, value);
  // Las facetas de longitud del XSD cuentan caracteres (puntos de código), no unidades UTF-16.
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  const len = [...value].length;
  if (def.length !== undefined && len !== def.length)
    return `debe tener exactamente ${def.length} caracteres`;
  if (def.minLength !== undefined && len < def.minLength)
    return `debe tener al menos ${def.minLength} caracteres`;
  if (def.maxLength !== undefined && len > def.maxLength)
    return `no puede superar ${def.maxLength} caracteres`;
  if (def.pattern && !def.pattern.some((p) => xsdPattern(p).test(value))) {
    return `no cumple el formato ${def.pattern.join(' | ')}`;
  }
  if (def.enumeration && !def.enumeration.includes(value)) {
    return `valor no admitido (admitidos: ${def.enumeration.join(', ')})`;
  }
  return def.base.startsWith('xs:')
    ? checkBuiltin(def.base, value)
    : checkSimple(s, def.base, value);
}

const DATETIME_RE = /^-?\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

function checkBuiltin(ref: string, value: string): string | undefined {
  switch (ref) {
    case 'xs:string':
      return undefined;
    case 'xs:dateTime':
      return DATETIME_RE.test(value) ? undefined : 'no es un xs:dateTime válido';
    case 'xs:integer':
      return /^[+-]?\d+$/.test(value) ? undefined : 'no es un entero válido';
    default:
      return undefined;
  }
}

/**
 * Valida un objeto «de cable» contra un tipo complejo del esquema: elementos obligatorios,
 * cardinalidad, `choice`, propiedades desconocidas y facetas de los valores simples.
 *
 * @throws XmlSchemaError en el primer incumplimiento.
 */
export function assertWire(s: SchemaRegistry, ref: string, value: unknown, path: string): void {
  if (ref === 'ds:Signature') {
    if (
      typeof value !== 'object' ||
      value === null ||
      typeof (value as { raw?: unknown }).raw !== 'string'
    ) {
      throw new XmlSchemaError(path, 'la firma debe ser un fragmento XML ({ raw })');
    }
    return;
  }
  const def = typeDef(s, ref);
  if (def?.kind !== 'complex') {
    if (typeof value !== 'string') throw new XmlSchemaError(path, 'se esperaba un valor de texto');
    const problem = checkSimple(s, ref, value);
    if (problem) throw new XmlSchemaError(path, `${JSON.stringify(value)} ${problem}`);
    return;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new XmlSchemaError(path, 'se esperaba un objeto');
  }
  const obj = value as Record<string, unknown>;
  const allowed = new Set(particleNames(def.content));
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined && !allowed.has(key))
      throw new XmlSchemaError(`${path}/${key}`, 'elemento no admitido por el esquema');
  }
  assertParticles(s, def.content, obj, path);
}

function assertParticles(
  s: SchemaRegistry,
  particles: readonly Particle[],
  obj: Record<string, unknown>,
  path: string,
): void {
  for (const p of particles) {
    if (p.kind === 'element') {
      const v = obj[p.name];
      const items = v === undefined ? [] : p.max > 1 ? asArray(v, `${path}/${p.name}`) : [v];
      if (items.length < p.min)
        throw new XmlSchemaError(`${path}/${p.name}`, 'elemento obligatorio');
      if (items.length > p.max)
        throw new XmlSchemaError(`${path}/${p.name}`, `máximo ${p.max} elementos`);
      items.forEach((item, i) => {
        assertWire(s, p.type, item, p.max > 1 ? `${path}/${p.name}[${i}]` : `${path}/${p.name}`);
      });
    } else {
      const present = p.options.filter((opt) =>
        particleNames(opt).some((n) => obj[n] !== undefined),
      );
      if (present.length > 1) {
        throw new XmlSchemaError(
          path,
          `solo puede informarse una de las opciones: ${p.options.map((o) => particleNames(o).join('+')).join(' | ')}`,
        );
      }
      const chosen = present[0];
      if (!chosen) {
        if (p.min > 0)
          throw new XmlSchemaError(
            path,
            `debe informarse una de: ${p.options.map((o) => particleNames(o).join('+')).join(' | ')}`,
          );
        continue;
      }
      assertParticles(s, chosen, obj, path);
    }
  }
}

function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new XmlSchemaError(path, 'se esperaba una lista');
  return v as unknown[];
}
