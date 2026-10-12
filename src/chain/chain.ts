import { parseDateTimeWithOffset } from '../common/dates.ts';
import { calculateHash } from '../hash/hash.ts';
import type { InvoiceIdentifier } from '../models/identifiers.ts';
import type { ChainLink, InvoiceRecord } from '../models/records.ts';

/** Enlace que el siguiente registro debe usar para encadenarse con `record`. */
export function toChainLink(record: Pick<InvoiceRecord, 'invoiceId' | 'hash'>): ChainLink {
  return { invoiceId: record.invoiceId, hash: record.hash };
}

/** Compara dos identificadores de factura (emisor, número y fecha). */
export function sameInvoiceId(a: InvoiceIdentifier, b: InvoiceIdentifier): boolean {
  return (
    a.issuerId === b.issuerId && a.invoiceNumber === b.invoiceNumber && a.issueDate === b.issueDate
  );
}

/** Problema detectado al verificar una cadena de registros. */
export interface ChainIssue {
  /** Posición del registro afectado dentro de la secuencia verificada. */
  readonly index: number;
  readonly type: 'hash-mismatch' | 'broken-link' | 'unexpected-first' | 'timestamp-regression';
  readonly message: string;
}

/**
 * Verifica una secuencia de registros consecutivos de una misma cadena:
 *
 * - la huella de cada registro es la que corresponde a sus datos;
 * - cada registro apunta al anterior (identificador de factura y huella);
 * - la fecha de generación no retrocede más de un minuto respecto a la del registro anterior
 *   (Orden HAC/1177/2024, art. 7.i.2, según FAQ de desarrolladores v1.3).
 *
 * @param options.previous enlace del registro inmediatamente anterior al primero de la secuencia;
 *   `null` (por defecto) si la secuencia empieza en el primer registro de la cadena.
 * @returns lista de problemas; vacía si la cadena es correcta.
 */
export async function verifyChain(
  records: readonly InvoiceRecord[],
  options: { previous?: ChainLink | null } = {},
): Promise<ChainIssue[]> {
  const issues: ChainIssue[] = [];
  let expected: ChainLink | null = options.previous ?? null;
  let previousTime: number | undefined;

  for (const [index, record] of records.entries()) {
    if ((await calculateHash(record)) !== record.hash) {
      issues.push({
        index,
        type: 'hash-mismatch',
        message: 'La huella no corresponde a los datos del registro.',
      });
    }

    if (expected === null) {
      if (record.previous !== null) {
        issues.push({
          index,
          type: 'unexpected-first',
          message:
            'Se esperaba el primer registro de la cadena, pero el registro apunta a uno anterior.',
        });
      }
    } else if (record.previous === null) {
      issues.push({
        index,
        type: 'broken-link',
        message: 'El registro se marca como primero de la cadena, pero no lo es.',
      });
    } else if (
      !sameInvoiceId(record.previous.invoiceId, expected.invoiceId) ||
      record.previous.hash !== expected.hash
    ) {
      issues.push({
        index,
        type: 'broken-link',
        message: 'El registro no apunta al registro inmediatamente anterior.',
      });
    }

    const time = parseDateTimeWithOffset(record.hashedAt).getTime();
    if (previousTime !== undefined && time < previousTime - 60_000) {
      issues.push({
        index,
        type: 'timestamp-regression',
        message: 'La fecha de generación es más de un minuto anterior a la del registro previo.',
      });
    }
    previousTime = time;
    expected = toChainLink(record);
  }
  return issues;
}
