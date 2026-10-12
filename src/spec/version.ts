/**
 * Versión de la especificación técnica de la AEAT que implementa la librería.
 *
 * El material oficial correspondiente (XSD, WSDL, catálogo de errores y ejemplos) está en
 * `spec/aeat/<id>/` con su `manifest.json`. Ver MAINTAINING.md para actualizarlo.
 */
export const SPEC_VERSION = {
  /** Identificador de la instantánea de `spec/aeat/` (fecha de descarga). */
  id: '2026-10-12',
  /** Valor de `IDVersion` de los registros. */
  idVersion: '1.0',
  documents: {
    /** Descripción del servicio web. */
    webService: '1.0.3',
    /** Validaciones y errores. */
    validations: '1.2.2',
    /** Especificaciones de la huella o hash. */
    hash: '0.1.2',
    /** Características del QR y servicio de cotejo. */
    qr: '0.5.0',
    /** Especificaciones de firma electrónica de registros. */
    signature: '0.1.5',
  },
} as const;
