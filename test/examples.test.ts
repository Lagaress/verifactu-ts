import { describe, expect, it } from 'vitest';
import { main as altaYQr } from '../examples/01-alta-y-qr.ts';
import { main as aeatSimulada } from '../examples/04-tests-con-aeat-simulada.ts';

describe('ejemplos del README', () => {
  it('01: alta, XML y QR', async () => {
    const { record, xml, url, svg } = await altaYQr();
    expect(record.hash).toMatch(/^[0-9A-F]{64}$/);
    expect(xml).toContain('<sum1:PrimerRegistro>S</sum1:PrimerRegistro>');
    expect(url).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=A00000000&numserie=F2025-0042&fecha=01-06-2025&importe=1210.00',
    );
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('04: envío y anulación contra la AEAT simulada', async () => {
    const r = await aeatSimulada();
    expect(r.sent).toEqual(['Correcto']);
    expect(r.cancelled).toEqual(['Correcto']);
    expect(r.listing).toEqual(['F2025-0042: Anulado']);
  });
});
