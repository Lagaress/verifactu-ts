import type { Amount, Rate } from '../common/amount.ts';
import type { DateTimeWithOffset, IsoDate } from '../common/dates.ts';
import type { RawXml } from '../xml/raw-xml.ts';
import type { ComputerSystem } from './computer-system.ts';
import type {
  CorrectiveType,
  GeneratedBy,
  InvoiceType,
  IssuedBy,
  OperationType,
  PriorRejection,
  RegimeType,
  TaxType,
} from './enums.ts';
import type { InvoiceIdentifier, Party } from './identifiers.ts';

/**
 * Enlace con el registro anterior de la cadena: lo que el siguiente registro necesita para
 * encadenarse (`Encadenamiento/RegistroAnterior`).
 *
 * El SIF debe persistir el enlace del último registro generado (por obligado tributario o por
 * instalación, según su diseño) y pasarlo al crear el siguiente.
 */
export interface ChainLink {
  /** Identificador de la factura del registro anterior (alta o anulación). */
  readonly invoiceId: InvoiceIdentifier;
  /** Huella del registro anterior (64 caracteres hexadecimales en mayúsculas). */
  readonly hash: string;
}

/**
 * Línea de desglose (`DetalleDesglose`).
 *
 * Port de BreakdownDetails.php (josemmo/Verifactu-PHP, MIT).
 */
export interface BreakdownDetails {
  /** Impuesto (`Impuesto`). Si se omite, la AEAT considera IVA. */
  readonly taxType?: TaxType;
  /** Clave de régimen (`ClaveRegimen`). */
  readonly regimeType?: RegimeType;
  /** Calificación (`CalificacionOperacion`) u operación exenta (`OperacionExenta`). */
  readonly operationType: OperationType;
  /** Tipo impositivo (`TipoImpositivo`), p. ej. `"21.00"`. */
  readonly taxRate?: Rate;
  /** Base imponible o importe no sujeto (`BaseImponibleOimporteNoSujeto`). */
  readonly baseAmount: Amount;
  /** Base imponible a coste (`BaseImponibleACoste`), solo en ciertos regímenes. */
  readonly costBaseAmount?: Amount;
  /** Cuota repercutida (`CuotaRepercutida`). */
  readonly taxAmount?: Amount;
  /** Tipo del recargo de equivalencia (`TipoRecargoEquivalencia`). */
  readonly surchargeRate?: Rate;
  /** Cuota del recargo de equivalencia (`CuotaRecargoEquivalencia`). */
  readonly surchargeAmount?: Amount;
}

interface RecordBase {
  /** Identificador de la factura a la que se refiere el registro. */
  readonly invoiceId: InvoiceIdentifier;
  /** Referencia externa libre del SIF (`RefExterna`), hasta 60 caracteres. */
  readonly externalReference?: string;
  /** Registro anterior de la cadena, o `null` si es el primero (`PrimerRegistro = S`). */
  readonly previous: ChainLink | null;
  /** Sistema informático que genera el registro. */
  readonly system: ComputerSystem;
  /** Fecha, hora y huso de generación del registro (`FechaHoraHusoGenRegistro`). */
  readonly hashedAt: DateTimeWithOffset;
  /** Huella del registro (`Huella`), SHA-256 en hexadecimal y mayúsculas. */
  readonly hash: string;
  /** Firma XAdES del registro (`ds:Signature`), obligatoria solo en la modalidad NO VERI*FACTU. */
  readonly signature?: RawXml;
}

/**
 * Registro de facturación de alta (`RegistroAlta`).
 *
 * Port de RegistrationRecord.php (josemmo/Verifactu-PHP, MIT). Para crear uno con la huella
 * calculada usa {@link createRegistrationRecord}.
 */
export interface RegistrationRecord extends RecordBase {
  readonly kind: 'registration';
  /** Nombre o razón social del obligado a expedir la factura (`NombreRazonEmisor`). */
  readonly issuerName: string;
  /** Subsanación de un registro previo (`Subsanacion = S`). */
  readonly isCorrection: boolean;
  /** Indicador de rechazo previo (`RechazoPrevio`). `X` exige `isCorrection`. */
  readonly priorRejection?: PriorRejection;
  readonly invoiceType: InvoiceType;
  /** Tipo de rectificativa (`TipoRectificativa`); obligatorio en R1–R5. */
  readonly correctiveType?: CorrectiveType;
  /** Facturas rectificadas (`FacturasRectificadas`). */
  readonly correctedInvoices?: readonly InvoiceIdentifier[];
  /** Facturas sustituidas (`FacturasSustituidas`), solo en F3. */
  readonly replacedInvoices?: readonly InvoiceIdentifier[];
  /** Base rectificada (`ImporteRectificacion/BaseRectificada`); obligatoria en rectificativas por sustitución. */
  readonly correctedBaseAmount?: Amount;
  /** Cuota rectificada (`ImporteRectificacion/CuotaRectificada`). */
  readonly correctedTaxAmount?: Amount;
  /** Cuota de recargo rectificada (`ImporteRectificacion/CuotaRecargoRectificado`). */
  readonly correctedSurchargeAmount?: Amount;
  /** Fecha de realización de la operación (`FechaOperacion`), si es distinta de la de expedición. */
  readonly operationDate?: IsoDate;
  /** Descripción del objeto de la factura (`DescripcionOperacion`), hasta 500 caracteres. */
  readonly description: string;
  /** Factura simplificada cualificada del art. 7.2/7.3 del RD 1619/2012 (`FacturaSimplificadaArt7273`). */
  readonly isSimplifiedArt7273?: boolean;
  /** Factura completa sin identificación del destinatario, art. 6.1.d (`FacturaSinIdentifDestinatarioArt61d`). */
  readonly isWithoutRecipientArt61d?: boolean;
  /** Indicador de macrodato (`Macrodato`): importe total ≥ 100 000 000 €. */
  readonly isMacrodata?: boolean;
  /** Factura expedida por un tercero o por el destinatario (`EmitidaPorTerceroODestinatario`). */
  readonly issuedBy?: IssuedBy;
  /** Tercero que expide la factura (`Tercero`), si `issuedBy` es `T`. */
  readonly thirdParty?: Party;
  /** Destinatarios (`Destinatarios/IDDestinatario`). Vacío en F2 y R5. */
  readonly recipients: readonly Party[];
  /** Indicador de cupón (`Cupon`). */
  readonly hasCoupon?: boolean;
  /** Líneas de desglose (`Desglose/DetalleDesglose`), de 1 a 12. */
  readonly breakdown: readonly BreakdownDetails[];
  /** Cuota total (`CuotaTotal`). */
  readonly totalTaxAmount: Amount;
  /** Importe total (`ImporteTotal`). */
  readonly totalAmount: Amount;
  /** Número de registro del acuerdo de facturación (`NumRegistroAcuerdoFacturacion`). */
  readonly billingAgreementNumber?: string;
  /** Identificador del acuerdo del sistema informático (`IdAcuerdoSistemaInformatico`). */
  readonly systemAgreementId?: string;
}

/**
 * Registro de facturación de anulación (`RegistroAnulacion`).
 *
 * Port de CancellationRecord.php (josemmo/Verifactu-PHP, MIT). Para crear uno con la huella
 * calculada usa {@link createCancellationRecord}.
 */
export interface CancellationRecord extends RecordBase {
  readonly kind: 'cancellation';
  /** La factura anulada no tiene registro de alta en la AEAT (`SinRegistroPrevio = S`). */
  readonly withoutPriorRecord: boolean;
  /** Anulación tras el rechazo de una anulación previa (`RechazoPrevio = S`). */
  readonly isPriorRejection: boolean;
  /** Quién genera la anulación (`GeneradoPor`). */
  readonly generatedBy?: GeneratedBy;
  /** Datos de quien genera la anulación (`Generador`), si no es el expedidor. */
  readonly generator?: Party;
}

/** Registro de facturación: de alta o de anulación. */
export type InvoiceRecord = RegistrationRecord | CancellationRecord;
