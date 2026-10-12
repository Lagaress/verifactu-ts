import { describe, expect, it } from 'vitest';
import {
  cancellationHashInput,
  createCancellationRecord,
  createRegistrationRecord,
  registrationHashInput,
  sha256Hex,
  verifyHash,
  type RegistrationHashFields,
} from '../../src/index.ts';
import vectors from '../vectors/hash.json' with { type: 'json' };
import { SYSTEM, f1Input } from '../helpers.ts';

describe('huella: vectores oficiales y de Verifactu-PHP', () => {
  for (const v of vectors.registration) {
    it(`alta ${v.id}`, async () => {
      const input = registrationHashInput(v.fields);
      if ('input' in v) expect(input).toBe(v.input);
      expect(await sha256Hex(input)).toBe(v.hash);
    });
  }
  for (const v of vectors.cancellation) {
    it(`anulación ${v.id}`, async () => {
      const input = cancellationHashInput(v.fields);
      if ('input' in v) expect(input).toBe(v.input);
      expect(await sha256Hex(input)).toBe(v.hash);
    });
  }
});

describe('huella: reglas de la especificación', () => {
  const base = vectors.registration[0]!.fields as RegistrationHashFields;

  it('elimina espacios al inicio y al final de cada valor (§ formato de los campos)', async () => {
    const spaced = { ...base, NumSerieFactura: '  12345678/G33 ', CuotaTotal: ' 12.35' };
    expect(await sha256Hex(registrationHashInput(spaced))).toBe(vectors.registration[0]!.hash);
  });

  it('no codifica los valores (ni URL ni XML)', () => {
    const input = registrationHashInput({ ...base, NumSerieFactura: 'A&B<C' });
    expect(input).toContain('NumSerieFactura=A&B<C&');
  });

  it('calcula SHA-256 sobre UTF-8', async () => {
    // "Ñ" son 2 bytes en UTF-8 (C3 91); valor calculado con `printf 'Ñ' | shasum -a 256`.
    expect(await sha256Hex('Ñ')).toBe(
      '3A11228CB39DD6567EE8BD759157FDAD805718AA9B835090058D2A43825057BB',
    );
    expect(await sha256Hex('abc')).toBe(
      'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD',
    );
  });
});

describe('createRegistrationRecord / createCancellationRecord', () => {
  it('reproduce los ejemplos oficiales de alta y anulación encadenados', async () => {
    const system = { ...SYSTEM, vendorNif: '89890001K' };
    const common = {
      issuerName: 'Empresa ejemplo',
      invoiceType: 'F1' as const,
      description: 'Ejemplo',
      recipients: [{ name: 'Cliente', nif: '89890002E' }],
      breakdown: [
        { operationType: 'S1' as const, taxRate: '10', baseAmount: '111.10', taxAmount: '11.11' },
      ],
      totalTaxAmount: '12.35',
      totalAmount: '123.45',
      system,
    };
    const first = await createRegistrationRecord(
      {
        ...common,
        invoiceId: {
          issuerId: '89890001K',
          invoiceNumber: '12345678/G33',
          issueDate: '2024-01-01',
        },
        previous: null,
        hashedAt: '2024-01-01T19:20:30+01:00',
      },
      { validate: false },
    );
    expect(first.hash).toBe('3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60');

    const second = await createRegistrationRecord(
      {
        ...common,
        invoiceId: {
          issuerId: '89890001K',
          invoiceNumber: '12345679/G34',
          issueDate: '2024-01-01',
        },
        previous: { invoiceId: first.invoiceId, hash: first.hash },
        hashedAt: '2024-01-01T19:20:35+01:00',
      },
      { validate: false },
    );
    expect(second.hash).toBe('F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97');

    const cancellation = await createCancellationRecord(
      {
        invoiceId: second.invoiceId,
        previous: { invoiceId: second.invoiceId, hash: second.hash },
        system,
        hashedAt: '2024-01-01T19:20:40+01:00',
      },
      { validate: false },
    );
    expect(cancellation.hash).toBe(
      '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68',
    );
    expect(await verifyHash(cancellation)).toBe(true);
  });

  it('normaliza importes a 2 decimales antes de calcular la huella', async () => {
    const record = await createRegistrationRecord(
      f1Input({ totalTaxAmount: '21', totalAmount: '121.0' }),
    );
    expect(record.totalTaxAmount).toBe('21.00');
    expect(record.totalAmount).toBe('121.00');
    expect(record.breakdown[0]?.taxRate).toBe('21.00');
  });

  it('formatea un Date en Europe/Madrid por defecto', async () => {
    const record = await createRegistrationRecord(
      f1Input({ hashedAt: new Date('2025-06-01T08:20:30.999Z') }),
    );
    expect(record.hashedAt).toBe('2025-06-01T10:20:30+02:00');
  });

  it('acepta una zona horaria explícita', async () => {
    const record = await createRegistrationRecord(
      f1Input({
        hashedAt: { instant: new Date('2025-06-01T08:20:30Z'), timeZone: 'Atlantic/Canary' },
      }),
    );
    expect(record.hashedAt).toBe('2025-06-01T09:20:30+01:00');
  });

  it('detecta una huella manipulada', async () => {
    const record = await createRegistrationRecord(f1Input());
    expect(await verifyHash(record)).toBe(true);
    expect(await verifyHash({ ...record, totalAmount: '121.01' })).toBe(false);
  });
});
