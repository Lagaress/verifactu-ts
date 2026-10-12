/**
 * Tipos de los metadatos de esquema que genera `scripts/gen-wire-types.ts`.
 *
 * Las referencias de tipo tienen la forma `clave:Nombre` (`sf:CabeceraType`), `xs:<builtin>`
 * para tipos de XML Schema, o `ds:Signature` para la firma XMLDSig (fragmento opaco).
 */
export type SchemaKey = 'sf' | 'sfLR' | 'sfR' | 'sfLRC' | 'sfLRRC' | 'sfEv' | 'sfVNV';

export interface ElementParticle {
  readonly kind: 'element';
  readonly name: string;
  readonly ns: SchemaKey | 'ds';
  readonly type: string;
  readonly min: number;
  readonly max: number;
}

export interface ChoiceParticle {
  readonly kind: 'choice';
  readonly options: readonly (readonly Particle[])[];
  readonly min: number;
  readonly max: number;
}

export type Particle = ElementParticle | ChoiceParticle;

export interface ComplexTypeDef {
  readonly kind: 'complex';
  readonly content: readonly Particle[];
}

export interface SimpleTypeDef {
  readonly kind: 'simple';
  readonly base: string;
  readonly enumeration?: readonly string[];
  readonly pattern?: readonly string[];
  readonly length?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export type TypeDef = ComplexTypeDef | SimpleTypeDef;

export interface SchemaRegistry {
  readonly types: Readonly<Record<string, TypeDef>>;
  readonly elements: Readonly<Record<string, string>>;
}
