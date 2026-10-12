import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AeatClient } from '../../src/client/index.ts';
import { nodeTransport } from '../../src/client/transports/node.ts';
import {
  createCancellationRecord,
  createRegistrationRecord,
  qrUrl,
  toChainLink,
  type ComputerSystem,
  type InvoiceRecord,
} from '../../src/index.ts';

/**
 * Pruebas contra el entorno de pruebas de la AEAT (prewww1/prewww10). Desactivadas por defecto.
 *
 *   VERIFACTU_IT_PFX=/ruta/certificado.p12 \
 *   VERIFACTU_IT_PASS=... \
 *   VERIFACTU_IT_NIF=<NIF del titular> VERIFACTU_IT_NAME="<Nombre o razón social>" \
 *   [VERIFACTU_IT_SEAL=1] npm run test:integration
 *
 * Usa números de factura únicos (prefijo VFTS-IT- y marca de tiempo). Los registros quedan en el
 * entorno de pruebas de la AEAT, nunca en producción.
 */
const env = process.env;
const enabled = Boolean(
  env['VERIFACTU_IT_PFX'] && env['VERIFACTU_IT_NIF'] && env['VERIFACTU_IT_NAME'],
);

describe.skipIf(!enabled)('entorno de pruebas de la AEAT', () => {
  const nif = env['VERIFACTU_IT_NIF'] ?? '';
  const taxpayer = { name: env['VERIFACTU_IT_NAME'] ?? '', nif };
  const system: ComputerSystem = {
    vendorName: taxpayer.name,
    vendorNif: nif,
    name: 'verifactu-ts IT',
    id: 'VT',
    version: '0.0.0',
    installationNumber: 'IT-1',
    onlySupportsVerifactu: true,
    supportsMultipleTaxpayers: false,
    hasMultipleTaxpayers: false,
  };
  const client = new AeatClient({
    transport: nodeTransport({
      pfx: readFileSync(env['VERIFACTU_IT_PFX'] ?? ''),
      passphrase: env['VERIFACTU_IT_PASS'] ?? '',
    }),
    environment: 'test',
    certificateType: env['VERIFACTU_IT_SEAL'] ? 'seal' : 'personal',
    taxpayer,
    system,
  });
  const stamp = Date.now().toString(36).toUpperCase();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const accepted = ['Correcto', 'AceptadoConErrores'];

  it('alta, subsanación, anulación y consulta', async () => {
    const id = { issuerId: nif, invoiceNumber: `VFTS-IT-${stamp}`, issueDate: today };
    // El primer registro puede devolver el admisible 2007 si ya hay registros previos de este
    // sistema en el entorno de pruebas.
    const alta = await createRegistrationRecord({
      invoiceId: id,
      issuerName: taxpayer.name,
      invoiceType: 'F2',
      description: 'Prueba de integración de verifactu-ts',
      recipients: [],
      breakdown: [
        {
          taxType: '01',
          regimeType: '01',
          operationType: 'S1',
          taxRate: '21',
          baseAmount: '10.00',
          taxAmount: '2.10',
        },
      ],
      totalTaxAmount: '2.10',
      totalAmount: '12.10',
      previous: null,
      system,
      hashedAt: new Date(),
    });
    const r1 = await client.send([alta]);
    console.log('alta', r1.status, r1.csv, r1.items[0]);
    expect(accepted).toContain(r1.items[0]?.status);
    expect(qrUrl(alta, { environment: 'test', mode: 'verifactu' })).toContain('prewww2.aeat.es');

    const subsanacion = await createRegistrationRecord({
      ...alta,
      isCorrection: true,
      description: 'Prueba de integración de verifactu-ts (subsanada)',
      previous: toChainLink(alta),
      hashedAt: new Date(),
    });
    const anulacion = await createCancellationRecord({
      invoiceId: id,
      previous: toChainLink(subsanacion),
      system,
      hashedAt: new Date(Date.now() + 1000),
    });
    const chain: InvoiceRecord[] = [subsanacion, anulacion];
    const r2 = await client.send(chain);
    console.log('subsanación + anulación', r2.status, r2.items);
    expect(r2.items.map((i) => accepted.includes(i.status))).toEqual([true, true]);

    const [year, month] = today.split('-').map(Number) as [number, number];
    const found = [];
    for await (const r of client.query({ year, month, invoiceNumber: id.invoiceNumber }))
      found.push(r);
    console.log(
      'consulta',
      found.map((r) => [r.invoiceId.invoiceNumber, r.status]),
    );
    expect(found.some((r) => r.status === 'Anulado')).toBe(true);
  });
});
