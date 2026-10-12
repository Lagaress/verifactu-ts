/**
 * Fragmento XML opaco que se inserta o se conserva tal cual (p. ej. `ds:Signature`).
 *
 * El contenido debe ser XML bien formado; el serializador no lo modifica.
 */
export interface RawXml {
  readonly raw: string;
}
