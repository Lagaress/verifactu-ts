import { describe, expect, it } from 'vitest';
import { createRegistrationRecord, InvalidArgumentError, qrUrl } from '../../src/index.ts';
import { f1Input } from '../helpers.ts';

const data = (invoiceNumber: string, amount = '100.23') => ({
  issuerId: 'A86018322',
  invoiceNumber,
  issueDate: '2025-10-01',
  amount,
});

describe('URL del QR', () => {
  it('reproduce los casos de Verifactu-PHP (tests/Services/QrGeneratorTest.php)', () => {
    expect(qrUrl(data('FACT001'), { environment: 'production', mode: 'verifactu' })).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=A86018322&numserie=FACT001&fecha=01-10-2025&importe=100.23',
    );
    expect(qrUrl(data('FACT002'), { environment: 'production', mode: 'no-verifactu' })).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=A86018322&numserie=FACT002&fecha=01-10-2025&importe=100.23',
    );
    expect(qrUrl(data('FACT003'), { environment: 'test', mode: 'no-verifactu' })).toBe(
      'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=A86018322&numserie=FACT003&fecha=01-10-2025&importe=100.23',
    );
  });

  it('reproduce el ejemplo oficial de codificación (QR v0.5.0 §4)', () => {
    const url = qrUrl(
      {
        issuerId: '89890001K',
        invoiceNumber: '12345678&G33',
        issueDate: '2024-01-01',
        amount: '241.4',
      },
      { environment: 'test', mode: 'verifactu' },
    );
    expect(url).toBe(
      'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%26G33&fecha=01-01-2024&importe=241.4',
    );
  });

  it('codifica como java.net.URLEncoder (espacio → +, / → %2F, * sin codificar)', () => {
    const url = qrUrl(data('A B/C+D*E-F.G_H~I%'), { environment: 'test', mode: 'verifactu' });
    expect(new URL(url).search).toBe(
      '?nif=A86018322&numserie=A+B%2FC%2BD*E-F.G_H%7EI%25&fecha=01-10-2025&importe=100.23',
    );
    expect(new URL(url).searchParams.get('numserie')).toBe('A B/C+D*E-F.G_H~I%');
  });

  it('usa el importe total de un registro de alta', async () => {
    const record = await createRegistrationRecord(f1Input());
    expect(qrUrl(record, { environment: 'test', mode: 'verifactu' })).toBe(
      'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=A00000000&numserie=PRUEBA-0001&fecha=01-06-2025&importe=121.00',
    );
  });

  it('rechaza parámetros que la AEAT no admitiría', () => {
    const opts = { environment: 'test', mode: 'verifactu' } as const;
    expect(() => qrUrl({ ...data('X'), issuerId: '123' }, opts)).toThrow(InvalidArgumentError);
    expect(() => qrUrl(data('Ñ'), opts)).toThrow(InvalidArgumentError);
    expect(() => qrUrl(data('X'.repeat(61)), opts)).toThrow(InvalidArgumentError);
    expect(() => qrUrl(data('X', '1,00'), opts)).toThrow(InvalidArgumentError);
    expect(() => qrUrl({ ...data('X'), issueDate: '01-10-2025' }, opts)).toThrow(
      InvalidArgumentError,
    );
  });
});
