import type { InvoiceRecord } from '../models/records.ts';
import { businessRules } from './rules/business.ts';
import { formatRules } from './rules/format.ts';
import { Collector } from './collector.ts';
import type { Violation } from './violation.ts';

/** Contexto opcional para reglas que dependen de datos externos al registro. */
export interface ValidationContext {
  /**
   * Fecha actual (`AAAA-MM-DD`) para la regla de fecha de expedición futura. Por defecto, la fecha
   * del sistema en `Europe/Madrid`.
   */
  readonly today?: string;
  /**
   * NIF del obligado a expedir de la cabecera del envío (`ObligadoEmision`). Si se indica, se
   * comprueba que coincide con el emisor de la factura (error 1108).
   */
  readonly taxpayerNif?: string;
}

/**
 * Valida un registro de facturación y devuelve todas las violaciones encontradas.
 *
 * Incluye reglas de formato (derivadas del XSD) y reglas de negocio del documento «Validaciones y
 * errores» v1.2.2 de la AEAT. No valida lo que solo la AEAT puede comprobar (censo de NIF,
 * duplicados, existencia del registro previo…).
 */
export function validateRecord(
  record: InvoiceRecord,
  context: ValidationContext = {},
): Violation[] {
  const c = new Collector();
  formatRules(record, c);
  businessRules(record, c, context);
  return c.violations;
}

/** Indica si el registro no tiene violaciones de severidad `error`. */
export function isValidRecord(record: InvoiceRecord, context?: ValidationContext): boolean {
  return !validateRecord(record, context).some((v) => v.severity === 'error');
}
