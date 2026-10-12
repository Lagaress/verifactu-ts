/**
 * Severidad de una violación, según lo que haría la AEAT al recibir el registro:
 *
 * - `error`: provocaría el rechazo del registro o del envío.
 * - `admisible`: el registro se aceptaría con errores («AceptadoConErrores») y habría que
 *   subsanarlo.
 */
export type Severity = 'error' | 'admisible';

/** Incumplimiento de una regla de validación. */
export interface Violation {
  /** Ruta de la propiedad afectada en el modelo (p. ej. `breakdown[0].taxAmount`). */
  readonly path: string;
  /** Identificador estable de la regla (p. ej. `breakdown.tax-amount-mismatch`). */
  readonly rule: string;
  readonly severity: Severity;
  /** Mensaje en español. */
  readonly message: string;
  /** Código de error de la AEAT equivalente, cuando existe (catálogo `errores.properties`). */
  readonly aeatCode?: number;
  /** Referencia a la documentación oficial (p. ej. `Validaciones v1.2.2 §15.7`). */
  readonly reference?: string;
}
