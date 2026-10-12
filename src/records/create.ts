import { normalizeAmount, normalizeRate } from '../common/amount.ts';
import {
  formatDateTimeWithOffset,
  parseDateTimeWithOffset,
  type DateTimeWithOffset,
} from '../common/dates.ts';
import { InvalidArgumentError, ValidationError } from '../common/errors.ts';
import { calculateHash } from '../hash/hash.ts';
import type {
  BreakdownDetails,
  CancellationRecord,
  RegistrationRecord,
} from '../models/records.ts';
import { validateRecord } from '../validation/validate.ts';

/**
 * Momento de generación del registro (`FechaHoraHusoGenRegistro`):
 *
 * - una cadena `AAAA-MM-DDThh:mm:ss±hh:mm`, que se usa tal cual;
 * - un `Date`, que se formatea en la zona `Europe/Madrid`;
 * - `{ instant, timeZone }` para elegir la zona IANA (p. ej. `Atlantic/Canary`).
 */
export type GenerationTime =
  DateTimeWithOffset | Date | { readonly instant: Date; readonly timeZone: string };

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type OptionalKeys = 'kind' | 'hash' | 'hashedAt' | 'isCorrection';

/** Datos para crear un registro de alta. La huella se calcula automáticamente. */
export type RegistrationRecordInput = Omit<RegistrationRecord, OptionalKeys> & {
  /** Subsanación de un registro previo. Por defecto, `false`. */
  readonly isCorrection?: boolean;
  /** Momento de generación del registro. */
  readonly hashedAt: GenerationTime;
};

/** Datos para crear un registro de anulación. La huella se calcula automáticamente. */
export type CancellationRecordInput = Omit<
  CancellationRecord,
  'kind' | 'hash' | 'hashedAt' | 'withoutPriorRecord' | 'isPriorRejection'
> & {
  /** La factura no tiene registro de alta en la AEAT. Por defecto, `false`. */
  readonly withoutPriorRecord?: boolean;
  /** Anulación tras el rechazo de una anulación anterior. Por defecto, `false`. */
  readonly isPriorRejection?: boolean;
  readonly hashedAt: GenerationTime;
};

export interface CreateOptions {
  /**
   * Validar el registro y lanzar `ValidationError` si incumple alguna regla de severidad
   * `error`. Por defecto, `true`.
   */
  readonly validate?: boolean;
}

/** Convierte un `GenerationTime` a la cadena que va al XML y a la huella. */
export function resolveGenerationTime(value: GenerationTime): DateTimeWithOffset {
  if (typeof value === 'string') {
    parseDateTimeWithOffset(value); // valida el formato
    return value;
  }
  if (value instanceof Date) return formatDateTimeWithOffset(value);
  return formatDateTimeWithOffset(value.instant, value.timeZone);
}

function normalizeBreakdown(line: BreakdownDetails): BreakdownDetails {
  const out: Mutable<BreakdownDetails> = { ...line, baseAmount: normalizeAmount(line.baseAmount) };
  if (line.taxRate !== undefined) out.taxRate = normalizeRate(line.taxRate);
  if (line.costBaseAmount !== undefined) out.costBaseAmount = normalizeAmount(line.costBaseAmount);
  if (line.taxAmount !== undefined) out.taxAmount = normalizeAmount(line.taxAmount);
  if (line.surchargeRate !== undefined) out.surchargeRate = normalizeRate(line.surchargeRate);
  if (line.surchargeAmount !== undefined)
    out.surchargeAmount = normalizeAmount(line.surchargeAmount);
  return out;
}

/**
 * Crea un registro de alta: normaliza importes y tipos a 2 decimales, fija la fecha de
 * generación, calcula la huella y (por defecto) valida el resultado.
 *
 * @throws ValidationError si el registro incumple alguna regla de severidad `error`.
 * @throws InvalidArgumentError si algún importe, fecha o zona horaria no tiene formato válido.
 */
export async function createRegistrationRecord(
  input: RegistrationRecordInput,
  options: CreateOptions = {},
): Promise<RegistrationRecord> {
  const draft: Mutable<Omit<RegistrationRecord, 'hash'>> = {
    ...input,
    kind: 'registration',
    isCorrection: input.isCorrection ?? false,
    breakdown: input.breakdown.map(normalizeBreakdown),
    totalTaxAmount: normalizeAmount(input.totalTaxAmount),
    totalAmount: normalizeAmount(input.totalAmount),
    hashedAt: resolveGenerationTime(input.hashedAt),
  };
  if (input.correctedBaseAmount !== undefined)
    draft.correctedBaseAmount = normalizeAmount(input.correctedBaseAmount);
  if (input.correctedTaxAmount !== undefined)
    draft.correctedTaxAmount = normalizeAmount(input.correctedTaxAmount);
  if (input.correctedSurchargeAmount !== undefined) {
    draft.correctedSurchargeAmount = normalizeAmount(input.correctedSurchargeAmount);
  }
  return finish({ ...draft, hash: '' }, options);
}

/**
 * Crea un registro de anulación: fija la fecha de generación, calcula la huella y (por defecto)
 * valida el resultado.
 *
 * @throws ValidationError si el registro incumple alguna regla de severidad `error`.
 */
export async function createCancellationRecord(
  input: CancellationRecordInput,
  options: CreateOptions = {},
): Promise<CancellationRecord> {
  const draft: CancellationRecord = {
    ...input,
    kind: 'cancellation',
    withoutPriorRecord: input.withoutPriorRecord ?? false,
    isPriorRejection: input.isPriorRejection ?? false,
    hashedAt: resolveGenerationTime(input.hashedAt),
    hash: '',
  };
  return finish(draft, options);
}

async function finish<R extends RegistrationRecord | CancellationRecord>(
  draft: R,
  options: CreateOptions,
): Promise<R> {
  const validate = options.validate ?? true;
  let hash: string;
  try {
    hash = await calculateHash(draft);
  } catch (error) {
    // Si la huella no se puede calcular (p. ej. una fecha inexistente), se informa de todas las
    // violaciones del registro en lugar de solo del primer dato inválido.
    if (validate && error instanceof InvalidArgumentError) {
      const violations = validateRecord(draft).filter((v) => v.rule !== 'format.hash');
      if (violations.some((v) => v.severity === 'error')) throw new ValidationError(violations);
    }
    throw error;
  }
  const record = { ...draft, hash };
  if (validate) {
    const violations = validateRecord(record);
    if (violations.some((v) => v.severity === 'error')) throw new ValidationError(violations);
  }
  return record;
}
