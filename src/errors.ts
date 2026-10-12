/**
 * verifactu-ts/errors — catálogo de códigos de error de la AEAT con su descripción oficial
 * (`errores.properties`). Es opcional: el núcleo solo incluye la clasificación de cada código.
 *
 * @packageDocumentation
 */
import { AEAT_ERROR_DESCRIPTIONS } from './spec/generated/error-descriptions.ts';
import { aeatErrorKind, type AeatErrorKind } from './spec/errors.ts';

export { AEAT_ERROR_DESCRIPTIONS, aeatErrorKind, type AeatErrorKind };

/** Información completa de un código de error de la AEAT. */
export interface AeatErrorInfo {
  readonly code: number;
  readonly kind: AeatErrorKind;
  /** Descripción oficial del error. */
  readonly description: string;
}

/** Información de un código de error de la AEAT, o `undefined` si no está en el catálogo. */
export function aeatError(code: number): AeatErrorInfo | undefined {
  const kind = aeatErrorKind(code);
  const description = AEAT_ERROR_DESCRIPTIONS[code];
  return kind && description !== undefined ? { code, kind, description } : undefined;
}
