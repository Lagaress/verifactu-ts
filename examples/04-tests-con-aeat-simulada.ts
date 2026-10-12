// Probar la integración sin certificado ni red con la AEAT simulada.
import { createCancellationRecord, toChainLink } from 'verifactu-ts';
import { AeatClient } from 'verifactu-ts/client';
import { createFakeAeat } from 'verifactu-ts/testing';
import { main as createInvoice, system } from './01-alta-y-qr.ts';
import { listMonth } from './03-consulta.ts';

export async function main() {
  const aeat = createFakeAeat({ today: '2025-07-01' });
  const client = new AeatClient({
    transport: aeat.transport,
    environment: 'test',
    certificateType: 'personal',
    taxpayer: { name: 'Perico de los Palotes, S.A.', nif: 'A00000000' },
  });

  const { record, link } = await createInvoice();
  const sent = await client.send([record], { today: '2025-07-01' });

  const cancellation = await createCancellationRecord({
    invoiceId: record.invoiceId,
    previous: link,
    system,
    hashedAt: new Date('2025-06-01T09:00:00Z'),
  });
  const cancelled = await client.send([cancellation], { today: '2025-07-01' });

  return {
    sent: sent.items.map((i) => i.status),
    cancelled: cancelled.items.map((i) => i.status),
    nextLink: toChainLink(cancellation),
    listing: await listMonth(client, 2025, 6),
  };
}
