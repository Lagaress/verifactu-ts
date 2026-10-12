// Enviar registros al entorno de pruebas de la AEAT con un certificado PKCS#12 (Node.js).
import { readFile } from 'node:fs/promises';
import { AeatClient, nextSendAllowedAt, SoapFaultError, TransportError } from 'verifactu-ts/client';
import { nodeTransport } from 'verifactu-ts/transport/node';
import type { InvoiceRecord } from 'verifactu-ts';
import { system } from './01-alta-y-qr.ts';

export async function send(records: InvoiceRecord[]) {
  const client = new AeatClient({
    transport: nodeTransport({
      pfx: await readFile('certificado.p12'),
      passphrase: process.env['CERT_PASS'] ?? '',
    }),
    environment: 'test', // 'production' para el entorno real
    certificateType: 'personal', // 'seal' con certificado de sello electrónico
    taxpayer: { name: 'Perico de los Palotes, S.A.', nif: 'A00000000' },
    system,
  });

  try {
    const res = await client.send(records);
    // Guarda res.csv: la AEAT no lo vuelve a proporcionar.
    for (const item of res.items) {
      if (item.status === 'Incorrecto')
        console.error(item.invoiceId.invoiceNumber, item.error?.code, item.error?.description);
      if (item.status === 'AceptadoConErrores')
        console.warn('Hay que subsanar', item.invoiceId.invoiceNumber, item.error);
    }
    return { csv: res.csv, nextSendAt: nextSendAllowedAt(res) };
  } catch (error) {
    if (error instanceof SoapFaultError && !error.retryable) throw error; // corregir la petición
    if (error instanceof TransportError && error.retryable) {
      // Reintentar más tarde con los mismos registros.
    }
    throw error;
  }
}
