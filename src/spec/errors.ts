import {
  ADMISSIBLE_CODES,
  RECORD_REJECTION_CODES,
  SUBMISSION_REJECTION_CODES,
} from './generated/error-kinds.ts';

/**
 * Clase de un código de error de la AEAT, según la sección de `errores.properties`:
 *
 * - `rechazo-envio`: se rechaza el envío completo.
 * - `rechazo-registro`: se rechaza el registro (o la petición completa si el error está en la cabecera).
 * - `admisible`: el registro se acepta con errores y debe subsanarse.
 */
export type AeatErrorKind = 'rechazo-envio' | 'rechazo-registro' | 'admisible';

/**
 * Clase de un código de error de la AEAT, o `undefined` si el código no está en el catálogo de la
 * versión de la especificación soportada.
 *
 * Las descripciones oficiales están en el subpath opcional `verifactu-ts/errors`, para no cargarlas
 * en el núcleo: las respuestas de la AEAT ya incluyen la descripción de cada error.
 */
export function aeatErrorKind(code: number): AeatErrorKind | undefined {
  if (ADMISSIBLE_CODES.includes(code)) return 'admisible';
  if (RECORD_REJECTION_CODES.includes(code)) return 'rechazo-registro';
  if (SUBMISSION_REJECTION_CODES.includes(code)) return 'rechazo-envio';
  return undefined;
}
