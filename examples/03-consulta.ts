// Consultar los registros enviados de un mes, recorriendo todas las páginas.
import type { AeatClient } from 'verifactu-ts/client';

export async function listMonth(client: AeatClient, year: number, month: number) {
  const out: string[] = [];
  for await (const r of client.query({ year, month })) {
    out.push(`${r.invoiceId.invoiceNumber}: ${r.status}${r.error ? ` (${r.error.code})` : ''}`);
  }
  return out;
}
