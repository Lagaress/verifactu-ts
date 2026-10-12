/**
 * Listas de claves de la AEAT con nombres legibles.
 *
 * Port de los enums de josemmo/Verifactu-PHP (src/Models/Records/*Type.php, MIT), ampliados con
 * los valores que el XSD vigente admite y PHP no recoge (E7, E8, régimen 21…). Los valores salen
 * de los XSD oficiales; `test/unit/models/enums.test.ts` comprueba que coinciden con los tipos
 * generados desde `spec/`.
 *
 * Cada lista es un objeto `as const` y un tipo con el mismo nombre (unión de sus valores), así que
 * se puede escribir tanto `InvoiceType.Factura` como el literal `'F1'`.
 */

/** Clave del tipo de factura (`TipoFactura`, lista L2). */
export const InvoiceType = {
  /** Factura (art. 6, 7.2 y 7.3 del RD 1619/2012). */
  Factura: 'F1',
  /** Factura simplificada y facturas sin identificación del destinatario (art. 6.1.d del RD 1619/2012). */
  Simplificada: 'F2',
  /** Factura emitida en sustitución de facturas simplificadas facturadas y declaradas. */
  Sustitutiva: 'F3',
  /** Factura rectificativa (art. 80.1 y 80.2 y error fundado en derecho). */
  R1: 'R1',
  /** Factura rectificativa (art. 80.3). */
  R2: 'R2',
  /** Factura rectificativa (art. 80.4). */
  R3: 'R3',
  /** Factura rectificativa (resto). */
  R4: 'R4',
  /** Factura rectificativa en facturas simplificadas. */
  R5: 'R5',
} as const;
export type InvoiceType = (typeof InvoiceType)[keyof typeof InvoiceType];

/** Tipo de factura rectificativa (`TipoRectificativa`, lista L3). */
export const CorrectiveType = {
  /** Por sustitución. */
  Substitution: 'S',
  /** Por diferencias (incremental). */
  Differences: 'I',
} as const;
export type CorrectiveType = (typeof CorrectiveType)[keyof typeof CorrectiveType];

/** Impuesto (`Impuesto`, lista L1). Si no se informa, la AEAT considera IVA. */
export const TaxType = {
  /** Impuesto sobre el Valor Añadido (IVA). */
  IVA: '01',
  /** Impuesto sobre la Producción, los Servicios y la Importación (IPSI) de Ceuta y Melilla. */
  IPSI: '02',
  /** Impuesto General Indirecto Canario (IGIC). */
  IGIC: '03',
  /** Otros. */
  Other: '05',
} as const;
export type TaxType = (typeof TaxType)[keyof typeof TaxType];

/**
 * Clave de régimen especial o trascendencia adicional (`ClaveRegimen`, listas L8A para IVA y L8B
 * para IGIC). El significado exacto de algunas claves depende del impuesto.
 */
export const RegimeType = {
  /** Operación de régimen general. */
  C01: '01',
  /** Exportación. */
  C02: '02',
  /** Régimen especial de bienes usados, objetos de arte, antigüedades y objetos de colección. */
  C03: '03',
  /** Régimen especial del oro de inversión. */
  C04: '04',
  /** Régimen especial de las agencias de viajes. */
  C05: '05',
  /** Régimen especial grupo de entidades en IVA/IGIC (nivel avanzado). */
  C06: '06',
  /** Régimen especial del criterio de caja. */
  C07: '07',
  /** Operaciones sujetas al IPSI/IGIC (en IVA) o al IPSI/IVA (en IGIC). */
  C08: '08',
  /** Prestaciones de servicios de agencias de viaje que actúan como mediadoras en nombre y por cuenta ajena (D.A. 4.ª RD 1619/2012). */
  C09: '09',
  /** Cobros por cuenta de terceros de honorarios profesionales o derechos de propiedad industrial, de autor u otros. */
  C10: '10',
  /** Operaciones de arrendamiento de local de negocio. */
  C11: '11',
  /** Factura con impuesto pendiente de devengo en certificaciones de obra cuyo destinatario sea una Administración Pública. */
  C14: '14',
  /** Factura con impuesto pendiente de devengo en operaciones de tracto sucesivo. */
  C15: '15',
  /** Operación acogida a alguno de los regímenes del capítulo XI del título IX (OSS e IOSS) o régimen equivalente en IGIC. */
  C17: '17',
  /** Recargo de equivalencia (IVA) o régimen especial del comerciante minorista (IGIC). */
  C18: '18',
  /** Régimen especial de la agricultura, ganadería y pesca (REAGYP). */
  C19: '19',
  /** Régimen simplificado (IVA). */
  C20: '20',
  /** Régimen simplificado (IGIC). Solo admitido con impuesto IGIC (Validaciones §15.6.11). */
  C21: '21',
} as const;
export type RegimeType = (typeof RegimeType)[keyof typeof RegimeType];

/**
 * Calificación de la operación. Agrupa, como Verifactu-PHP, las claves de `CalificacionOperacion`
 * (S1, S2, N1, N2; lista L9) y de `OperacionExenta` (E1–E8; lista L10): en el XML se escribe una u
 * otra según el valor.
 */
export const OperationType = {
  /** Operación sujeta y no exenta, sin inversión del sujeto pasivo. */
  Subject: 'S1',
  /** Operación sujeta y no exenta, con inversión del sujeto pasivo. */
  PassiveSubject: 'S2',
  /** Operación no sujeta (art. 7, 14 y otros). */
  NonSubject: 'N1',
  /** Operación no sujeta por reglas de localización. */
  NonSubjectByLocation: 'N2',
  /** Exenta (IVA: art. 20 de la Ley 37/1992). */
  ExemptE1: 'E1',
  /** Exenta (IVA: art. 21; exportaciones). */
  ExemptE2: 'E2',
  /** Exenta (IVA: art. 22). */
  ExemptE3: 'E3',
  /** Exenta (IVA: arts. 23 y 24). */
  ExemptE4: 'E4',
  /** Exenta (IVA: art. 25; entregas intracomunitarias). */
  ExemptE5: 'E5',
  /** Exenta por otros motivos. */
  ExemptE6: 'E6',
  /** Exenta (solo IGIC: art. 90 del Decreto Legislativo 1/2025). */
  ExemptE7: 'E7',
  /** Exenta (solo IGIC: Ley 20/1991). */
  ExemptE8: 'E8',
} as const;
export type OperationType = (typeof OperationType)[keyof typeof OperationType];

/** Indica si la clave corresponde a una operación sujeta y no exenta (S1, S2). */
export function isSubjectOperation(op: OperationType): op is 'S1' | 'S2' {
  return op === 'S1' || op === 'S2';
}

/** Indica si la clave corresponde a una operación no sujeta (N1, N2). */
export function isNonSubjectOperation(op: OperationType): op is 'N1' | 'N2' {
  return op === 'N1' || op === 'N2';
}

/** Indica si la clave corresponde a una operación exenta (E1–E8). */
export function isExemptOperation(op: OperationType): op is `E${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` {
  return op.startsWith('E');
}

/** Tipo de identificación en el país de residencia (`IDType`, lista L7). */
export const ForeignIdType = {
  /** NIF-IVA. */
  VAT: '02',
  /** Pasaporte. */
  Passport: '03',
  /** Documento oficial de identificación expedido por el país o territorio de residencia. */
  NationalId: '04',
  /** Certificado de residencia. */
  Residence: '05',
  /** Otro documento probatorio. */
  Other: '06',
  /** No censado. */
  Unregistered: '07',
} as const;
export type ForeignIdType = (typeof ForeignIdType)[keyof typeof ForeignIdType];

/** Quién ha generado un registro de anulación (`GeneradoPor`, lista L16). */
export const GeneratedBy = {
  /** El expedidor (obligado a expedir la factura anulada). */
  Issuer: 'E',
  /** El destinatario. */
  Recipient: 'D',
  /** Un tercero. */
  ThirdParty: 'T',
} as const;
export type GeneratedBy = (typeof GeneratedBy)[keyof typeof GeneratedBy];

/** Factura expedida por un tercero o por el destinatario (`EmitidaPorTerceroODestinatario`, lista L6). */
export const IssuedBy = {
  /** Expedida por el destinatario (autofacturación). */
  Recipient: 'D',
  /** Expedida por un tercero. */
  ThirdParty: 'T',
} as const;
export type IssuedBy = (typeof IssuedBy)[keyof typeof IssuedBy];

/**
 * Indicador `RechazoPrevio` de un registro de alta (lista L17).
 *
 * - `N`: no ha habido rechazo previo (equivale a no informarlo).
 * - `S`: alta por rechazo de una subsanación previa.
 * - `X`: el registro no existe en la AEAT (rechazado o nunca remitido); exige `Subsanacion = S`.
 */
export type PriorRejection = 'N' | 'S' | 'X';
