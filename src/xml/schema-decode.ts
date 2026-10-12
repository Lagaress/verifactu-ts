import type { Particle, SchemaKey, SchemaRegistry, TypeDef } from './schema-types.ts';

/** Partícula compacta: `[nombre, tipo, min?, max?, ns?]` o `{ c: opciones, m?: 0 }`. */
type RawParticle =
  | readonly [string, string, number?, number?, (SchemaKey | 'ds')?]
  | { readonly c: readonly (readonly RawParticle[])[]; readonly m?: number };

interface RawSimple {
  readonly b?: string;
  readonly e?: readonly string[];
  readonly p?: readonly string[];
  readonly l?: number;
  readonly n?: number;
  readonly x?: number;
}

const qualify = (ref: string, owner: SchemaKey): string =>
  ref.includes(':') ? ref : `${owner}:${ref}`;

function particle(raw: RawParticle, owner: SchemaKey): Particle {
  if (!Array.isArray(raw)) {
    const choice = raw as Extract<RawParticle, { c: unknown }>;
    return {
      kind: 'choice',
      options: choice.c.map((o) => o.map((p) => particle(p, owner))),
      min: choice.m ?? 1,
      max: 1,
    };
  }
  const [name, type, min = 1, max = 1, ns = owner] = raw as Extract<
    RawParticle,
    readonly unknown[]
  >;
  return { kind: 'element', name, ns, type: qualify(type, owner), min, max };
}

/**
 * Expande el registro compacto de un esquema que genera `scripts/gen-wire-types.ts`.
 * Formato: ver `emitRegistry` en el generador.
 */
export function decodeSchema(
  key: SchemaKey,
  rawTypes: Readonly<Record<string, readonly RawParticle[] | RawSimple>>,
  rawElements: Readonly<Record<string, string>>,
): SchemaRegistry {
  const types: Record<string, TypeDef> = {};
  const elements: Record<string, string> = {};
  for (const [name, def] of Object.entries(rawTypes)) {
    if (Array.isArray(def)) {
      const content = (def as readonly RawParticle[]).map((p) => particle(p, key));
      types[`${key}:${name}`] = { kind: 'complex', content };
    } else {
      const s = def as RawSimple;
      types[`${key}:${name}`] = {
        kind: 'simple',
        base: s.b ?? 'xs:string',
        ...(s.e && { enumeration: s.e }),
        ...(s.p && { pattern: s.p }),
        ...(s.l !== undefined && { length: s.l }),
        ...(s.n !== undefined && { minLength: s.n }),
        ...(s.x !== undefined && { maxLength: s.x }),
      };
    }
  }
  for (const [name, type] of Object.entries(rawElements)) {
    elements[`${key}:${name}`] = qualify(type, key);
  }
  return { types, elements };
}

/** Combina registros de varios esquemas (p. ej. SuministroLR necesita SuministroInformacion). */
export function mergeSchemas(...parts: readonly SchemaRegistry[]): SchemaRegistry {
  return {
    types: Object.assign({}, ...parts.map((p) => p.types)) as SchemaRegistry['types'],
    elements: Object.assign({}, ...parts.map((p) => p.elements)) as SchemaRegistry['elements'],
  };
}
