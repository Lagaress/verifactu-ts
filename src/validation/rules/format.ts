import { isAmount, isRate } from '../../common/amount.ts';
import { isDateTimeWithOffset, isIsoDate } from '../../common/dates.ts';
import type { ComputerSystem } from '../../models/computer-system.ts';
import type { InvoiceIdentifier, Party } from '../../models/identifiers.ts';
import type { BreakdownDetails, InvoiceRecord } from '../../models/records.ts';
import type { Collector } from '../collector.ts';

/**
 * Reglas de formato: longitudes, caracteres y formatos que exige el XSD, expresadas sobre el
 * modelo para que los mensajes apunten a la propiedad correcta.
 */

const HASH_RE = /^[0-9A-F]{64}$/;
/** NumSerieFactura: ASCII 32–126 salvo `"` (34), `'` (39), `<` (60), `=` (61) y `>` (62). Validaciones v1.2.2 §3.1. */
const INVOICE_NUMBER_RE = /^[\x20\x21\x23-\x26\x28-\x3B\x3F-\x7E]+$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

const REF_VALIDACIONES = 'Validaciones v1.2.2';

function text(
  c: Collector,
  value: string | undefined,
  path: string,
  max: number,
  { required = true } = {},
): void {
  if (value === undefined) {
    if (required) c.add(path, 'format.required', 'Campo obligatorio.');
    return;
  }
  if (required && value.trim() === '')
    c.add(path, 'format.required', 'Campo obligatorio: no puede estar vacío.');
  c.check(
    value.length <= max,
    path,
    'format.max-length',
    `Máximo ${max} caracteres (tiene ${value.length}).`,
  );
}

function nif(c: Collector, value: string, path: string): void {
  c.check(
    value.length === 9,
    path,
    'format.nif',
    `El NIF debe tener 9 caracteres: ${JSON.stringify(value)}.`,
    {
      aeatCode: 4109,
    },
  );
}

function noSurroundingSpaces(c: Collector, value: string, path: string): void {
  // Decisión D1 (docs/SPEC-NOTES.md): la huella se calcula sin espacios al inicio y al final; se
  // exige que el valor no los tenga para que el XML y la huella coincidan sin ambigüedad.
  c.check(
    value === value.trim(),
    path,
    'format.surrounding-spaces',
    'No puede empezar ni terminar con espacios.',
  );
}

/**
 * @param strict aplicar la lista de caracteres de NumSerieFactura (§3.1.3.1), que solo rige para
 *   el IDFactura del propio registro; las facturas rectificadas o sustituidas pueden ser anteriores.
 */
export function invoiceIdentifier(
  c: Collector,
  id: InvoiceIdentifier,
  path: string,
  strict = true,
): void {
  nif(c, id.issuerId, `${path}.issuerId`);
  const n = id.invoiceNumber;
  if (
    c.check(
      n.length >= 1 && n.length <= 60,
      `${path}.invoiceNumber`,
      'format.invoice-number-length',
      'El número de serie debe tener entre 1 y 60 caracteres.',
    )
  ) {
    c.check(
      !strict || INVOICE_NUMBER_RE.test(n),
      `${path}.invoiceNumber`,
      'format.invoice-number-chars',
      'El número de serie solo admite caracteres ASCII imprimibles (32–126) salvo " \' < > =.',
      { reference: `${REF_VALIDACIONES} §3.1` },
    );
    if (strict) noSurroundingSpaces(c, n, `${path}.invoiceNumber`);
  }
  c.check(
    isIsoDate(id.issueDate),
    `${path}.issueDate`,
    'format.date',
    `Fecha no válida (AAAA-MM-DD): ${JSON.stringify(id.issueDate)}.`,
    {
      aeatCode: 4106,
    },
  );
}

export function party(c: Collector, p: Party, path: string): void {
  text(c, p.name, `${path}.name`, 120);
  if ('nif' in p) {
    nif(c, p.nif, `${path}.nif`);
  } else {
    if (p.country !== undefined) {
      c.check(
        COUNTRY_RE.test(p.country),
        `${path}.country`,
        'format.country',
        'Código de país ISO 3166-1 alfa-2 en mayúsculas.',
      );
    }
    text(c, p.value, `${path}.value`, 20);
  }
}

function amount(c: Collector, value: string | undefined, path: string): void {
  if (value === undefined) return;
  c.check(
    isAmount(value),
    path,
    'format.amount',
    `Importe con formato no válido (máx. 12 enteros y 2 decimales): ${JSON.stringify(value)}.`,
  );
}

function rate(c: Collector, value: string | undefined, path: string): void {
  if (value === undefined) return;
  c.check(
    isRate(value),
    path,
    'format.rate',
    `Tipo con formato no válido (máx. 3 enteros y 2 decimales): ${JSON.stringify(value)}.`,
  );
}

function breakdownLine(c: Collector, line: BreakdownDetails, path: string): void {
  amount(c, line.baseAmount, `${path}.baseAmount`);
  amount(c, line.costBaseAmount, `${path}.costBaseAmount`);
  amount(c, line.taxAmount, `${path}.taxAmount`);
  amount(c, line.surchargeAmount, `${path}.surchargeAmount`);
  rate(c, line.taxRate, `${path}.taxRate`);
  rate(c, line.surchargeRate, `${path}.surchargeRate`);
}

function computerSystem(c: Collector, s: ComputerSystem, path: string): void {
  text(c, s.vendorName, `${path}.vendorName`, 120);
  if (s.vendorNif !== undefined) nif(c, s.vendorNif, `${path}.vendorNif`);
  if (s.vendorForeignId !== undefined)
    text(c, s.vendorForeignId.value, `${path}.vendorForeignId.value`, 20);
  c.check(
    (s.vendorNif === undefined) !== (s.vendorForeignId === undefined),
    path,
    'format.vendor-id',
    'Hay que informar exactamente uno de vendorNif o vendorForeignId.',
  );
  text(c, s.name, `${path}.name`, 30);
  text(c, s.id, `${path}.id`, 2);
  text(c, s.version, `${path}.version`, 50);
  text(c, s.installationNumber, `${path}.installationNumber`, 100);
}

export function formatRules(record: InvoiceRecord, c: Collector): void {
  invoiceIdentifier(c, record.invoiceId, 'invoiceId');
  text(c, record.externalReference, 'externalReference', 60, { required: false });
  computerSystem(c, record.system, 'system');
  c.check(
    isDateTimeWithOffset(record.hashedAt),
    'hashedAt',
    'format.datetime',
    'Fecha y hora no válida (AAAA-MM-DDThh:mm:ss±hh:mm).',
  );
  c.check(
    HASH_RE.test(record.hash),
    'hash',
    'format.hash',
    'La huella debe tener 64 caracteres hexadecimales en mayúsculas.',
  );
  if (record.previous) {
    invoiceIdentifier(c, record.previous.invoiceId, 'previous.invoiceId', false);
    c.check(
      HASH_RE.test(record.previous.hash),
      'previous.hash',
      'format.previous-hash',
      'La huella del registro anterior debe tener 64 caracteres hexadecimales en mayúsculas.',
      {
        severity: 'admisible',
        aeatCode: 2002,
        reference: `${REF_VALIDACIONES} §18`,
      },
    );
  }

  if (record.kind === 'cancellation') {
    if (record.generator) party(c, record.generator, 'generator');
    return;
  }

  text(c, record.issuerName, 'issuerName', 120);
  text(c, record.description, 'description', 500);
  text(c, record.billingAgreementNumber, 'billingAgreementNumber', 15, { required: false });
  text(c, record.systemAgreementId, 'systemAgreementId', 16, { required: false });
  if (record.operationDate !== undefined) {
    c.check(
      isIsoDate(record.operationDate),
      'operationDate',
      'format.date',
      'Fecha no válida (AAAA-MM-DD).',
      { aeatCode: 4106 },
    );
  }
  record.correctedInvoices?.forEach((id, i) => {
    invoiceIdentifier(c, id, `correctedInvoices[${i}]`, false);
  });
  record.replacedInvoices?.forEach((id, i) => {
    invoiceIdentifier(c, id, `replacedInvoices[${i}]`, false);
  });
  c.check(
    (record.correctedInvoices?.length ?? 0) <= 1000,
    'correctedInvoices',
    'format.max-count',
    'Máximo 1000 facturas rectificadas.',
  );
  c.check(
    (record.replacedInvoices?.length ?? 0) <= 1000,
    'replacedInvoices',
    'format.max-count',
    'Máximo 1000 facturas sustituidas.',
  );
  amount(c, record.correctedBaseAmount, 'correctedBaseAmount');
  amount(c, record.correctedTaxAmount, 'correctedTaxAmount');
  amount(c, record.correctedSurchargeAmount, 'correctedSurchargeAmount');
  if (record.thirdParty) party(c, record.thirdParty, 'thirdParty');
  c.check(
    record.recipients.length <= 1000,
    'recipients',
    'format.max-count',
    'Máximo 1000 destinatarios.',
  );
  record.recipients.forEach((r, i) => {
    party(c, r, `recipients[${i}]`);
  });
  c.check(
    record.breakdown.length >= 1 && record.breakdown.length <= 12,
    'breakdown',
    'format.breakdown-count',
    `El desglose debe tener entre 1 y 12 líneas (tiene ${record.breakdown.length}).`,
  );
  record.breakdown.forEach((line, i) => {
    breakdownLine(c, line, `breakdown[${i}]`);
  });
  amount(c, record.totalTaxAmount, 'totalTaxAmount');
  amount(c, record.totalAmount, 'totalAmount');
}
