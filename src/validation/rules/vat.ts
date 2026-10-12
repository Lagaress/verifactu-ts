/**
 * Estructura de los NIF-IVA de los Estados miembros según la nota (1) del documento
 * «Validaciones y errores» v1.2.2 de la AEAT. El identificador incluye el prefijo de país
 * (Grecia usa `EL`). Solo se admiten mayúsculas.
 */
const STRUCTURES: Readonly<Record<string, RegExp>> = {
  DE: /^\d{9}$/,
  AT: /^[A-Z0-9]{9}$/,
  BE: /^\d{10}$/,
  CY: /^[A-Z0-9]{9}$/,
  CZ: /^\d{8,10}$/,
  HR: /^\d{11}$/,
  DK: /^\d{8}$/,
  SK: /^\d{10}$/,
  SI: /^\d{8}$/,
  EE: /^\d{9}$/,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{11}$/,
  EL: /^\d{9}$/,
  GB: /^(?:[A-Z0-9]{5}|[A-Z0-9]{9}|[A-Z0-9]{12})$/,
  XI: /^(?:[A-Z0-9]{5}|[A-Z0-9]{9}|[A-Z0-9]{12})$/,
  NL: /^[A-Z0-9]{12}$/,
  HU: /^\d{8}$/,
  IT: /^\d{11}$/,
  IE: /^[A-Z0-9]{8,9}$/,
  LV: /^\d{11}$/,
  LT: /^(?:\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  MT: /^\d{8}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  SE: /^\d{12}$/,
  BG: /^\d{9,10}$/,
  RO: /^[1-9]\d{1,9}$/,
};

/**
 * Comprueba la estructura de un NIF-IVA (p. ej. `FR12345678901`).
 *
 * Para Reino Unido aplica las reglas del Brexit en función de la fecha de operación: antes del
 * 01/01/2021 solo `GB`; en enero de 2021 `GB` o `XI`; desde el 01/02/2021 solo `XI`.
 *
 * @param operationDate fecha de operación (o de expedición) `AAAA-MM-DD`, si se conoce.
 */
export function isValidVatNumber(value: string, operationDate?: string): boolean {
  const prefix = value.slice(0, 2);
  const structure = STRUCTURES[prefix];
  if (!structure?.test(value.slice(2))) return false;
  if (operationDate !== undefined) {
    if (prefix === 'XI' && operationDate < '2021-01-01') return false;
    if (prefix === 'GB' && operationDate >= '2021-02-01') return false;
  }
  return true;
}
