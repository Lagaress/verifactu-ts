import { describe, expect, it } from 'vitest';
import {
  formatDateTimeWithOffset,
  fromAeatDate,
  InvalidArgumentError,
  isDateTimeWithOffset,
  isIsoDate,
  parseDateTimeWithOffset,
  toAeatDate,
} from '../../../src/index.ts';

describe('fechas', () => {
  it('convierte entre AAAA-MM-DD y DD-MM-AAAA', () => {
    expect(toAeatDate('2024-01-31')).toBe('31-01-2024');
    expect(fromAeatDate('31-01-2024')).toBe('2024-01-31');
  });

  it('rechaza fechas inexistentes', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2025-02-29')).toBe(false);
    expect(isIsoDate('2025-13-01')).toBe(false);
    expect(() => toAeatDate('2025-02-30')).toThrow(InvalidArgumentError);
    expect(() => fromAeatDate('2025-02-01')).toThrow(InvalidArgumentError);
  });

  it('valida el formato de fecha y hora con huso', () => {
    expect(isDateTimeWithOffset('2024-01-01T19:20:30+01:00')).toBe(true);
    expect(isDateTimeWithOffset('2024-01-01T19:20:30-03:30')).toBe(true);
    expect(isDateTimeWithOffset('2024-01-01T19:20:30Z')).toBe(false);
    expect(isDateTimeWithOffset('2024-01-01T19:20:30.000+01:00')).toBe(false);
    expect(isDateTimeWithOffset('2024-01-01T24:00:00+01:00')).toBe(false);
    expect(() => parseDateTimeWithOffset('2024-01-01 19:20:30+01:00')).toThrow(
      InvalidArgumentError,
    );
  });

  describe('formatDateTimeWithOffset', () => {
    it('usa +01:00 en invierno y +02:00 en verano en Europe/Madrid', () => {
      expect(formatDateTimeWithOffset(new Date('2024-01-01T18:20:30Z'))).toBe(
        '2024-01-01T19:20:30+01:00',
      );
      expect(formatDateTimeWithOffset(new Date('2025-07-15T10:00:00Z'))).toBe(
        '2025-07-15T12:00:00+02:00',
      );
    });

    it('gestiona el cambio de hora', () => {
      // 30/03/2025: a las 02:00 (+01:00) pasan a ser las 03:00 (+02:00) → 01:00Z
      expect(formatDateTimeWithOffset(new Date('2025-03-30T00:59:59Z'))).toBe(
        '2025-03-30T01:59:59+01:00',
      );
      expect(formatDateTimeWithOffset(new Date('2025-03-30T01:00:00Z'))).toBe(
        '2025-03-30T03:00:00+02:00',
      );
      // 26/10/2025: a las 03:00 (+02:00) vuelven a ser las 02:00 (+01:00)
      expect(formatDateTimeWithOffset(new Date('2025-10-26T00:30:00Z'))).toBe(
        '2025-10-26T02:30:00+02:00',
      );
      expect(formatDateTimeWithOffset(new Date('2025-10-26T01:30:00Z'))).toBe(
        '2025-10-26T02:30:00+01:00',
      );
    });

    it('admite otras zonas y descarta milisegundos', () => {
      expect(
        formatDateTimeWithOffset(new Date('2025-01-10T12:00:00.987Z'), 'Atlantic/Canary'),
      ).toBe('2025-01-10T12:00:00+00:00');
      expect(formatDateTimeWithOffset(new Date('2025-01-10T12:00:00Z'), 'America/St_Johns')).toBe(
        '2025-01-10T08:30:00-03:30',
      );
      expect(formatDateTimeWithOffset(new Date('2025-01-10T00:00:00Z'), 'UTC')).toBe(
        '2025-01-10T00:00:00+00:00',
      );
    });

    it('produce cadenas que se leen como el mismo instante', () => {
      const instant = new Date('2026-10-12T08:20:30Z');
      expect(parseDateTimeWithOffset(formatDateTimeWithOffset(instant)).getTime()).toBe(
        instant.getTime(),
      );
    });

    it('rechaza zonas inválidas y fechas inválidas', () => {
      expect(() => formatDateTimeWithOffset(new Date(), 'Marte/Olympus')).toThrow(
        InvalidArgumentError,
      );
      expect(() => formatDateTimeWithOffset(new Date('x'))).toThrow(InvalidArgumentError);
    });
  });
});
