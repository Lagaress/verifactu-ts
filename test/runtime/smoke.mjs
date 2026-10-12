/* global console */
// Prueba mínima del núcleo compilado en otros runtimes (Deno, Bun):
//   deno run --no-prompt test/runtime/smoke.mjs
//   bun test/runtime/smoke.mjs
import { createRegistrationRecord, qrUrl } from '../../dist/index.js';

const record = await createRegistrationRecord(
  {
    invoiceId: { issuerId: '89890001K', invoiceNumber: '12345678/G33', issueDate: '2024-01-01' },
    issuerName: 'Empresa ejemplo',
    invoiceType: 'F1',
    description: 'Ejemplo',
    recipients: [{ name: 'Cliente', nif: '89890002E' }],
    breakdown: [{ operationType: 'S1', taxRate: '10', baseAmount: '111.10', taxAmount: '11.11' }],
    totalTaxAmount: '12.35',
    totalAmount: '123.45',
    previous: null,
    system: {
      vendorName: 'Productor',
      vendorNif: '89890001K',
      name: 'SIF',
      id: 'XX',
      version: '1',
      installationNumber: '1',
      onlySupportsVerifactu: true,
      supportsMultipleTaxpayers: false,
      hasMultipleTaxpayers: false,
    },
    hashedAt: new Date('2024-01-01T18:20:30Z'),
  },
  { validate: false },
);

const expected = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60';
if (record.hash !== expected) throw new Error(`Huella inesperada: ${record.hash}`);
if (
  !qrUrl(record, { environment: 'test', mode: 'verifactu' }).includes('numserie=12345678%2FG33')
) {
  throw new Error('URL del QR inesperada');
}
console.log('OK: huella y QR correctos en este runtime');
