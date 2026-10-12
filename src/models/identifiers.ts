import type { IsoDate } from '../common/dates.ts';
import type { ForeignIdType } from './enums.ts';

/**
 * Identificador de una factura (`IDFactura`).
 *
 * Port de InvoiceIdentifier.php (josemmo/Verifactu-PHP, MIT).
 */
export interface InvoiceIdentifier {
  /** NIF del obligado a expedir la factura (`IDEmisorFactura`), 9 caracteres. */
  readonly issuerId: string;
  /**
   * Número y serie de la factura (`NumSerieFactura`), hasta 60 caracteres ASCII imprimibles
   * (32–126) salvo `"`, `'`, `<`, `>` y `=`.
   */
  readonly invoiceNumber: string;
  /** Fecha de expedición (`FechaExpedicionFactura`), `AAAA-MM-DD`. */
  readonly issueDate: IsoDate;
}

/**
 * Persona física o jurídica española identificada por NIF (`NombreRazon` + `NIF`).
 *
 * Port de FiscalIdentifier.php (josemmo/Verifactu-PHP, MIT).
 */
export interface FiscalIdentifier {
  /** Nombre y apellidos o razón social (`NombreRazon`), hasta 120 caracteres. */
  readonly name: string;
  /** NIF (9 caracteres). */
  readonly nif: string;
}

/**
 * Persona física o jurídica identificada por un documento distinto del NIF español (`IDOtro`).
 *
 * Port de ForeignFiscalIdentifier.php (josemmo/Verifactu-PHP, MIT).
 */
export interface ForeignFiscalIdentifier {
  /** Nombre y apellidos o razón social (`NombreRazon`), hasta 120 caracteres. */
  readonly name: string;
  /** Código de país ISO 3166-1 alfa-2 (`CodigoPais`). */
  readonly country?: string;
  /** Tipo de identificación (`IDType`). */
  readonly type: ForeignIdType;
  /** Número de identificación (`ID`), hasta 20 caracteres. */
  readonly value: string;
}

/** Destinatario, tercero o generador: con NIF español o con otra identificación. */
export type Party = FiscalIdentifier | ForeignFiscalIdentifier;

/** Indica si una parte se identifica con NIF español. */
export function isFiscalIdentifier(party: Party): party is FiscalIdentifier {
  return 'nif' in party;
}
