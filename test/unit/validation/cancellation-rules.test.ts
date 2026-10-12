import { describe, expect, it } from 'vitest';
import {
  createCancellationRecord,
  validateRecord,
  type CancellationRecordInput,
  type ComputerSystem,
} from '../../../src/index.ts';
import { SYSTEM } from '../../helpers.ts';

const base: CancellationRecordInput = {
  invoiceId: { issuerId: 'A00000000', invoiceNumber: 'PRUEBA-0001', issueDate: '2025-06-01' },
  previous: {
    invoiceId: { issuerId: 'A00000000', invoiceNumber: 'PRUEBA-0001', issueDate: '2025-06-01' },
    hash: 'A'.repeat(64),
  },
  system: SYSTEM,
  hashedAt: '2025-06-01T10:20:30+02:00',
};

async function violations(overrides: Partial<CancellationRecordInput>): Promise<string[]> {
  const record = await createCancellationRecord({ ...base, ...overrides }, { validate: false });
  return validateRecord(record, { today: '2025-07-01' }).map((v) => `${v.rule}:${v.severity}`);
}

describe.each<[string, Partial<CancellationRecordInput>, string[]]>([
  ['anulación normal', {}, []],
  [
    'anulación sin registro previo y por rechazo',
    { withoutPriorRecord: true, isPriorRejection: true },
    [],
  ],
  ['anulación como primer registro (lo admite el XSD)', { previous: null }, []],
  ['GeneradoPor sin Generador', { generatedBy: 'D' }, ['business.generator-pair:error']],
  [
    'Generador sin GeneradoPor',
    { generator: { name: 'G', nif: 'B00000000' } },
    ['business.generator-pair:error'],
  ],
  [
    'generador destinatario con NIF',
    { generatedBy: 'D', generator: { name: 'G', nif: 'B00000000' } },
    [],
  ],
  [
    'generador con el NIF del emisor',
    { generatedBy: 'T', generator: { name: 'G', nif: 'A00000000' } },
    ['business.generator-nif:error'],
  ],
  [
    'GeneradoPor E sin NIF',
    { generatedBy: 'E', generator: { name: 'G', country: 'FR', type: '04', value: 'X' } },
    ['business.generator-e-nif:error'],
  ],
  [
    'GeneradoPor D, ES con residencia',
    { generatedBy: 'D', generator: { name: 'G', country: 'ES', type: '05', value: 'X' } },
    ['business.generator-d-es:error'],
  ],
  [
    'GeneradoPor D, ES no censado',
    { generatedBy: 'D', generator: { name: 'G', country: 'ES', type: '07', value: 'X' } },
    [],
  ],
  [
    'GeneradoPor T no censado',
    { generatedBy: 'T', generator: { name: 'G', country: 'FR', type: '07', value: 'X' } },
    ['business.generator-t-07:error'],
  ],
  [
    'GeneradoPor T, ES con no censado',
    { generatedBy: 'T', generator: { name: 'G', country: 'ES', type: '07', value: 'X' } },
    ['business.generator-t-es:error', 'business.generator-t-07:error'],
  ],
  [
    'huella anterior igual a la propia',
    { previous: { invoiceId: base.invoiceId, hash: '' } },
    ['format.previous-hash:admisible'],
  ],
])('%s', (_name, overrides, expected) => {
  it(expected.length ? `incumple ${expected.join(', ')}` : 'es válido', async () => {
    expect(await violations(overrides)).toEqual(expected);
  });
});

describe('sistema informático (§3.1.5)', () => {
  const sys = (s: Partial<ComputerSystem>) => violations({ system: { ...SYSTEM, ...s } });
  it('IdSistemaInformatico de 2 posiciones en mayúsculas o dígitos', async () => {
    expect(await sys({ id: 'A' })).toEqual(['business.system-id:error']);
    expect(await sys({ id: 'ab' })).toEqual(['business.system-id:error']);
    expect(await sys({ id: 'Ñ1' })).toEqual(['business.system-id:error']);
    expect(await sys({ id: '07' })).toEqual([]);
  });

  it('productor identificado con IDOtro', async () => {
    const { vendorNif: _n, ...rest } = SYSTEM;
    const foreign = (vendorForeignId: NonNullable<ComputerSystem['vendorForeignId']>) =>
      violations({ system: { ...rest, vendorForeignId } });
    expect(await foreign({ country: 'DE', type: '02', value: 'DE123456789' })).toEqual([]);
    expect(await foreign({ country: 'ES', type: '07', value: 'X' })).toEqual([
      'business.unregistered-not-allowed:error',
      'business.es-foreign-id-type:error',
    ]);
    expect(await violations({ system: { ...rest } })).toEqual(['format.vendor-id:error']);
  });

  it('huella anterior igual a la del registro es admisible (2008)', async () => {
    const record = await createCancellationRecord(base, { validate: false });
    const v = validateRecord(
      { ...record, previous: { invoiceId: base.invoiceId, hash: record.hash } },
      { today: '2025-07-01' },
    );
    expect(v.map((x) => [x.aeatCode, x.severity])).toEqual([[2008, 'admisible']]);
  });
});
