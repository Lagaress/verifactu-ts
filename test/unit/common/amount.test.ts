import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  amountFromNumber,
  amountToCents,
  centsToAmount,
  InvalidArgumentError,
  isAmount,
  normalizeAmount,
  normalizeRate,
  taxCents,
} from '../../../src/index.ts';

describe('importes', () => {
  it('acepta el formato del XSD (ImporteSgn12.2Type)', () => {
    for (const ok of ['0', '1', '1.', '1.5', '1.50', '-3.20', '+3.20', '999999999999.99'])
      expect(isAmount(ok)).toBe(true);
    for (const bad of ['', '.5', '1.234', '1,5', '1000000000000', ' 1', '1e3', '--1'])
      expect(isAmount(bad)).toBe(false);
  });

  it('normaliza a 2 decimales', () => {
    expect(normalizeAmount('41.4')).toBe('41.40');
    expect(normalizeAmount('+007')).toBe('7.00');
    expect(normalizeAmount('-0')).toBe('0.00');
    expect(normalizeAmount('-0.5')).toBe('-0.50');
    expect(normalizeAmount('12.')).toBe('12.00');
  });

  it('convierte entre céntimos e importe sin pérdida (propiedad)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -99_999_999_999_999n, max: 99_999_999_999_999n }), (cents) => {
        expect(amountToCents(centsToAmount(cents))).toBe(cents);
      }),
    );
  });

  it('rechaza importes fuera de rango o no enteros', () => {
    expect(() => centsToAmount(100_000_000_000_000n)).toThrow(InvalidArgumentError);
    expect(() => centsToAmount(1.5)).toThrow(InvalidArgumentError);
    expect(() => amountToCents('1,00')).toThrow(InvalidArgumentError);
  });

  it('redondea números sobre su representación decimal', () => {
    expect(amountFromNumber(1.005)).toBe('1.01');
    expect(amountFromNumber(0.1 + 0.2)).toBe('0.30');
    expect(amountFromNumber(28.2449999)).toBe('28.24');
    expect(amountFromNumber(-2.675)).toBe('-2.68');
    expect(amountFromNumber(1e-7)).toBe('0.00');
    expect(() => amountFromNumber(Number.NaN)).toThrow(InvalidArgumentError);
  });

  it('normaliza tipos impositivos', () => {
    expect(normalizeRate('21')).toBe('21.00');
    expect(normalizeRate('5.2')).toBe('5.20');
    expect(normalizeRate('0')).toBe('0.00');
    expect(() => normalizeRate('-1')).toThrow(InvalidArgumentError);
  });

  it('calcula la cuota teórica con redondeo mitad lejos de cero', () => {
    expect(taxCents(1122n, '10.00')).toBe(112n); // 11.22 × 10 % = 1.122 (Verifactu-PHP BreakdownDetailsTest)
    expect(taxCents(3322n, '21.00')).toBe(698n); // 33.22 × 21 % = 6.9762
    expect(taxCents(3322n, '5.20')).toBe(173n); // recargo 5,2 % = 1.72744
    expect(taxCents(1250n, '21.00')).toBe(263n); // 2.625 → 2.63
    expect(taxCents(-1250n, '21.00')).toBe(-263n);
  });
});
