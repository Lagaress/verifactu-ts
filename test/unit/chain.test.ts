import { describe, expect, it } from 'vitest';
import {
  createCancellationRecord,
  createRegistrationRecord,
  toChainLink,
  verifyChain,
} from '../../src/index.ts';
import { SYSTEM, f1Input } from '../helpers.ts';

async function buildChain() {
  const a = await createRegistrationRecord(f1Input());
  const b = await createRegistrationRecord(
    f1Input({
      invoiceId: { issuerId: 'A00000000', invoiceNumber: 'PRUEBA-0002', issueDate: '2025-06-01' },
      previous: toChainLink(a),
      hashedAt: '2025-06-01T10:21:00+02:00',
    }),
  );
  const c = await createCancellationRecord({
    invoiceId: a.invoiceId,
    previous: toChainLink(b),
    system: SYSTEM,
    hashedAt: '2025-06-01T10:22:00+02:00',
  });
  return [a, b, c] as const;
}

describe('encadenamiento', () => {
  it('genera Huella vacía en el primer registro y la del anterior en los siguientes', async () => {
    const [a, b, c] = await buildChain();
    expect(a.previous).toBeNull();
    expect(b.previous).toEqual({ invoiceId: a.invoiceId, hash: a.hash });
    expect(c.previous?.hash).toBe(b.hash);
    // El enlace de una anulación usa el identificador de la factura anulada.
    expect(toChainLink(c)).toEqual({ invoiceId: a.invoiceId, hash: c.hash });
  });

  it('verifica una cadena correcta', async () => {
    expect(await verifyChain(await buildChain())).toEqual([]);
  });

  it('detecta reordenaciones, huecos y manipulaciones', async () => {
    const [a, b, c] = await buildChain();
    expect((await verifyChain([b, a, c])).map((i) => i.type)).toEqual(
      expect.arrayContaining(['unexpected-first', 'broken-link']),
    );
    expect((await verifyChain([a, c])).map((i) => i.type)).toEqual(['broken-link']);
    expect(
      (await verifyChain([a, { ...b, description: 'cambiada' }, c])).map((i) => i.type),
    ).toEqual([]);
    expect((await verifyChain([a, { ...b, totalAmount: '999.00' }, c])).map((i) => i.type)).toEqual(
      ['hash-mismatch'],
    );
  });

  it('acepta una secuencia que empieza a mitad de cadena', async () => {
    const [a, b, c] = await buildChain();
    expect(await verifyChain([b, c], { previous: toChainLink(a) })).toEqual([]);
  });

  it('detecta fechas de generación que retroceden más de un minuto', async () => {
    const [a] = await buildChain();
    const late = await createRegistrationRecord(
      f1Input({
        invoiceId: { issuerId: 'A00000000', invoiceNumber: 'PRUEBA-0009', issueDate: '2025-06-01' },
        previous: toChainLink(a),
        hashedAt: '2025-06-01T10:19:00+02:00',
      }),
    );
    expect((await verifyChain([a, late])).map((i) => i.type)).toEqual(['timestamp-regression']);
  });
});
