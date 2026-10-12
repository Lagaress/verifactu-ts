import { InvalidArgumentError } from './errors.ts';

/**
 * Fecha de calendario en formato ISO 8601 (`AAAA-MM-DD`), sin hora ni zona horaria.
 *
 * Se usa una cadena y no `Date` para evitar errores de zona horaria: una factura expedida el
 * 1 de enero lo es en cualquier huso. En el XML se escribe como `DD-MM-AAAA`.
 */
export type IsoDate = string;

/**
 * Fecha y hora con desplazamiento horario explícito, sin milisegundos:
 * `AAAA-MM-DDThh:mm:ss±hh:mm` (p. ej. `2026-10-12T10:20:30+02:00`).
 *
 * Es el formato de `FechaHoraHusoGenRegistro`; la misma cadena se escribe en el XML y entra en
 * la huella. No se admite `Z`: la especificación de la AEAT usa siempre el desplazamiento numérico.
 */
export type DateTimeWithOffset = string;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const AEAT_DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/;

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

/** Indica si `value` es una fecha `AAAA-MM-DD` existente en el calendario. */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  return !!m && isValidYmd(Number(m[1]), Number(m[2]), Number(m[3]));
}

/**
 * Convierte `AAAA-MM-DD` a `DD-MM-AAAA` (formato de fecha de la AEAT).
 *
 * @throws InvalidArgumentError si la fecha no es válida.
 */
export function toAeatDate(value: IsoDate): string {
  const m = ISO_DATE_RE.exec(value);
  if (!m || !isValidYmd(Number(m[1]), Number(m[2]), Number(m[3]))) {
    throw new InvalidArgumentError(
      `Fecha no válida (se esperaba AAAA-MM-DD): ${JSON.stringify(value)}`,
    );
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Convierte `DD-MM-AAAA` (formato de la AEAT) a `AAAA-MM-DD`.
 *
 * @throws InvalidArgumentError si la fecha no es válida.
 */
export function fromAeatDate(value: string): IsoDate {
  const m = AEAT_DATE_RE.exec(value);
  if (!m || !isValidYmd(Number(m[3]), Number(m[2]), Number(m[1]))) {
    throw new InvalidArgumentError(
      `Fecha no válida (se esperaba DD-MM-AAAA): ${JSON.stringify(value)}`,
    );
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Indica si `value` tiene el formato `AAAA-MM-DDThh:mm:ss±hh:mm` y representa un instante válido. */
export function isDateTimeWithOffset(value: string): boolean {
  const m = DATETIME_RE.exec(value);
  if (!m) return false;
  const [y = 0, mo = 0, d = 0, h = 0, mi = 0, s = 0, , oh = 0, om = 0] = m.slice(1).map(Number);
  return isValidYmd(y, mo, d) && h <= 23 && mi <= 59 && s <= 59 && oh <= 14 && om <= 59;
}

/** Convierte una cadena `DateTimeWithOffset` en `Date`. */
export function parseDateTimeWithOffset(value: DateTimeWithOffset): Date {
  if (!isDateTimeWithOffset(value)) {
    throw new InvalidArgumentError(
      `Fecha y hora no válida (se esperaba AAAA-MM-DDThh:mm:ss±hh:mm): ${JSON.stringify(value)}`,
    );
  }
  return new Date(value);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (cause) {
      throw new InvalidArgumentError(`Zona horaria IANA no válida: ${JSON.stringify(timeZone)}`, {
        cause,
      });
    }
    formatters.set(timeZone, f);
  }
  return f;
}

/**
 * Formatea un instante en una zona horaria IANA como `AAAA-MM-DDThh:mm:ss±hh:mm`.
 * Los milisegundos se descartan (truncando).
 *
 * @param timeZone zona horaria IANA; por defecto `Europe/Madrid`. Para Canarias, `Atlantic/Canary`.
 * @example formatDateTimeWithOffset(new Date('2026-10-12T08:20:30Z')) // "2026-10-12T10:20:30+02:00"
 */
export function formatDateTimeWithOffset(
  instant: Date,
  timeZone = 'Europe/Madrid',
): DateTimeWithOffset {
  const ms = instant.getTime();
  if (Number.isNaN(ms)) throw new InvalidArgumentError('Fecha no válida (Invalid Date)');
  const truncated = Math.floor(ms / 1000) * 1000;
  const parts: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(truncated)))
    parts[p.type] = p.value;
  const { year = '', month = '', day = '', hour = '', minute = '', second = '' } = parts;
  const wallAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const offsetMin = Math.round((wallAsUtc - truncated) / 60_000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  return `${year.padStart(4, '0')}-${month}-${day}T${hour}:${minute}:${second}${sign}${oh}:${om}`;
}
