import { AEAT_ERRORS } from './generated/errors.ts';

/**
 * Clase de un código de error de la AEAT, según la sección de `errores.properties`:
 *
 * - `rechazo-envio`: se rechaza el envío completo.
 * - `rechazo-registro`: se rechaza el registro (o la petición completa si el error está en la cabecera).
 * - `admisible`: el registro se acepta con errores y debe subsanarse.
 */
export type AeatErrorKind = 'rechazo-envio' | 'rechazo-registro' | 'admisible';

export interface AeatErrorInfo {
  readonly kind: AeatErrorKind;
  /** Descripción oficial del error. */
  readonly description: string;
}

/**
 * Información de un código de error de la AEAT, o `undefined` si el código no está en el
 * catálogo de la versión de la especificación soportada.
 */
export function aeatError(code: number): AeatErrorInfo | undefined {
  return AEAT_ERRORS[code];
}

export { AEAT_ERRORS };
