import type { Violation } from '../validation/violation.ts';

/**
 * Códigos estables de error de la librería. Se pueden usar en `switch` sin depender del texto
 * del mensaje, que está en español y puede cambiar.
 */
export type VerifactuErrorCode =
  | 'VALIDATION'
  | 'INVALID_ARGUMENT'
  | 'XML_PARSE'
  | 'XML_SCHEMA'
  | 'SOAP_FAULT'
  | 'UNEXPECTED_RESPONSE'
  | 'TRANSPORT'
  | 'CERTIFICATE'
  | 'BATCH_LIMIT';

/** Clase base de todos los errores que lanza la librería. */
export class VerifactuError extends Error {
  override readonly name: string = 'VerifactuError';
  readonly code: VerifactuErrorCode;

  constructor(code: VerifactuErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

/** Un argumento no tiene un formato utilizable (p. ej. una fecha que no existe). */
export class InvalidArgumentError extends VerifactuError {
  override readonly name = 'InvalidArgumentError';
  constructor(message: string, options?: { cause?: unknown }) {
    super('INVALID_ARGUMENT', message, options);
  }
}

/**
 * Un registro (u otro modelo) incumple reglas de validación de severidad `error`, es decir,
 * reglas cuyo incumplimiento provocaría el rechazo por parte de la AEAT.
 */
export class ValidationError extends VerifactuError {
  override readonly name = 'ValidationError';
  /** Todas las violaciones detectadas (también las de severidad `admisible`). */
  readonly violations: readonly Violation[];

  constructor(violations: readonly Violation[], subject = 'El registro') {
    const errors = violations.filter((v) => v.severity === 'error');
    super(
      'VALIDATION',
      `${subject} no es válido (${errors.length} ${errors.length === 1 ? 'error' : 'errores'}):\n` +
        errors.map((v) => `- ${v.path || '(raíz)'}: ${v.message}`).join('\n'),
    );
    this.violations = violations;
  }
}

/** El XML no está bien formado o contiene construcciones no admitidas (DOCTYPE, entidades…). */
export class XmlParseError extends VerifactuError {
  override readonly name = 'XmlParseError';
  /** Posición (en caracteres) donde se detectó el problema, si se conoce. */
  readonly position: number | undefined;
  constructor(message: string, position?: number) {
    super('XML_PARSE', position === undefined ? message : `${message} (posición ${position})`);
    this.position = position;
  }
}

/** El XML está bien formado pero no se ajusta a la estructura del esquema esperado. */
export class XmlSchemaError extends VerifactuError {
  override readonly name = 'XmlSchemaError';
  readonly path: string;
  constructor(path: string, message: string) {
    super('XML_SCHEMA', `${path}: ${message}`);
    this.path = path;
  }
}
