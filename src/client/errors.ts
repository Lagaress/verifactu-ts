import { VerifactuError } from '../common/errors.ts';

/**
 * La AEAT ha rechazado la petición completa con un SOAP Fault (error de esquema, de cabecera,
 * de certificado…).
 */
export class SoapFaultError extends VerifactuError {
  override readonly name = 'SoapFaultError';
  /** `faultcode` del SOAP Fault (p. ej. `soapenv:Client` o `soapenv:Server`). */
  readonly faultCode: string;
  /** `faultstring` del SOAP Fault, tal cual. */
  readonly faultString: string;
  /** Código de error de la AEAT extraído de `Codigo[NNNN]`, si viene. */
  readonly aeatCode: number | undefined;
  /**
   * Si tiene sentido reintentar sin cambios: la AEAT indica `Server` para errores de su lado
   * y `Client` para errores de la petición, que hay que corregir antes de reenviar.
   */
  readonly retryable: boolean;

  constructor(faultCode: string, faultString: string) {
    const aeatCode = /Codigo\[(\d+)\]/.exec(faultString)?.[1];
    super('SOAP_FAULT', `La AEAT ha rechazado la petición (${faultCode}): ${faultString}`);
    this.faultCode = faultCode;
    this.faultString = faultString;
    this.aeatCode = aeatCode === undefined ? undefined : Number(aeatCode);
    this.retryable = /server/i.test(faultCode);
  }
}

/** Fallo de comunicación: red, tiempo de espera, HTTP inesperado o respuesta que no es XML. */
export class TransportError extends VerifactuError {
  override readonly name = 'TransportError';
  /** Código de estado HTTP, si hubo respuesta. */
  readonly status: number | undefined;
  /** Principio del cuerpo de la respuesta (hasta 500 caracteres), para diagnóstico. */
  readonly bodySnippet: string | undefined;
  /** Se puede reintentar (no hubo respuesta, tiempo de espera o error 5xx). */
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { status?: number; body?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super('TRANSPORT', message, { cause: options.cause });
    this.status = options.status;
    this.bodySnippet = options.body?.slice(0, 500);
    this.retryable = options.retryable ?? (options.status === undefined || options.status >= 500);
  }
}

/** El certificado de cliente no se puede usar (formato, contraseña, algoritmos antiguos…). */
export class CertificateError extends VerifactuError {
  override readonly name = 'CertificateError';
  constructor(message: string, options?: { cause?: unknown }) {
    super('CERTIFICATE', message, options);
  }
}

/** Se ha intentado enviar más registros de los que admite una petición (1000). */
export class BatchLimitError extends VerifactuError {
  override readonly name = 'BatchLimitError';
  readonly count: number;
  constructor(count: number) {
    super(
      'BATCH_LIMIT',
      `Una petición admite como máximo 1000 registros (se han pasado ${count}). Usa chunkRecords().`,
    );
    this.count = count;
  }
}

/** La respuesta es XML pero no tiene la estructura esperada. */
export class UnexpectedResponseError extends VerifactuError {
  override readonly name = 'UnexpectedResponseError';
  constructor(message: string, options?: { cause?: unknown }) {
    super('UNEXPECTED_RESPONSE', message, options);
  }
}
