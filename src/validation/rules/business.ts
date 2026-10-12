import type { InvoiceRecord } from '../../models/records.ts';
import type { Collector } from '../collector.ts';
import type { ValidationContext } from '../validate.ts';

/** Reglas de negocio del documento «Validaciones y errores» v1.2.2 (se completan en la fase 3). */
export function businessRules(
  _record: InvoiceRecord,
  _c: Collector,
  _context: ValidationContext,
): void {
  // Pendiente.
}
