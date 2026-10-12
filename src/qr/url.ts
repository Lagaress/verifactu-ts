import { isAmount } from '../common/amount.ts';
import { toAeatDate, type IsoDate } from '../common/dates.ts';
import { InvalidArgumentError } from '../common/errors.ts';
import type { InvoiceIdentifier } from '../models/identifiers.ts';
import type { RegistrationRecord } from '../models/records.ts';
import { QR_HOSTS, type Environment } from '../spec/endpoints.ts';

/**
 * Modalidad del sistema que expide la factura.
 *
 * - `verifactu`: sistema VERI*FACTU (facturas verificables): URL `ValidarQR`.
 * - `no-verifactu`: sistema NO VERI*FACTU: URL `ValidarQRNoVerifactu`.
 */
export type Mode = 'verifactu' | 'no-verifactu';

export interface QrUrlOptions {
  /** Entorno: `production` (www2.agenciatributaria.gob.es) o `test` (prewww2.aeat.es). */
  readonly environment: Environment;
  readonly mode: Mode;
}

/** Datos que contiene la URL del QR. */
export interface QrData {
  /** NIF del emisor. */
  readonly issuerId: string;
  /** Número y serie de la factura. */
  readonly invoiceNumber: string;
  /** Fecha de expedición, `AAAA-MM-DD`. */
  readonly issueDate: IsoDate;
  /** Importe total de la factura (`ImporteTotal`). */
  readonly amount: string;
}

/**
 * Genera la URL de cotejo que debe codificarse en el QR de la factura.
 *
 * Especificación: «Características del QR y especificaciones del servicio de cotejo» v0.5.0.
 * Los parámetros se codifican como `application/x-www-form-urlencoded` en UTF-8, igual que
 * `java.net.URLEncoder` del ejemplo oficial (§4.1): un espacio es `+` y `&` es `%26`.
 *
 * Port de QrGenerator.php (josemmo/Verifactu-PHP, MIT).
 *
 * @example
 * qrUrl(record, { environment: 'production', mode: 'verifactu' })
 * // https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=…&numserie=…&fecha=…&importe=…
 */
export function qrUrl(source: RegistrationRecord | QrData, options: QrUrlOptions): string {
  const data: QrData = 'kind' in source ? fromRecord(source) : source;
  validate(data);
  const params = new URLSearchParams({
    nif: data.issuerId,
    numserie: data.invoiceNumber,
    fecha: toAeatDate(data.issueDate),
    importe: data.amount,
  });
  const path = options.mode === 'verifactu' ? 'ValidarQR' : 'ValidarQRNoVerifactu';
  return `${QR_HOSTS[options.environment]}/wlpl/TIKE-CONT/${path}?${params.toString()}`;
}

function fromRecord(record: RegistrationRecord): QrData {
  const { issuerId, invoiceNumber, issueDate }: InvoiceIdentifier = record.invoiceId;
  return { issuerId, invoiceNumber, issueDate, amount: record.totalAmount };
}

// Requisitos de los parámetros (QR v0.5.0 §6; códigos de error 2001–2006 del servicio de cotejo).
function validate(data: QrData): void {
  if (data.issuerId.length !== 9) {
    throw new InvalidArgumentError(
      `El NIF del QR debe tener 9 caracteres: ${JSON.stringify(data.issuerId)}`,
    );
  }
  if (data.invoiceNumber.length === 0 || data.invoiceNumber.length > 60) {
    throw new InvalidArgumentError('El número de serie del QR debe tener entre 1 y 60 caracteres.');
  }
  if (!/^[\x20-\x7E]+$/.test(data.invoiceNumber)) {
    throw new InvalidArgumentError(
      'El número de serie del QR solo puede contener caracteres ASCII imprimibles (32–126).',
    );
  }
  if (!isAmount(data.amount)) {
    throw new InvalidArgumentError(
      `Importe del QR con formato no válido: ${JSON.stringify(data.amount)}`,
    );
  }
}
