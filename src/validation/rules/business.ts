import {
  amountToCents,
  isAmount,
  isRate,
  rateToHundredths,
  taxCents,
} from '../../common/amount.ts';
import { isIsoDate } from '../../common/dates.ts';
import type { ComputerSystem } from '../../models/computer-system.ts';
import type { InvoiceType, RegimeType } from '../../models/enums.ts';
import type { ForeignFiscalIdentifier, Party } from '../../models/identifiers.ts';
import type {
  BreakdownDetails,
  CancellationRecord,
  InvoiceRecord,
  RegistrationRecord,
} from '../../models/records.ts';
import type { Collector } from '../collector.ts';
import type { ValidationContext } from '../validate.ts';
import { isValidVatNumber } from './vat.ts';

/**
 * Reglas de negocio del documento «Validaciones y errores» v1.2.2 de la AEAT (08/04/2026).
 *
 * Cada regla indica su sección (§) y el código de error de la AEAT (`errores.properties`). Se
 * implementan solo las que se pueden comprobar con los datos del registro; las que dependen del
 * censo o del estado en la AEAT (NIF identificado, duplicados, existencia del acuerdo…) no.
 *
 * Diferencias deliberadas con Verifactu-PHP (ver docs/PHP-CORRESPONDENCE.md):
 * - Tolerancias de ±10,00 € de la AEAT en lugar de ±0,01/0,02 €.
 * - No se exige recargo de equivalencia con la clave 18: la AEAT eliminó esa regla (v1.0.7/v1.1.2).
 * - No se exige que una anulación tenga registro anterior (el XSD admite PrimerRegistro).
 */

const REF = 'Validaciones v1.2.2';
const TOLERANCE_CENTS = 1000n; // ±10,00 €
const MIN_ISSUE_DATE = '2024-10-28'; // entrada en vigor de la Orden HAC/1177/2024 (§3.1.3.1)

const CORRECTIVE: readonly InvoiceType[] = ['R1', 'R2', 'R3', 'R4', 'R5'];
const NEEDS_RECIPIENTS: readonly InvoiceType[] = ['F1', 'F3', 'R1', 'R2', 'R3', 'R4'];
/** Lista L8A (IVA). */
const L8A: readonly RegimeType[] = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '14',
  '15',
  '17',
  '18',
  '19',
  '20',
];
/** Lista L8B (IGIC) más los valores adicionales 20 y 21 (§15.6, §15.6.11). */
const L8B_EXTENDED: readonly RegimeType[] = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '14',
  '15',
  '17',
  '18',
  '19',
  '20',
  '21',
];
/** Claves admitidas con IPSI (§15.6). */
const IPSI_REGIMES: readonly RegimeType[] = ['01', '08', '11', '18', '19', '20'];
/** Claves que excluyen la comprobación de CuotaTotal e ImporteTotal (§16, §17). */
const TOTALS_EXEMPT_REGIMES: readonly RegimeType[] = ['03', '05', '06', '08', '09'];

/** Tipos de IVA admitidos (en centésimas), §15.1. */
const VAT_RATES = [0n, 200n, 400n, 500n, 750n, 1000n, 2100n];
/** Tipos de recargo de equivalencia admitidos (en centésimas), §15.3. */
const SURCHARGE_RATES = [0n, 26n, 50n, 62n, 100n, 140n, 175n, 520n];

const ctxRef = (section: string) => `${REF} §${section}`;

/** Fecha actual en Europe/Madrid (`AAAA-MM-DD`). */
export function todayInMadrid(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addYears(isoDate: string, years: number): string {
  const y = Number(isoDate.slice(0, 4)) + years;
  return `${String(y).padStart(4, '0')}${isoDate.slice(4)}`;
}

const cents = (v: string | undefined): bigint | undefined =>
  v !== undefined && isAmount(v) ? amountToCents(v) : undefined;
const hundredths = (v: string | undefined): bigint | undefined =>
  v !== undefined && isRate(v) ? rateToHundredths(v) : undefined;
const abs = (v: bigint): bigint => (v < 0n ? -v : v);
const sign = (v: bigint): number => (v > 0n ? 1 : v < 0n ? -1 : 0);
const between = (date: string, from: string, to: string): boolean => date >= from && date <= to;

// ---------------------------------------------------------------------------------------------

export function businessRules(
  record: InvoiceRecord,
  c: Collector,
  context: ValidationContext,
): void {
  const today = context.today ?? todayInMadrid();
  if (context.taxpayerNif !== undefined) {
    c.check(
      record.invoiceId.issuerId === context.taxpayerNif,
      'invoiceId.issuerId',
      'business.issuer-matches-taxpayer',
      'El NIF del emisor debe coincidir con el del obligado a expedir (ObligadoEmision) de la cabecera.',
      { aeatCode: 1108, reference: ctxRef(record.kind === 'registration' ? '3.1.3.1' : '3.1.4.1') },
    );
  }
  computerSystem(record.system, c);
  if (record.previous?.hash === record.hash) {
    c.add(
      'previous.hash',
      'business.previous-hash-equals-hash',
      'La huella del registro anterior no puede ser igual a la del registro actual.',
      {
        severity: 'admisible',
        aeatCode: 2008,
      },
    );
  }
  if (record.kind === 'registration') registration(record, c, today);
  else cancellation(record, c);
}

// ---------------------------------------------------------------------------------------------
// Identificaciones (IDOtro)

type PartyRole = 'recipient' | 'thirdParty' | 'generator' | 'system';

function foreignId(
  c: Collector,
  p: Pick<ForeignFiscalIdentifier, 'country' | 'type' | 'value'>,
  path: string,
  role: PartyRole,
  operationDate: string | undefined,
): void {
  const { country, type, value } = p;
  if (type !== '02') {
    c.check(
      country !== undefined,
      `${path}.country`,
      'business.country-required',
      'El código de país es obligatorio cuando el tipo de identificación no es NIF-IVA (02).',
      {
        aeatCode: 1111,
      },
    );
  } else {
    if (
      c.check(
        isValidVatNumber(value, operationDate),
        `${path}.value`,
        'business.vat-number-format',
        `El NIF-IVA ${JSON.stringify(value)} no tiene la estructura de ningún Estado miembro.`,
        {
          aeatCode: 1103,
          reference: `${REF} nota (1)`,
        },
      )
    ) {
      const prefix = country === 'GR' ? 'EL' : country;
      if (prefix !== undefined) {
        c.check(
          value.startsWith(prefix),
          `${path}.country`,
          'business.vat-country-mismatch',
          'El código de país no coincide con los dos primeros caracteres del NIF-IVA.',
          {
            aeatCode: 1122,
          },
        );
      }
    }
  }
  if (role === 'recipient') {
    if (type === '07')
      c.check(
        country === 'ES',
        `${path}.country`,
        'business.unregistered-country',
        'Con tipo No censado (07) el código de país debe ser ES.',
        { aeatCode: 1126 },
      );
    if (country === 'ES')
      c.check(
        type === '03' || type === '07',
        `${path}.type`,
        'business.es-foreign-id-type',
        'Con país ES solo se admite Pasaporte (03) o No censado (07).',
        { aeatCode: 1234 },
      );
  } else {
    if (role !== 'generator') {
      c.check(
        type !== '07',
        `${path}.type`,
        'business.unregistered-not-allowed',
        'No se admite el tipo de identificación No censado (07).',
        {
          aeatCode: role === 'thirdParty' ? 1211 : 1221,
        },
      );
      if (country === 'ES')
        c.check(
          type === '03',
          `${path}.type`,
          'business.es-foreign-id-type',
          'Con país ES solo se admite Pasaporte (03).',
          { aeatCode: 1232 },
        );
    }
  }
}

function computerSystem(s: ComputerSystem, c: Collector): void {
  const ref = ctxRef('3.1.5');
  c.check(
    /^[A-Z0-9]{2}$/.test(s.id),
    'system.id',
    'business.system-id',
    'IdSistemaInformatico debe tener 2 posiciones, cada una letra mayúscula (salvo Ñ) o dígito.',
    {
      aeatCode: 1177,
      reference: ref,
    },
  );
  if (s.vendorForeignId)
    foreignId(c, s.vendorForeignId, 'system.vendorForeignId', 'system', undefined);
}

// ---------------------------------------------------------------------------------------------
// Registro de alta (§3.1.3)

function registration(r: RegistrationRecord, c: Collector, today: string): void {
  const id = r.invoiceId;
  const issueDate = id.issueDate;
  const validIssueDate = isIsoDate(issueDate);
  const opDate =
    r.operationDate !== undefined && isIsoDate(r.operationDate) ? r.operationDate : undefined;
  /** Fecha de referencia para tipos impositivos: FechaOperacion o, si no hay, FechaExpedicion. */
  const refDate = opDate ?? (validIssueDate ? issueDate : undefined);
  const lines = r.breakdown;
  const taxOf = (l: BreakdownDetails) => l.taxType ?? '01';
  const isVatOrIgic = (l: BreakdownDetails) => taxOf(l) === '01' || taxOf(l) === '03';
  const hasDeferredRegime = lines.some(
    (l) => isVatOrIgic(l) && (l.regimeType === '14' || l.regimeType === '15'),
  );
  const isCorrective = CORRECTIVE.includes(r.invoiceType);

  // §3.1.3.1 IDFactura
  if (validIssueDate) {
    c.check(
      issueDate <= today,
      'invoiceId.issueDate',
      'business.issue-date-future',
      'La fecha de expedición no puede ser posterior a la fecha actual.',
      { aeatCode: 1112, reference: ctxRef('3.1.3.1') },
    );
    c.check(
      issueDate >= MIN_ISSUE_DATE,
      'invoiceId.issueDate',
      'business.issue-date-min',
      'La fecha de expedición no puede ser anterior al 28/10/2024.',
      { aeatCode: 1152, reference: ctxRef('3.1.3.1') },
    );
    if (opDate !== undefined && issueDate < opDate) {
      c.check(
        hasDeferredRegime,
        'invoiceId.issueDate',
        'business.issue-before-operation',
        'La fecha de expedición solo puede ser anterior a la de operación con ClaveRegimen 14 o 15 (IVA o IGIC).',
        {
          aeatCode: 1146,
          reference: ctxRef('3.1.3.1'),
        },
      );
    }
  }

  // §3.1.3.2 RechazoPrevio
  if (r.priorRejection === 'X')
    c.check(
      r.isCorrection,
      'priorRejection',
      'business.prior-rejection-x',
      'RechazoPrevio = X exige Subsanacion = S.',
      { aeatCode: 1153, reference: ctxRef('3.1.3.2') },
    );
  if (r.priorRejection === 'S')
    c.check(
      r.isCorrection,
      'priorRejection',
      'business.prior-rejection-s',
      'RechazoPrevio = S exige Subsanacion = S.',
      { aeatCode: 1161, reference: ctxRef('3.1.3.2') },
    );

  // §3.1.3.3–6 Rectificativas y sustitutivas
  if (isCorrective)
    c.check(
      r.correctiveType !== undefined,
      'correctiveType',
      'business.corrective-type-required',
      'Las facturas rectificativas (R1–R5) deben indicar el tipo de rectificativa.',
      { aeatCode: 1114, reference: ctxRef('3.1.3.3') },
    );
  else
    c.check(
      r.correctiveType === undefined,
      'correctiveType',
      'business.corrective-type-forbidden',
      'Solo las facturas rectificativas (R1–R5) pueden indicar el tipo de rectificativa.',
      { aeatCode: 1115, reference: ctxRef('3.1.3.3') },
    );
  if (!isCorrective)
    c.check(
      !r.correctedInvoices?.length,
      'correctedInvoices',
      'business.corrected-invoices-forbidden',
      'Solo las facturas rectificativas pueden informar facturas rectificadas.',
      { aeatCode: 1117, reference: ctxRef('3.1.3.4') },
    );
  if (r.invoiceType !== 'F3')
    c.check(
      !r.replacedInvoices?.length,
      'replacedInvoices',
      'business.replaced-invoices-forbidden',
      'Solo las facturas F3 pueden informar facturas sustituidas.',
      { aeatCode: 1116, reference: ctxRef('3.1.3.5') },
    );
  const hasCorrectionAmounts =
    r.correctedBaseAmount !== undefined ||
    r.correctedTaxAmount !== undefined ||
    r.correctedSurchargeAmount !== undefined;
  if (r.correctiveType === 'S') {
    c.check(
      r.correctedBaseAmount !== undefined && r.correctedTaxAmount !== undefined,
      'correctedBaseAmount',
      'business.correction-amounts-required',
      'Las rectificativas por sustitución deben informar la base y la cuota rectificadas (ImporteRectificacion).',
      {
        aeatCode: 1118,
        reference: ctxRef('3.1.3.6'),
      },
    );
  } else {
    c.check(
      !hasCorrectionAmounts,
      'correctedBaseAmount',
      'business.correction-amounts-forbidden',
      'ImporteRectificacion solo se informa en rectificativas por sustitución (TipoRectificativa = S).',
      {
        aeatCode: 1119,
        reference: ctxRef('3.1.3.6'),
      },
    );
  }

  // §3.1.3.7 FechaOperacion
  if (opDate !== undefined) {
    c.check(
      opDate >= addYears(today, -20),
      'operationDate',
      'business.operation-date-min',
      'La fecha de operación no puede ser anterior a la fecha actual menos veinte años.',
      { aeatCode: 1134, reference: ctxRef('3.1.3.7') },
    );
    c.check(
      opDate <= `${Number(today.slice(0, 4)) + 1}-12-31`,
      'operationDate',
      'business.operation-date-max',
      'La fecha de operación no puede ser posterior al año siguiente al actual.',
      { aeatCode: 1125, reference: ctxRef('3.1.3.7') },
    );
    if (opDate > today) {
      c.check(
        hasDeferredRegime,
        'operationDate',
        'business.operation-date-future',
        'La fecha de operación solo puede ser futura con ClaveRegimen 14 o 15 (IVA o IGIC).',
        { aeatCode: 1173, reference: ctxRef('3.1.3.7') },
      );
    }
  }

  // §3.1.3.8–10
  if (r.isSimplifiedArt7273 === true)
    c.check(
      ['F1', 'F3', 'R1', 'R2', 'R3', 'R4'].includes(r.invoiceType),
      'isSimplifiedArt7273',
      'business.art7273-type',
      'FacturaSimplificadaArt7273 = S solo con TipoFactura F1, F3 o R1–R4.',
      { aeatCode: 1183, reference: ctxRef('3.1.3.8') },
    );
  if (r.isWithoutRecipientArt61d === true)
    c.check(
      r.invoiceType === 'F2' || r.invoiceType === 'R5',
      'isWithoutRecipientArt61d',
      'business.art61d-type',
      'FacturaSinIdentifDestinatarioArt61d = S solo con TipoFactura F2 o R5.',
      { aeatCode: 1185, reference: ctxRef('3.1.3.9') },
    );
  const total = cents(r.totalAmount);
  if (total !== undefined) {
    const isMacro = abs(total) >= 10_000_000_000n;
    if (isMacro)
      c.check(
        r.isMacrodata === true,
        'isMacrodata',
        'business.macrodata-required',
        'Con un importe total de 100.000.000 € o más hay que informar Macrodato = S.',
        { aeatCode: 1139, reference: ctxRef('3.1.3.10') },
      );
    else
      c.check(
        r.isMacrodata !== true,
        'isMacrodata',
        'business.macrodata-forbidden',
        'Macrodato = S solo si el importe total es de 100.000.000 € o más.',
        { aeatCode: 1138, reference: ctxRef('3.1.3.10') },
      );
  }

  // §3.1.3.11–12 Tercero
  if (r.issuedBy === 'T')
    c.check(
      r.thirdParty !== undefined,
      'thirdParty',
      'business.third-party-required',
      'Con EmitidaPorTerceroODestinatario = T hay que informar el bloque Tercero.',
      { aeatCode: 1186, reference: ctxRef('3.1.3.11') },
    );
  if (r.issuedBy === 'D')
    c.check(
      r.recipients.length > 0,
      'recipients',
      'business.recipients-required-d',
      'Con EmitidaPorTerceroODestinatario = D hay que informar los destinatarios.',
      { aeatCode: 1158, reference: ctxRef('3.1.3.11') },
    );
  if (r.thirdParty) {
    c.check(
      r.issuedBy === 'T',
      'thirdParty',
      'business.third-party-forbidden',
      'El bloque Tercero solo se informa con EmitidaPorTerceroODestinatario = T.',
      { aeatCode: r.issuedBy === undefined ? 1155 : 1187, reference: ctxRef('3.1.3.12') },
    );
    partyRules(c, r.thirdParty, 'thirdParty', 'thirdParty', refDate, r.invoiceId.issuerId);
  }

  // §3.1.3.13 Destinatarios
  if (NEEDS_RECIPIENTS.includes(r.invoiceType)) {
    c.check(
      r.recipients.length > 0,
      'recipients',
      'business.recipients-required',
      `Las facturas ${r.invoiceType} deben tener al menos un destinatario.`,
      { aeatCode: 1189, reference: ctxRef('3.1.3.13') },
    );
  } else {
    c.check(
      r.recipients.length === 0,
      'recipients',
      'business.recipients-forbidden',
      `Las facturas ${r.invoiceType} no pueden tener destinatarios.`,
      { aeatCode: 1190, reference: ctxRef('3.1.3.13') },
    );
  }
  r.recipients.forEach((p, i) => {
    const path = `recipients[${i}]`;
    partyRules(c, p, path, 'recipient', refDate, undefined);
    if ('nif' in p) return;
    if (p.type === '02')
      c.check(
        NEEDS_RECIPIENTS.includes(r.invoiceType),
        `${path}.type`,
        'business.vat-recipient-type',
        'Un destinatario con NIF-IVA (02) solo se admite en facturas F1, F3 y R1–R4.',
        { aeatCode: 1156, reference: ctxRef('3.1.3.13') },
      );
    if (r.invoiceType === 'R3')
      c.check(
        p.type === '07',
        `${path}.type`,
        'business.r3-recipient',
        'En facturas R3 el destinatario solo puede identificarse con NIF o No censado (07).',
        { aeatCode: 1191 },
      );
    if (r.invoiceType === 'R2')
      c.check(
        p.type === '07' || p.type === '02',
        `${path}.type`,
        'business.r2-recipient',
        'En facturas R2 el destinatario solo puede identificarse con NIF, NIF-IVA (02) o No censado (07).',
        { aeatCode: 1192 },
      );
  });

  // §3.1.3.14 Cupón
  if (r.hasCoupon === true)
    c.check(
      r.invoiceType === 'R1' || r.invoiceType === 'R5',
      'hasCoupon',
      'business.coupon-type',
      'Cupon = S solo con TipoFactura R1 o R5.',
      { aeatCode: 1157, reference: ctxRef('3.1.3.14') },
    );

  // §15.6.9 ClaveRegimen 14 (IVA pendiente de devengo con AAPP)
  if (lines.some((l) => isVatOrIgic(l) && l.regimeType === '14')) {
    const ref = ctxRef('15.6.9');
    c.check(
      opDate !== undefined && validIssueDate && opDate > issueDate,
      'operationDate',
      'business.regime-14-date',
      'Con ClaveRegimen 14 la fecha de operación es obligatoria y posterior a la de expedición.',
      { aeatCode: 1147, reference: ref },
    );
    c.check(
      r.recipients.every((p) => 'nif' in p && /^[PQSV]/.test(p.nif)),
      'recipients',
      'business.regime-14-recipients',
      'Con ClaveRegimen 14 todos los destinatarios deben tener NIF que empiece por P, Q, S o V.',
      { aeatCode: 1149, reference: ref },
    );
    c.check(
      ['F1', 'R1', 'R2', 'R3', 'R4'].includes(r.invoiceType),
      'invoiceType',
      'business.regime-14-type',
      'Con ClaveRegimen 14 TipoFactura debe ser F1 o R1–R4.',
      { aeatCode: 1148, reference: ref },
    );
  }

  // §3.1.3.15 Desglose
  lines.forEach((l, i) => {
    breakdownLine(c, l, `breakdown[${i}]`, r, refDate, today);
  });

  // §15.8 Simplificadas
  if (
    r.invoiceType === 'F2' &&
    r.billingAgreementNumber === undefined &&
    r.isWithoutRecipientArt61d !== true
  ) {
    let sum = 0n;
    for (const l of lines) sum += (cents(l.baseAmount) ?? 0n) + (cents(l.taxAmount) ?? 0n);
    c.check(
      sum <= 300_000n + TOLERANCE_CENTS,
      'breakdown',
      'business.simplified-limit',
      'En facturas simplificadas (F2) la suma de bases y cuotas no puede superar 3.000 € (+10 €).',
      { aeatCode: 1150, reference: ctxRef('15.8') },
    );
  }

  // §16–17 Totales (admisibles)
  if (
    !lines.some((l) => l.regimeType !== undefined && TOTALS_EXEMPT_REGIMES.includes(l.regimeType))
  ) {
    let tax = 0n;
    let amount = 0n;
    for (const l of lines) {
      const t = (cents(l.taxAmount) ?? 0n) + (cents(l.surchargeAmount) ?? 0n);
      tax += t;
      amount += (cents(l.baseAmount) ?? 0n) + t;
    }
    const totalTax = cents(r.totalTaxAmount);
    if (totalTax !== undefined) {
      c.check(
        abs(totalTax - tax) <= TOLERANCE_CENTS,
        'totalTaxAmount',
        'business.total-tax-mismatch',
        'La cuota total no coincide con la suma de cuotas y recargos del desglose (margen ±10 €).',
        {
          severity: 'admisible',
          aeatCode: 2006,
          reference: ctxRef('16'),
        },
      );
    }
    if (total !== undefined) {
      c.check(
        abs(total - amount) <= TOLERANCE_CENTS,
        'totalAmount',
        'business.total-amount-mismatch',
        'El importe total no coincide con la suma de bases, cuotas y recargos del desglose (margen ±10 €).',
        {
          severity: 'admisible',
          aeatCode: 2005,
          reference: ctxRef('17'),
        },
      );
    }
  }
}

function partyRules(
  c: Collector,
  p: Party,
  path: string,
  role: PartyRole,
  refDate: string | undefined,
  issuerNif: string | undefined,
): void {
  if ('nif' in p) {
    if (role === 'thirdParty' && issuerNif !== undefined) {
      c.check(
        p.nif !== issuerNif,
        `${path}.nif`,
        'business.third-party-nif',
        'El NIF del tercero debe ser distinto del NIF del emisor.',
        { aeatCode: 1188 },
      );
    }
    return;
  }
  foreignId(c, p, path, role, refDate);
}

function breakdownLine(
  c: Collector,
  l: BreakdownDetails,
  path: string,
  r: RegistrationRecord,
  refDate: string | undefined,
  today: string,
): void {
  const tax = l.taxType ?? '01';
  const vat = tax === '01';
  const vatOrIgic = vat || tax === '03';
  const op = l.operationType;
  const exempt = op.startsWith('E');
  const regime = l.regimeType;
  const rate = hundredths(l.taxRate);
  const surchargeRate = hundredths(l.surchargeRate);
  const taxAmount = cents(l.taxAmount);
  const base = cents(l.baseAmount);
  const costBase = cents(l.costBaseAmount);

  // §15.6 ClaveRegimen
  if (tax === '05') {
    c.check(
      regime === undefined,
      `${path}.regimeType`,
      'business.regime-forbidden',
      'ClaveRegimen solo se informa con impuesto IVA (01), IPSI (02) o IGIC (03).',
      { aeatCode: 1260, reference: ctxRef('15.6') },
    );
  } else if (regime === undefined) {
    if (tax === '02')
      c.add(
        `${path}.regimeType`,
        'business.regime-required-ipsi',
        'Con IPSI hay que informar ClaveRegimen.',
        { severity: 'admisible', aeatCode: 2009, reference: ctxRef('15.6') },
      );
    else
      c.add(
        `${path}.regimeType`,
        'business.regime-required',
        'Con IVA o IGIC hay que informar ClaveRegimen.',
        { aeatCode: 1245, reference: ctxRef('15.6') },
      );
  } else if (vat) {
    c.check(
      L8A.includes(regime),
      `${path}.regimeType`,
      'business.regime-list',
      `La clave de régimen ${regime} no está en la lista L8A (IVA).`,
      { aeatCode: 1246, reference: ctxRef('15.6') },
    );
  } else if (tax === '03') {
    c.check(
      L8B_EXTENDED.includes(regime),
      `${path}.regimeType`,
      'business.regime-list',
      `La clave de régimen ${regime} no está admitida con IGIC.`,
      { aeatCode: 1246, reference: ctxRef('15.6') },
    );
  } else {
    // IPSI: aviso hasta el 31/12/2026 y rechazo desde el 01/01/2027 (§15.6).
    c.check(
      IPSI_REGIMES.includes(regime),
      `${path}.regimeType`,
      'business.regime-list',
      `La clave de régimen ${regime} no está admitida con IPSI.`,
      {
        severity: today >= '2027-01-01' ? 'error' : 'admisible',
        aeatCode: 1246,
        reference: ctxRef('15.6'),
      },
    );
  }

  // §15.2 BaseImponibleACoste
  if (l.costBaseAmount !== undefined) {
    c.check(
      regime === '06' || tax === '02' || tax === '05',
      `${path}.costBaseAmount`,
      'business.cost-base-forbidden',
      'BaseImponibleACoste solo se admite con ClaveRegimen 06 o impuesto IPSI (02) u Otros (05).',
      { aeatCode: 1257, reference: ctxRef('15.2') },
    );
  }

  // §15.4 CalificacionOperacion
  if (op === 'S2') {
    c.check(
      NEEDS_RECIPIENTS.includes(r.invoiceType),
      `${path}.operationType`,
      'business.s2-invoice-type',
      'Con S2 (inversión del sujeto pasivo) TipoFactura solo puede ser F1, F3 o R1–R4.',
      { aeatCode: 1197, reference: ctxRef('15.4') },
    );
    c.check(
      rate === 0n && taxAmount === 0n,
      `${path}.taxRate`,
      'business.s2-zero',
      'Con S2 el tipo impositivo y la cuota repercutida deben informarse con valor 0.',
      { aeatCode: 1198, reference: ctxRef('15.4') },
    );
  }
  if ((op === 'N1' || op === 'N2') && vat) {
    c.check(
      l.taxRate === undefined &&
        l.taxAmount === undefined &&
        l.surchargeRate === undefined &&
        l.surchargeAmount === undefined,
      path,
      'business.non-subject-amounts',
      'En operaciones no sujetas (N1, N2) con IVA no se informan tipo, cuota ni recargo.',
      { aeatCode: 1237, reference: ctxRef('15.4') },
    );
  }

  // §15.5 OperacionExenta
  if (exempt) {
    if (op === 'E7' || op === 'E8')
      c.check(
        tax === '03',
        `${path}.operationType`,
        'business.exempt-list',
        `La exención ${op} solo se admite con IGIC.`,
        { aeatCode: 1182, reference: ctxRef('15.5') },
      );
    if (vatOrIgic && regime === '01')
      c.check(
        op !== 'E2' && op !== 'E3',
        `${path}.operationType`,
        'business.exempt-regime-01',
        'Con ClaveRegimen 01 no se admiten las exenciones E2 y E3.',
        { aeatCode: 1199, reference: ctxRef('15.5') },
      );
    c.check(
      l.taxRate === undefined &&
        l.taxAmount === undefined &&
        l.surchargeRate === undefined &&
        l.surchargeAmount === undefined,
      path,
      'business.exempt-amounts',
      'En operaciones exentas no se informan tipo, cuota ni recargo.',
      { aeatCode: 1238, reference: ctxRef('15.5') },
    );
    if (op === 'E5' && vat) {
      c.check(
        r.recipients.every((p) => !('nif' in p)),
        'recipients',
        'business.e5-recipients',
        'Con la exención E5 (IVA) los destinatarios deben identificarse con IDOtro.',
        { aeatCode: 1289, reference: ctxRef('15.5.1') },
      );
    }
  }

  // §15.6.1–11 Reglas por clave de régimen (IVA/IGIC salvo indicación)
  if (vatOrIgic && regime !== undefined) {
    switch (regime) {
      case '02':
        c.check(
          exempt,
          `${path}.operationType`,
          'business.regime-02',
          'Con ClaveRegimen 02 (exportación) solo se admite OperacionExenta.',
          { aeatCode: 1286, reference: ctxRef('15.6.1') },
        );
        break;
      case '03':
        c.check(
          exempt || op === 'S1',
          `${path}.operationType`,
          'business.regime-03',
          'Con ClaveRegimen 03 (REBU) la calificación solo puede ser S1.',
          { aeatCode: 1200, reference: ctxRef('15.6.2') },
        );
        break;
      case '04':
        c.check(
          exempt || op === 'S2',
          `${path}.operationType`,
          'business.regime-04',
          'Con ClaveRegimen 04 (oro de inversión) solo se admite S2 u operación exenta.',
          { aeatCode: 1201, reference: ctxRef('15.6.3') },
        );
        break;
      case '06':
        c.check(
          !['F2', 'F3', 'R5'].includes(r.invoiceType) && l.costBaseAmount !== undefined,
          `${path}.costBaseAmount`,
          'business.regime-06',
          'Con ClaveRegimen 06 TipoFactura no puede ser F2, F3 ni R5 y BaseImponibleACoste es obligatoria.',
          { aeatCode: 1202, reference: ctxRef('15.6.4') },
        );
        break;
      case '07':
        c.check(
          !['S2', 'N1', 'N2', 'E2', 'E3', 'E4', 'E5'].includes(op),
          `${path}.operationType`,
          'business.regime-07',
          'Con ClaveRegimen 07 (criterio de caja) no se admiten S2, N1, N2 ni las exenciones E2–E5.',
          { aeatCode: 1203, reference: ctxRef('15.6.5') },
        );
        break;
      case '08':
        c.check(
          op === 'N2',
          `${path}.operationType`,
          'business.regime-08',
          'Con ClaveRegimen 08 la calificación debe ser N2.',
          { aeatCode: 1252, reference: ctxRef('15.6.6') },
        );
        break;
      case '10':
        c.check(
          op === 'N1' && r.invoiceType === 'F1' && r.recipients.every((p) => 'nif' in p),
          `${path}.operationType`,
          'business.regime-10',
          'Con ClaveRegimen 10 la calificación debe ser N1, TipoFactura F1 y todos los destinatarios con NIF.',
          { aeatCode: 1205, reference: ctxRef('15.6.7') },
        );
        break;
      case '11':
        if (vat)
          c.check(
            rate === undefined || rate === 2100n,
            `${path}.taxRate`,
            'business.regime-11',
            'Con ClaveRegimen 11 (arrendamiento de local) solo se admite el tipo del 21 %.',
            { aeatCode: 1206, reference: ctxRef('15.6.8') },
          );
        break;
      case '20':
        if (tax === '03')
          c.check(
            op === 'N2',
            `${path}.operationType`,
            'business.regime-20-igic',
            'Con IGIC y ClaveRegimen 20 la calificación debe ser N2.',
            { aeatCode: 1293, reference: ctxRef('15.6.10') },
          );
        break;
      case '01':
      case '05':
      case '09':
      case '15':
      case '17':
      case '18':
      case '19':
      case '21':
      case '14': // comprobada a nivel de registro
        break;
    }
  }

  // §15.1 TipoImpositivo y §15.3 TipoRecargoEquivalencia (IVA, S1)
  if (vat && op === 'S1') {
    if (rate !== undefined) {
      if (
        c.check(
          VAT_RATES.includes(rate),
          `${path}.taxRate`,
          'business.vat-rate-list',
          'Tipo de IVA no admitido (0, 2, 4, 5, 7,5, 10 o 21 %).',
          { aeatCode: 1124, reference: ctxRef('15.1') },
        ) &&
        refDate !== undefined
      ) {
        if (rate === 500n)
          c.check(
            between(refDate, '2022-07-01', '2024-09-30'),
            `${path}.taxRate`,
            'business.vat-rate-5',
            'El tipo del 5 % solo se admite para operaciones entre el 01/07/2022 y el 30/09/2024.',
            { aeatCode: 1194, reference: ctxRef('15.1') },
          );
        if (rate === 200n || rate === 750n)
          c.check(
            between(refDate, '2024-10-01', '2024-12-31'),
            `${path}.taxRate`,
            'business.vat-rate-2-7.5',
            'Los tipos del 2 % y del 7,5 % solo se admiten para operaciones entre el 01/10/2024 y el 31/12/2024.',
            { aeatCode: rate === 200n ? 1235 : 1236, reference: ctxRef('15.1') },
          );
      }
    }
    if (surchargeRate !== undefined) {
      if (
        c.check(
          SURCHARGE_RATES.includes(surchargeRate),
          `${path}.surchargeRate`,
          'business.surcharge-rate-list',
          'Tipo de recargo de equivalencia no admitido.',
          { aeatCode: 1127, reference: ctxRef('15.3') },
        ) &&
        rate !== undefined
      ) {
        surchargeForRate(c, rate, surchargeRate, `${path}.surchargeRate`, refDate);
      }
    }
  }
  if (l.surchargeRate !== undefined || l.surchargeAmount !== undefined) {
    if (!exempt && op !== 'N1' && op !== 'N2') {
      c.check(
        op === 'S1',
        `${path}.surchargeRate`,
        'business.surcharge-s1-only',
        'El recargo de equivalencia solo se informa con calificación S1.',
        { aeatCode: 1281 },
      );
    }
    c.check(
      l.surchargeRate !== undefined && l.surchargeAmount !== undefined,
      `${path}.surchargeAmount`,
      'business.surcharge-pair',
      'El tipo y la cuota del recargo de equivalencia se informan juntos.',
      { aeatCode: 1284 },
    );
  }

  // §15.7 CuotaRepercutida
  if (taxAmount !== undefined && taxAmount !== 0n) {
    c.check(
      op === 'S1',
      `${path}.taxAmount`,
      'business.tax-amount-s1-only',
      'La cuota repercutida solo puede ser distinta de 0 con calificación S1.',
      { aeatCode: 1207, reference: ctxRef('15.7') },
    );
  }
  if (op === 'S1') {
    const required = c.check(
      l.taxRate !== undefined && l.taxAmount !== undefined,
      `${path}.taxAmount`,
      'business.s1-required',
      'Con calificación S1 el tipo impositivo y la cuota repercutida son obligatorios.',
      {
        aeatCode: costBase === undefined ? 1208 : 1209,
        reference: ctxRef('15.7'),
      },
    );
    const skipCheck = r.correctiveType === 'I' || r.invoiceType === 'R2' || r.invoiceType === 'R3';
    const taxBase = costBase ?? base;
    if (
      required &&
      !skipCheck &&
      taxBase !== undefined &&
      taxAmount !== undefined &&
      l.taxRate !== undefined &&
      isRate(l.taxRate)
    ) {
      if (taxAmount !== 0n && taxBase !== 0n) {
        c.check(
          sign(taxAmount) === sign(taxBase),
          `${path}.taxAmount`,
          'business.tax-amount-sign',
          'La cuota repercutida y la base deben tener el mismo signo.',
          { aeatCode: costBase === undefined ? 1143 : 1140, reference: ctxRef('15.7') },
        );
      }
      const expected = taxCents(taxBase, l.taxRate);
      c.check(
        abs(taxAmount - expected) <= TOLERANCE_CENTS,
        `${path}.taxAmount`,
        'business.tax-amount-mismatch',
        'La cuota repercutida no corresponde a base × tipo (margen ±10 €).',
        {
          aeatCode: costBase === undefined ? 1142 : 1144,
          reference: ctxRef('15.7'),
        },
      );
    }
  }
}

/** Correspondencia entre tipo de IVA y tipo de recargo de equivalencia (§15.3). */
function surchargeForRate(
  c: Collector,
  rate: bigint,
  surcharge: bigint,
  path: string,
  refDate: string | undefined,
): void {
  const add = (ok: boolean, message: string, aeatCode: number) =>
    c.check(ok, path, 'business.surcharge-for-rate', message, {
      aeatCode,
      reference: ctxRef('15.3'),
    });
  const d = refDate;
  switch (rate) {
    case 2100n:
      add(
        surcharge === 520n || surcharge === 175n,
        'Con IVA al 21 % el recargo debe ser 5,2 % o 1,75 %.',
        1162,
      );
      break;
    case 1000n:
      add(surcharge === 140n, 'Con IVA al 10 % el recargo debe ser 1,4 %.', 1163);
      break;
    case 750n:
      add(
        surcharge === 100n && (d === undefined || between(d, '2024-10-01', '2024-12-31')),
        'Con IVA al 7,5 % el recargo debe ser 1 % (operaciones del 01/10/2024 al 31/12/2024).',
        1169,
      );
      break;
    case 500n:
      if (d !== undefined && d <= '2022-12-31')
        add(
          surcharge === 50n,
          'Con IVA al 5 % hasta el 31/12/2022 el recargo debe ser 0,5 %.',
          1167,
        );
      else if (d !== undefined && between(d, '2023-01-01', '2024-09-30'))
        add(
          surcharge === 62n,
          'Con IVA al 5 % entre el 01/01/2023 y el 30/09/2024 el recargo debe ser 0,62 %.',
          1168,
        );
      else
        add(
          surcharge === 50n || surcharge === 62n,
          'Con IVA al 5 % el recargo debe ser 0,5 % o 0,62 %.',
          1160,
        );
      break;
    case 400n:
      add(surcharge === 50n, 'Con IVA al 4 % el recargo debe ser 0,5 %.', 1164);
      break;
    case 200n:
      add(surcharge === 26n, 'Con IVA al 2 % el recargo debe ser 0,26 %.', 1166);
      break;
    case 0n:
      if (d !== undefined && between(d, '2023-01-01', '2024-09-30'))
        add(
          surcharge === 0n,
          'Con IVA al 0 % entre el 01/01/2023 y el 30/09/2024 el recargo debe ser 0 %.',
          1165,
        );
      else if (d !== undefined && d >= '2024-10-01')
        add(
          surcharge === 26n,
          'Con IVA al 0 % desde el 01/10/2024 el recargo debe ser 0,26 %.',
          1170,
        );
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------------------------
// Registro de anulación (§3.1.4)

function cancellation(r: CancellationRecord, c: Collector): void {
  const ref = ctxRef('3.1.4');
  c.check(
    (r.generatedBy === undefined) === (r.generator === undefined),
    r.generatedBy === undefined ? 'generatedBy' : 'generator',
    'business.generator-pair',
    'GeneradoPor y el bloque Generador se informan juntos.',
    { aeatCode: 1224, reference: ref },
  );
  const g = r.generator;
  if (!g) return;
  if ('nif' in g) {
    c.check(
      g.nif !== r.invoiceId.issuerId,
      'generator.nif',
      'business.generator-nif',
      'El NIF del generador debe ser distinto del NIF del obligado a expedir.',
      { aeatCode: 1259, reference: ref },
    );
    return;
  }
  c.check(
    r.generatedBy !== 'E',
    'generator',
    'business.generator-e-nif',
    'Con GeneradoPor = E el generador debe identificarse con NIF.',
    { aeatCode: 1227, reference: ref },
  );
  foreignId(c, g, 'generator', 'generator', undefined);
  if (r.generatedBy === 'D' && g.country === 'ES') {
    c.check(
      g.type === '03' || g.type === '07',
      'generator.type',
      'business.generator-d-es',
      'Con GeneradoPor = D y país ES el tipo debe ser Pasaporte (03) o No censado (07).',
      { aeatCode: 1230, reference: ref },
    );
  }
  if (r.generatedBy === 'T') {
    if (g.country === 'ES')
      c.check(
        g.type === '03',
        'generator.type',
        'business.generator-t-es',
        'Con GeneradoPor = T y país ES el tipo debe ser Pasaporte (03).',
        { aeatCode: 1232, reference: ref },
      );
    c.check(
      g.type !== '07',
      'generator.type',
      'business.generator-t-07',
      'Con GeneradoPor = T no se admite No censado (07).',
      { aeatCode: 1229, reference: ref },
    );
  }
}
