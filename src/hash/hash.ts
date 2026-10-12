import { toAeatDate } from '../common/dates.ts';
import type { CancellationRecord, InvoiceRecord, RegistrationRecord } from '../models/records.ts';

/**
 * Cálculo de la huella (hash) de los registros de facturación.
 *
 * Especificación: «Especificaciones técnicas para la generación de la huella o hash de los
 * registros de facturación» v0.1.2 (AEAT). Port de Record::calculateHash() de
 * josemmo/Verifactu-PHP (MIT), con una diferencia deliberada: aquí se eliminan los espacios al
 * inicio y al final de cada valor, como exige la especificación (PHP no lo hace).
 */

/** Campos que intervienen en la huella de un registro de alta, ya en formato XML. */
export interface RegistrationHashFields {
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  /** `DD-MM-AAAA` */
  readonly FechaExpedicionFactura: string;
  readonly TipoFactura: string;
  readonly CuotaTotal: string;
  readonly ImporteTotal: string;
  /** Huella del registro anterior; vacía en el primer registro. */
  readonly Huella: string;
  readonly FechaHoraHusoGenRegistro: string;
}

/** Campos que intervienen en la huella de un registro de anulación, ya en formato XML. */
export interface CancellationHashFields {
  readonly IDEmisorFacturaAnulada: string;
  readonly NumSerieFacturaAnulada: string;
  /** `DD-MM-AAAA` */
  readonly FechaExpedicionFacturaAnulada: string;
  /** Huella del registro anterior; vacía en el primer registro. */
  readonly Huella: string;
  readonly FechaHoraHusoGenRegistro: string;
}

const REGISTRATION_ORDER = [
  'IDEmisorFactura',
  'NumSerieFactura',
  'FechaExpedicionFactura',
  'TipoFactura',
  'CuotaTotal',
  'ImporteTotal',
  'Huella',
  'FechaHoraHusoGenRegistro',
] as const satisfies readonly (keyof RegistrationHashFields)[];

const CANCELLATION_ORDER = [
  'IDEmisorFacturaAnulada',
  'NumSerieFacturaAnulada',
  'FechaExpedicionFacturaAnulada',
  'Huella',
  'FechaHoraHusoGenRegistro',
] as const satisfies readonly (keyof CancellationHashFields)[];

/**
 * Construye la cadena de entrada de la huella: `campo1=valor1&campo2=valor2&…`.
 *
 * Los valores no se codifican (ni URL ni XML) y se les quitan los espacios iniciales y finales.
 * Un valor vacío se escribe como `campo=`.
 */
function concatenate<K extends string>(
  order: readonly K[],
  fields: Readonly<Record<K, string>>,
): string {
  return order.map((name) => `${name}=${fields[name].trim()}`).join('&');
}

/** Cadena de entrada de la huella de un registro de alta. */
export function registrationHashInput(fields: RegistrationHashFields): string {
  return concatenate(REGISTRATION_ORDER, fields);
}

/** Cadena de entrada de la huella de un registro de anulación. */
export function cancellationHashInput(fields: CancellationHashFields): string {
  return concatenate(CANCELLATION_ORDER, fields);
}

/** Campos de huella de un registro de alta del modelo. */
export function registrationHashFields(
  record: Pick<
    RegistrationRecord,
    'invoiceId' | 'invoiceType' | 'totalTaxAmount' | 'totalAmount' | 'previous' | 'hashedAt'
  >,
): RegistrationHashFields {
  return {
    IDEmisorFactura: record.invoiceId.issuerId,
    NumSerieFactura: record.invoiceId.invoiceNumber,
    FechaExpedicionFactura: toAeatDate(record.invoiceId.issueDate),
    TipoFactura: record.invoiceType,
    CuotaTotal: record.totalTaxAmount,
    ImporteTotal: record.totalAmount,
    Huella: record.previous?.hash ?? '',
    FechaHoraHusoGenRegistro: record.hashedAt,
  };
}

/** Campos de huella de un registro de anulación del modelo. */
export function cancellationHashFields(
  record: Pick<CancellationRecord, 'invoiceId' | 'previous' | 'hashedAt'>,
): CancellationHashFields {
  return {
    IDEmisorFacturaAnulada: record.invoiceId.issuerId,
    NumSerieFacturaAnulada: record.invoiceId.invoiceNumber,
    FechaExpedicionFacturaAnulada: toAeatDate(record.invoiceId.issueDate),
    Huella: record.previous?.hash ?? '',
    FechaHoraHusoGenRegistro: record.hashedAt,
  };
}

/**
 * SHA-256 de una cadena (codificada en UTF-8), en hexadecimal y mayúsculas.
 * Usa Web Crypto, disponible en Node ≥ 20, Deno, Bun, navegadores y workers.
 */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  let hex = '';
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, '0');
  return hex.toUpperCase();
}

/** Calcula la huella de un registro (alta o anulación) a partir de sus datos. */
export async function calculateHash(
  record:
    | Pick<
        RegistrationRecord,
        | 'kind'
        | 'invoiceId'
        | 'invoiceType'
        | 'totalTaxAmount'
        | 'totalAmount'
        | 'previous'
        | 'hashedAt'
      >
    | Pick<CancellationRecord, 'kind' | 'invoiceId' | 'previous' | 'hashedAt'>,
): Promise<string> {
  const input =
    record.kind === 'registration'
      ? registrationHashInput(registrationHashFields(record))
      : cancellationHashInput(cancellationHashFields(record));
  return sha256Hex(input);
}

/** Comprueba que la huella almacenada en el registro coincide con la calculada. */
export async function verifyHash(record: InvoiceRecord): Promise<boolean> {
  return (await calculateHash(record)) === record.hash;
}
