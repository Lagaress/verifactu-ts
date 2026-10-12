import { describe, expect, it } from 'vitest';
import {
  createRegistrationRecord,
  validateRecord,
  ValidationError,
  type BreakdownDetails,
  type RegistrationRecordInput,
} from '../../../src/index.ts';
import { f1Input } from '../../helpers.ts';

const TODAY = '2025-07-01';

/** Crea el registro sin validar y devuelve las reglas incumplidas como `regla:severidad`. */
async function violations(
  overrides: Partial<RegistrationRecordInput>,
  today = TODAY,
): Promise<string[]> {
  const record = await createRegistrationRecord(f1Input(overrides), { validate: false });
  return validateRecord(record, { today }).map((v) => `${v.rule}:${v.severity}`);
}

/** Línea S1 al 21 % con cambios; un valor `undefined` elimina la propiedad. */
const line = (
  l: { [K in keyof BreakdownDetails]?: BreakdownDetails[K] | undefined } = {},
): BreakdownDetails => {
  const merged = {
    taxType: '01',
    regimeType: '01',
    operationType: 'S1',
    taxRate: '21.00',
    baseAmount: '100.00',
    taxAmount: '21.00',
    ...l,
  };
  return Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined),
  ) as unknown as BreakdownDetails;
};

/** Desglose con totales coherentes. */
function withLines(
  lines: BreakdownDetails[],
  extra: Partial<RegistrationRecordInput> = {},
): Partial<RegistrationRecordInput> {
  const c = (v?: string) => Math.round(Number(v ?? 0) * 100);
  const tax = lines.reduce((s, l) => s + c(l.taxAmount) + c(l.surchargeAmount), 0);
  const total = lines.reduce((s, l) => s + c(l.baseAmount), 0) + tax;
  return {
    breakdown: lines,
    totalTaxAmount: (tax / 100).toFixed(2),
    totalAmount: (total / 100).toFixed(2),
    ...extra,
  };
}

describe('alta válida', () => {
  it('un F1 normal no tiene violaciones', async () => {
    expect(await violations({})).toEqual([]);
  });

  it('createRegistrationRecord lanza ValidationError con todas las violaciones', async () => {
    const promise = createRegistrationRecord(
      f1Input({
        invoiceType: 'F2',
        invoiceId: { issuerId: 'X', invoiceNumber: ' A ', issueDate: '2025-02-30' },
      }),
    );
    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    await expect(promise).rejects.toThrow(/invoiceId\.issuerId/);
  });
});

describe.each<[string, Partial<RegistrationRecordInput>, string[]]>([
  // ---- formato -------------------------------------------------------------------------------
  [
    'NIF de 8 caracteres',
    { invoiceId: { issuerId: 'A0000000', invoiceNumber: 'X', issueDate: '2025-06-01' } },
    ['format.nif:error'],
  ],
  [
    'número de serie con espacios al inicio',
    { invoiceId: { issuerId: 'A00000000', invoiceNumber: ' X-1', issueDate: '2025-06-01' } },
    ['format.surrounding-spaces:error'],
  ],
  [
    'número de serie con «=»',
    { invoiceId: { issuerId: 'A00000000', invoiceNumber: 'X=1', issueDate: '2025-06-01' } },
    ['format.invoice-number-chars:error'],
  ],
  [
    'número de serie con «ñ»',
    { invoiceId: { issuerId: 'A00000000', invoiceNumber: 'AÑO-1', issueDate: '2025-06-01' } },
    ['format.invoice-number-chars:error'],
  ],
  [
    'número de serie de 61 caracteres',
    {
      invoiceId: { issuerId: 'A00000000', invoiceNumber: 'X'.repeat(61), issueDate: '2025-06-01' },
    },
    ['format.invoice-number-length:error'],
  ],
  ['descripción vacía', { description: ' ' }, ['format.required:error']],
  ['descripción de 501 caracteres', { description: 'x'.repeat(501) }, ['format.max-length:error']],
  [
    'desglose vacío',
    { breakdown: [], totalTaxAmount: '0', totalAmount: '0' },
    ['format.breakdown-count:error'],
  ],
  [
    '13 líneas de desglose',
    withLines(Array.from({ length: 13 }, () => line())),
    ['format.breakdown-count:error'],
  ],
  [
    'huella anterior en minúsculas',
    {
      previous: {
        invoiceId: { issuerId: 'A00000000', invoiceNumber: 'P', issueDate: '2025-05-01' },
        hash: 'a'.repeat(64),
      },
    },
    ['format.previous-hash:admisible'],
  ],
  // ---- §3.1.3.1 fechas -----------------------------------------------------------------------
  [
    'fecha de expedición futura',
    { invoiceId: { issuerId: 'A00000000', invoiceNumber: 'X', issueDate: '2025-07-02' } },
    ['business.issue-date-future:error'],
  ],
  [
    'fecha de expedición anterior al 28/10/2024',
    { invoiceId: { issuerId: 'A00000000', invoiceNumber: 'X', issueDate: '2024-10-27' } },
    ['business.issue-date-min:error'],
  ],
  [
    'expedición anterior a la operación sin clave 14/15',
    { operationDate: '2025-06-15' },
    ['business.issue-before-operation:error'],
  ],
  [
    'operación futura sin clave 14/15',
    { operationDate: '2025-08-01' },
    ['business.issue-before-operation:error', 'business.operation-date-future:error'],
  ],
  [
    'operación más allá del año siguiente',
    withLines([line({ regimeType: '15' })], { operationDate: '2027-01-01' }),
    ['business.operation-date-max:error'],
  ],
  [
    'operación hace más de veinte años',
    { operationDate: '2005-06-30' },
    ['business.operation-date-min:error'],
  ],
  [
    'tracto sucesivo (15) con operación futura',
    withLines([line({ regimeType: '15' })], { operationDate: '2025-09-01' }),
    [],
  ],
  // ---- §3.1.3.2 RechazoPrevio ----------------------------------------------------------------
  [
    'RechazoPrevio X sin subsanación',
    { priorRejection: 'X' },
    ['business.prior-rejection-x:error'],
  ],
  [
    'RechazoPrevio S sin subsanación',
    { priorRejection: 'S' },
    ['business.prior-rejection-s:error'],
  ],
  ['subsanación con RechazoPrevio X', { isCorrection: true, priorRejection: 'X' }, []],
  ['subsanación con RechazoPrevio S', { isCorrection: true, priorRejection: 'S' }, []],
  ['subsanación con RechazoPrevio N', { isCorrection: true, priorRejection: 'N' }, []],
  // ---- §3.1.3.3–6 rectificativas -------------------------------------------------------------
  [
    'R1 sin tipo de rectificativa',
    { invoiceType: 'R1' },
    ['business.corrective-type-required:error'],
  ],
  [
    'F1 con tipo de rectificativa',
    { correctiveType: 'I' },
    ['business.corrective-type-forbidden:error'],
  ],
  [
    'R1 por diferencias',
    {
      invoiceType: 'R1',
      correctiveType: 'I',
      correctedInvoices: [{ issuerId: 'A00000000', invoiceNumber: 'F-1', issueDate: '2025-05-01' }],
    },
    [],
  ],
  [
    'R1 por sustitución sin ImporteRectificacion',
    { invoiceType: 'R1', correctiveType: 'S' },
    ['business.correction-amounts-required:error'],
  ],
  [
    'R1 por sustitución con importes a cero',
    { invoiceType: 'R1', correctiveType: 'S', correctedBaseAmount: '0', correctedTaxAmount: '0' },
    [],
  ],
  [
    'R1 por diferencias con ImporteRectificacion',
    {
      invoiceType: 'R1',
      correctiveType: 'I',
      correctedBaseAmount: '1',
      correctedTaxAmount: '0.21',
    },
    ['business.correction-amounts-forbidden:error'],
  ],
  [
    'F1 con facturas rectificadas',
    {
      correctedInvoices: [{ issuerId: 'A00000000', invoiceNumber: 'F-1', issueDate: '2025-05-01' }],
    },
    ['business.corrected-invoices-forbidden:error'],
  ],
  [
    'F1 con facturas sustituidas',
    {
      replacedInvoices: [{ issuerId: 'A00000000', invoiceNumber: 'S-1', issueDate: '2025-05-01' }],
    },
    ['business.replaced-invoices-forbidden:error'],
  ],
  [
    'F3 con facturas sustituidas',
    {
      invoiceType: 'F3',
      replacedInvoices: [{ issuerId: 'A00000000', invoiceNumber: 'S-1', issueDate: '2025-05-01' }],
    },
    [],
  ],
  ['R5 sin destinatarios', { invoiceType: 'R5', correctiveType: 'I', recipients: [] }, []],
  // ---- §3.1.3.8–14 ---------------------------------------------------------------------------
  [
    'F2 con Art. 72/73',
    { invoiceType: 'F2', recipients: [], isSimplifiedArt7273: true },
    ['business.art7273-type:error'],
  ],
  [
    'F1 sin destinatario art. 6.1.d',
    { isWithoutRecipientArt61d: true },
    ['business.art61d-type:error'],
  ],
  [
    'macrodato sin indicador',
    withLines([line({ baseAmount: '99999999.00', taxAmount: '20999999.79' })]),
    ['business.macrodata-required:error'],
  ],
  [
    'macrodato S con importe pequeño',
    { isMacrodata: true },
    ['business.macrodata-forbidden:error'],
  ],
  [
    'emitida por tercero sin bloque Tercero',
    { issuedBy: 'T' },
    ['business.third-party-required:error'],
  ],
  [
    'tercero sin EmitidaPorTercero',
    { thirdParty: { name: 'T', nif: 'B00000000' } },
    ['business.third-party-forbidden:error'],
  ],
  [
    'tercero con el NIF del emisor',
    { issuedBy: 'T', thirdParty: { name: 'T', nif: 'A00000000' } },
    ['business.third-party-nif:error'],
  ],
  [
    'tercero no censado',
    { issuedBy: 'T', thirdParty: { name: 'T', country: 'ES', type: '07', value: '12345678Z' } },
    ['business.unregistered-not-allowed:error', 'business.es-foreign-id-type:error'],
  ],
  ['autofactura (D) con destinatario', { issuedBy: 'D' }, []],
  ['F1 sin destinatarios', { recipients: [] }, ['business.recipients-required:error']],
  ['F2 con destinatario', { invoiceType: 'F2' }, ['business.recipients-forbidden:error']],
  [
    'emisor y destinatario con el mismo NIF (autoconsumo)',
    { recipients: [{ name: 'Yo', nif: 'A00000000' }] },
    [],
  ],
  [
    'destinatario extranjero sin país',
    { recipients: [{ name: 'X', type: '04', value: 'ID-1' }] },
    ['business.country-required:error'],
  ],
  [
    'destinatario NIF-IVA válido',
    { recipients: [{ name: 'X', country: 'PT', type: '02', value: 'PT999999999' }] },
    [],
  ],
  [
    'destinatario NIF-IVA griego (EL)',
    { recipients: [{ name: 'X', country: 'GR', type: '02', value: 'EL123456789' }] },
    [],
  ],
  [
    'destinatario NIF-IVA con estructura incorrecta',
    { recipients: [{ name: 'X', country: 'PT', type: '02', value: 'PT12' }] },
    ['business.vat-number-format:error'],
  ],
  [
    'destinatario NIF-IVA de otro país',
    { recipients: [{ name: 'X', country: 'FR', type: '02', value: 'PT999999999' }] },
    ['business.vat-country-mismatch:error'],
  ],
  [
    'destinatario GB tras el Brexit',
    { recipients: [{ name: 'X', type: '02', value: 'GB123456789' }] },
    ['business.vat-number-format:error'],
  ],
  [
    'destinatario XI tras el Brexit',
    { recipients: [{ name: 'X', type: '02', value: 'XI123456789' }] },
    [],
  ],
  [
    'destinatario no censado fuera de ES',
    { recipients: [{ name: 'X', country: 'FR', type: '07', value: '1' }] },
    ['business.unregistered-country:error'],
  ],
  [
    'destinatario ES con pasaporte',
    { recipients: [{ name: 'X', country: 'ES', type: '03', value: 'PAS123' }] },
    [],
  ],
  [
    'destinatario ES con residencia',
    { recipients: [{ name: 'X', country: 'ES', type: '05', value: 'R1' }] },
    ['business.es-foreign-id-type:error'],
  ],
  [
    'R3 con destinatario NIF-IVA',
    {
      invoiceType: 'R3',
      correctiveType: 'I',
      recipients: [{ name: 'X', type: '02', value: 'PT999999999' }],
    },
    ['business.r3-recipient:error'],
  ],
  [
    'R2 con destinatario pasaporte',
    {
      invoiceType: 'R2',
      correctiveType: 'I',
      recipients: [{ name: 'X', country: 'FR', type: '03', value: 'P1' }],
    },
    ['business.r2-recipient:error'],
  ],
  ['cupón en F1', { hasCoupon: true }, ['business.coupon-type:error']],
  ['cupón en R1', { invoiceType: 'R1', correctiveType: 'I', hasCoupon: true }, []],
  // ---- §15.8 simplificadas ---------------------------------------------------------------------
  [
    'F2 de 3.010 €',
    withLines([line({ baseAmount: '2487.60', taxAmount: '522.40' })], {
      invoiceType: 'F2',
      recipients: [],
    }),
    [],
  ],
  [
    'F2 de 3.010,01 €',
    withLines([line({ baseAmount: '2487.61', taxAmount: '522.40' })], {
      invoiceType: 'F2',
      recipients: [],
    }),
    ['business.simplified-limit:error'],
  ],
  [
    'F2 de 4.000 € con acuerdo de facturación',
    withLines([line({ baseAmount: '3305.79', taxAmount: '694.21' })], {
      invoiceType: 'F2',
      recipients: [],
      billingAgreementNumber: 'ACU-1',
    }),
    [],
  ],
  // ---- §16–17 totales (admisibles) ------------------------------------------------------------
  ['cuota total desviada 10 €', { totalTaxAmount: '31.00', totalAmount: '131.00' }, []],
  [
    'cuota total desviada 10,01 €',
    { totalTaxAmount: '31.01', totalAmount: '121.00' },
    ['business.total-tax-mismatch:admisible'],
  ],
  [
    'importe total desviado 10,01 €',
    { totalAmount: '131.01' },
    ['business.total-amount-mismatch:admisible'],
  ],
  [
    'totales sin comprobar con REBU (03)',
    withLines([line({ regimeType: '03' })], { totalAmount: '999.00' }),
    [],
  ],
  [
    'varias líneas con totales coherentes (Verifactu-PHP)',
    withLines([
      line({ baseAmount: '12.34', taxAmount: '2.59' }),
      line({ taxRate: '10', baseAmount: '543.21', taxAmount: '54.31' }),
    ]),
    [],
  ],
])('%s', (_name, overrides, expected) => {
  it(expected.length ? `incumple ${expected.join(', ')}` : 'es válido', async () => {
    expect(await violations(overrides)).toEqual(expected);
  });
});

describe.each<[string, BreakdownDetails[], Partial<RegistrationRecordInput>, string[]]>([
  // ---- §15.6 ClaveRegimen ---------------------------------------------------------------------
  [
    'IVA sin clave de régimen',
    [line({ regimeType: undefined })],
    {},
    ['business.regime-required:error'],
  ],
  [
    'impuesto omitido (IVA) sin clave',
    [{ operationType: 'S1', taxRate: '21', baseAmount: '100', taxAmount: '21' }],
    {},
    ['business.regime-required:error'],
  ],
  [
    'IVA con clave 21 (solo IGIC)',
    [line({ regimeType: '21' })],
    {},
    ['business.regime-list:error'],
  ],
  [
    'IGIC con clave 21',
    [line({ taxType: '03', regimeType: '21', taxRate: '7', taxAmount: '7.00' })],
    {},
    [],
  ],
  [
    'IPSI sin clave',
    [line({ taxType: '02', regimeType: undefined, taxRate: '4', taxAmount: '4.00' })],
    {},
    ['business.regime-required-ipsi:admisible'],
  ],
  [
    'IPSI con clave 02 en 2026',
    [line({ taxType: '02', regimeType: '02', taxRate: '4', taxAmount: '4.00' })],
    {},
    ['business.regime-list:admisible'],
  ],
  [
    'Otros con clave de régimen',
    [line({ taxType: '05' })],
    {},
    ['business.regime-forbidden:error'],
  ],
  [
    'Otros sin clave',
    [line({ taxType: '05', regimeType: undefined, taxRate: '3', taxAmount: '3.00' })],
    {},
    [],
  ],
  // ---- §15.1 tipos de IVA ---------------------------------------------------------------------
  ['IVA al 4 %', [line({ taxRate: '4', taxAmount: '4.00' })], {}, []],
  ['IVA al 10 %', [line({ taxRate: '10', taxAmount: '10.00' })], {}, []],
  ['IVA al 0 %', [line({ taxRate: '0', taxAmount: '0' })], {}, []],
  [
    'IVA al 16 %',
    [line({ taxRate: '16', taxAmount: '16.00' })],
    {},
    ['business.vat-rate-list:error'],
  ],
  [
    'IVA al 5 % en 2025',
    [line({ taxRate: '5', taxAmount: '5.00' })],
    {},
    ['business.vat-rate-5:error'],
  ],
  [
    'IVA al 5 % con operación en 2024',
    [line({ taxRate: '5', taxAmount: '5.00' })],
    { operationDate: '2024-06-01' },
    [],
  ],
  [
    'IVA al 2 % en 2025',
    [line({ taxRate: '2', taxAmount: '2.00' })],
    {},
    ['business.vat-rate-2-7.5:error'],
  ],
  [
    'IVA al 7,5 % en diciembre de 2024',
    [line({ taxRate: '7.5', taxAmount: '7.50' })],
    { operationDate: '2024-12-01' },
    [],
  ],
  // ---- §15.3 recargo de equivalencia ----------------------------------------------------------
  [
    'recargo 5,2 % con IVA 21 %',
    [line({ regimeType: '18', surchargeRate: '5.2', surchargeAmount: '5.20' })],
    {},
    [],
  ],
  [
    'recargo 1,75 % con IVA 21 % (tabaco)',
    [line({ regimeType: '18', surchargeRate: '1.75', surchargeAmount: '1.75' })],
    {},
    [],
  ],
  [
    'recargo 1,4 % con IVA 21 %',
    [line({ surchargeRate: '1.4', surchargeAmount: '1.40' })],
    {},
    ['business.surcharge-for-rate:error'],
  ],
  [
    'recargo 1,4 % con IVA 10 %',
    [line({ taxRate: '10', taxAmount: '10.00', surchargeRate: '1.4', surchargeAmount: '1.40' })],
    {},
    [],
  ],
  [
    'recargo 0,5 % con IVA 4 %',
    [line({ taxRate: '4', taxAmount: '4.00', surchargeRate: '0.5', surchargeAmount: '0.50' })],
    {},
    [],
  ],
  [
    'recargo 0,26 % con IVA 0 % (desde 10/2024)',
    [line({ taxRate: '0', taxAmount: '0', surchargeRate: '0.26', surchargeAmount: '0.26' })],
    {},
    [],
  ],
  [
    'recargo 3 % no admitido',
    [line({ surchargeRate: '3', surchargeAmount: '3.00' })],
    {},
    ['business.surcharge-rate-list:error'],
  ],
  ['recargo sin cuota', [line({ surchargeRate: '5.2' })], {}, ['business.surcharge-pair:error']],
  [
    'recargo en operación S2',
    [
      line({
        operationType: 'S2',
        taxRate: '0',
        taxAmount: '0',
        surchargeRate: '0',
        surchargeAmount: '0',
      }),
    ],
    {},
    ['business.surcharge-s1-only:error'],
  ],
  [
    'recargo de equivalencia sin clave 18 (regla PHP obsoleta)',
    [line({ surchargeRate: '5.2', surchargeAmount: '5.20' })],
    {},
    [],
  ],
  ['clave 18 sin recargo (regla PHP obsoleta)', [line({ regimeType: '18' })], {}, []],
  // ---- §15.4 calificación -----------------------------------------------------------------------
  [
    'inversión del sujeto pasivo (S2)',
    [line({ operationType: 'S2', taxRate: '0', taxAmount: '0' })],
    {},
    [],
  ],
  [
    'S2 con cuota',
    [line({ operationType: 'S2' })],
    {},
    ['business.s2-zero:error', 'business.tax-amount-s1-only:error'],
  ],
  [
    'S2 en F2',
    [line({ operationType: 'S2', taxRate: '0', taxAmount: '0' })],
    { invoiceType: 'F2', recipients: [] },
    ['business.s2-invoice-type:error'],
  ],
  [
    'no sujeta N1',
    [{ taxType: '01', regimeType: '01', operationType: 'N1', baseAmount: '100.00' }],
    {},
    [],
  ],
  [
    'no sujeta N2 con tipo',
    [{ taxType: '01', regimeType: '01', operationType: 'N2', baseAmount: '100.00', taxRate: '21' }],
    {},
    ['business.non-subject-amounts:error'],
  ],
  // ---- §15.5 exentas ----------------------------------------------------------------------------
  [
    'exenta E1',
    [{ taxType: '01', regimeType: '01', operationType: 'E1', baseAmount: '100.00' }],
    {},
    [],
  ],
  [
    'exenta con cuota',
    [
      {
        taxType: '01',
        regimeType: '01',
        operationType: 'E1',
        baseAmount: '100.00',
        taxAmount: '0',
      },
    ],
    {},
    ['business.exempt-amounts:error'],
  ],
  [
    'exenta E2 con clave 01',
    [{ taxType: '01', regimeType: '01', operationType: 'E2', baseAmount: '100.00' }],
    {},
    ['business.exempt-regime-01:error'],
  ],
  [
    'exportación E2 con clave 02',
    [{ taxType: '01', regimeType: '02', operationType: 'E2', baseAmount: '100.00' }],
    {},
    [],
  ],
  ['exportación con S1', [line({ regimeType: '02' })], {}, ['business.regime-02:error']],
  [
    'E7 con IVA',
    [{ taxType: '01', regimeType: '01', operationType: 'E7', baseAmount: '100.00' }],
    {},
    ['business.exempt-list:error'],
  ],
  [
    'E7 con IGIC',
    [{ taxType: '03', regimeType: '01', operationType: 'E7', baseAmount: '100.00' }],
    {},
    [],
  ],
  [
    'entrega intracomunitaria E5 con destinatario NIF',
    [{ taxType: '01', regimeType: '01', operationType: 'E5', baseAmount: '100.00' }],
    {},
    ['business.e5-recipients:error'],
  ],
  [
    'entrega intracomunitaria E5 con NIF-IVA',
    [{ taxType: '01', regimeType: '01', operationType: 'E5', baseAmount: '100.00' }],
    { recipients: [{ name: 'X', type: '02', value: 'DE123456789' }] },
    [],
  ],
  // ---- §15.6.x claves concretas ------------------------------------------------------------------
  [
    'REBU (03) con S2',
    [line({ regimeType: '03', operationType: 'S2', taxRate: '0', taxAmount: '0' })],
    {},
    ['business.regime-03:error'],
  ],
  ['oro de inversión (04) con S1', [line({ regimeType: '04' })], {}, ['business.regime-04:error']],
  [
    'grupo de entidades (06) sin base a coste',
    [line({ regimeType: '06' })],
    {},
    ['business.regime-06:error'],
  ],
  [
    'grupo de entidades (06) con base a coste',
    [line({ regimeType: '06', costBaseAmount: '80.00', taxAmount: '16.80' })],
    {},
    [],
  ],
  [
    'base a coste con clave 01',
    [line({ costBaseAmount: '80.00', taxAmount: '16.80' })],
    {},
    ['business.cost-base-forbidden:error'],
  ],
  [
    'criterio de caja (07) con N1',
    [{ taxType: '01', regimeType: '07', operationType: 'N1', baseAmount: '100.00' }],
    {},
    ['business.regime-07:error'],
  ],
  ['clave 08 con S1', [line({ regimeType: '08' })], {}, ['business.regime-08:error']],
  [
    'clave 08 con N2',
    [{ taxType: '01', regimeType: '08', operationType: 'N2', baseAmount: '100.00' }],
    {},
    [],
  ],
  [
    'cobro por cuenta de terceros (10) con N1',
    [{ taxType: '01', regimeType: '10', operationType: 'N1', baseAmount: '100.00' }],
    {},
    [],
  ],
  [
    'cobro por cuenta de terceros (10) con S1',
    [line({ regimeType: '10' })],
    {},
    ['business.regime-10:error'],
  ],
  [
    'arrendamiento de local (11) al 10 %',
    [line({ regimeType: '11', taxRate: '10', taxAmount: '10.00' })],
    {},
    ['business.regime-11:error'],
  ],
  [
    'IVA pendiente AAPP (14) correcto',
    [line({ regimeType: '14' })],
    { operationDate: '2025-09-01', recipients: [{ name: 'Ayuntamiento', nif: 'P0000000J' }] },
    [],
  ],
  [
    'IVA pendiente AAPP (14) sin fecha de operación ni AAPP',
    [line({ regimeType: '14' })],
    {},
    ['business.regime-14-date:error', 'business.regime-14-recipients:error'],
  ],
  [
    'IGIC con clave 20 y S1',
    [line({ taxType: '03', regimeType: '20', taxRate: '7', taxAmount: '7.00' })],
    {},
    ['business.regime-20-igic:error'],
  ],
  // ---- §15.7 cuota repercutida -----------------------------------------------------------------
  ['cuota desviada 10 €', [line({ taxAmount: '31.00' })], {}, []],
  [
    'cuota desviada 10,01 €',
    [line({ taxAmount: '31.01' })],
    {},
    ['business.tax-amount-mismatch:error'],
  ],
  [
    'cuota con signo contrario',
    [line({ baseAmount: '-10.00', taxAmount: '2.10' })],
    {},
    ['business.tax-amount-sign:error'],
  ],
  ['abono con signo coherente', [line({ baseAmount: '-100.00', taxAmount: '-21.00' })], {}, []],
  [
    'cuota desviada en rectificativa por diferencias (no se comprueba)',
    [line({ taxAmount: '50.00' })],
    { invoiceType: 'R1', correctiveType: 'I' },
    [],
  ],
  [
    'S1 sin tipo impositivo',
    [
      {
        taxType: '01',
        regimeType: '01',
        operationType: 'S1',
        baseAmount: '100.00',
        taxAmount: '21.00',
      },
    ],
    {},
    ['business.s1-required:error'],
  ],
  [
    'redondeo de cuota (Verifactu-PHP): 11,22 al 10 % = 1,13',
    [line({ taxRate: '10', baseAmount: '11.22', taxAmount: '1.13' })],
    {},
    [],
  ],
])('desglose: %s', (_name, lines, extra, expected) => {
  it(expected.length ? `incumple ${expected.join(', ')}` : 'es válido', async () => {
    expect(await violations(withLines(lines, extra))).toEqual(expected);
  });
});

describe('reglas dependientes de la fecha', () => {
  it('IPSI con clave no admitida es rechazo desde 2027', async () => {
    const lines = withLines(
      [line({ taxType: '02', regimeType: '02', taxRate: '4', taxAmount: '4.00' })],
      {
        invoiceId: { issuerId: 'A00000000', invoiceNumber: 'X', issueDate: '2027-01-02' },
      },
    );
    expect(await violations(lines, '2027-01-02')).toEqual(['business.regime-list:error']);
  });

  it('comprueba el NIF del obligado de la cabecera si se indica', async () => {
    const record = await createRegistrationRecord(f1Input());
    expect(
      validateRecord(record, { today: TODAY, taxpayerNif: 'B00000000' }).map((v) => v.aeatCode),
    ).toEqual([1108]);
  });
});
