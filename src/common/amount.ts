import { InvalidArgumentError } from './errors.ts';

/**
 * Importe monetario como cadena decimal, con «.» como separador (p. ej. `"1210.00"`, `"-3.50"`).
 *
 * Se usan cadenas y no `number` porque el importe se escribe tal cual en el XML y en la huella:
 * la cadena que entra en la huella debe ser exactamente la del XML. La aritmética interna se hace
 * en céntimos con `bigint`, nunca con coma flotante.
 *
 * Formato admitido por el XSD (`ImporteSgn12.2Type`): `(\+|-)?\d{1,12}(\.\d{0,2})?`.
 * Los registros que genera esta librería usan siempre la forma canónica de 2 decimales.
 */
export type Amount = string;

/** Tipo impositivo o de recargo como cadena decimal (`Tipo2.2Type`: `\d{1,3}(\.\d{0,2})?`). */
export type Rate = string;

const AMOUNT_RE = /^([+-])?(\d{1,12})(?:\.(\d{0,2}))?$/;
const AMOUNT_14_RE = /^([+-])?(\d{1,14})(?:\.(\d{0,2}))?$/;
const RATE_RE = /^(\d{1,3})(?:\.(\d{0,2}))?$/;

/** Indica si `value` cumple el formato de importe del XSD (12 enteros y hasta 2 decimales). */
export function isAmount(value: string): boolean {
  return AMOUNT_RE.test(value);
}

/** Indica si `value` cumple el formato de tipo impositivo del XSD (3 enteros y hasta 2 decimales). */
export function isRate(value: string): boolean {
  return RATE_RE.test(value);
}

/**
 * Convierte un importe a céntimos.
 *
 * @throws InvalidArgumentError si el formato no es válido.
 */
export function amountToCents(
  value: Amount,
  { maxIntegerDigits = 12 }: { maxIntegerDigits?: 12 | 14 } = {},
): bigint {
  const m = (maxIntegerDigits === 14 ? AMOUNT_14_RE : AMOUNT_RE).exec(value);
  if (!m) throw new InvalidArgumentError(`Importe con formato no válido: ${JSON.stringify(value)}`);
  const [, sign, int = '0', dec = ''] = m;
  const cents = BigInt(int) * 100n + BigInt(dec.padEnd(2, '0'));
  return sign === '-' ? -cents : cents;
}

/**
 * Convierte céntimos a importe canónico con 2 decimales.
 *
 * @example centsToAmount(121000n) // "1210.00"
 * @throws InvalidArgumentError si el valor no es un entero o excede 12 dígitos enteros.
 */
export function centsToAmount(cents: bigint | number): Amount {
  if (typeof cents === 'number' && !Number.isSafeInteger(cents)) {
    throw new InvalidArgumentError(`Los céntimos deben ser un entero seguro: ${cents}`);
  }
  const c = BigInt(cents);
  const abs = c < 0n ? -c : c;
  const int = (abs / 100n).toString();
  if (int.length > 12)
    throw new InvalidArgumentError(
      `Importe fuera de rango (máximo 12 dígitos enteros): ${c} céntimos`,
    );
  const dec = (abs % 100n).toString().padStart(2, '0');
  return `${c < 0n ? '-' : ''}${int}.${dec}`;
}

/**
 * Normaliza un importe a su forma canónica de 2 decimales, sin signo `+` ni ceros a la izquierda.
 *
 * @example normalizeAmount("41.4") // "41.40"
 */
export function normalizeAmount(value: Amount): Amount {
  return centsToAmount(amountToCents(value));
}

/**
 * Convierte un `number` a importe redondeando a 2 decimales (mitad lejos de cero) sobre su
 * representación decimal, no sobre su valor binario: `amountFromNumber(1.005)` es `"1.01"`.
 *
 * Se ofrece por comodidad; si es posible, trabaja directamente en céntimos.
 */
export function amountFromNumber(value: number): Amount {
  if (!Number.isFinite(value)) throw new InvalidArgumentError(`Importe no finito: ${value}`);
  return centsToAmount(roundDecimalString(numberToPlainString(value), 2));
}

/**
 * Normaliza un tipo impositivo a 2 decimales.
 *
 * @example normalizeRate("21") // "21.00"
 */
export function normalizeRate(value: Rate): Rate {
  const m = RATE_RE.exec(value);
  if (!m)
    throw new InvalidArgumentError(
      `Tipo impositivo con formato no válido: ${JSON.stringify(value)}`,
    );
  const [, int = '0', dec = ''] = m;
  return `${BigInt(int).toString()}.${dec.padEnd(2, '0')}`;
}

/** Tipo impositivo en centésimas de punto (`"21.00"` → `2100n`). */
export function rateToHundredths(value: Rate): bigint {
  const m = RATE_RE.exec(value);
  if (!m)
    throw new InvalidArgumentError(
      `Tipo impositivo con formato no válido: ${JSON.stringify(value)}`,
    );
  const [, int = '0', dec = ''] = m;
  return BigInt(int) * 100n + BigInt(dec.padEnd(2, '0'));
}

/**
 * Cuota teórica en céntimos: `base × tipo / 100`, redondeada a céntimo (mitad lejos de cero).
 *
 * @param baseCents base imponible en céntimos
 * @param rate tipo impositivo (p. ej. `"21.00"`)
 */
export function taxCents(baseCents: bigint, rate: Rate): bigint {
  // base (céntimos) × tipo (centésimas) / 10 000 → céntimos
  return divRoundHalfAwayFromZero(baseCents * rateToHundredths(rate), 10_000n);
}

function divRoundHalfAwayFromZero(n: bigint, d: bigint): bigint {
  const neg = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  const q = (an * 2n + ad) / (ad * 2n);
  return neg ? -q : q;
}

function numberToPlainString(value: number): string {
  const s = String(value);
  if (!/e/i.test(s)) return s;
  // Notación exponencial: los importes reales nunca llegan aquí salvo valores extremos.
  const [mantissa = '', expStr = '0'] = s.toLowerCase().split('e');
  const exp = Number(expStr);
  const neg = mantissa.startsWith('-');
  const [i = '', f = ''] = mantissa.replace('-', '').split('.');
  const digits = i + f;
  const point = i.length + exp;
  const plain =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return (neg ? '-' : '') + plain;
}

function roundDecimalString(s: string, decimals: number): bigint {
  const neg = s.startsWith('-');
  const [int = '0', frac = ''] = s.replace('-', '').split('.');
  const kept = BigInt(int + frac.slice(0, decimals).padEnd(decimals, '0'));
  const roundUp = (frac[decimals] ?? '0') >= '5';
  const result = roundUp ? kept + 1n : kept;
  return neg ? -result : result;
}
