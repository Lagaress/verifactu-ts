/**
 * Transporte HTTP del cliente. Es la única pieza con E/S: recibe la petición SOAP ya construida y
 * devuelve la respuesta en bruto. Se puede sustituir para usar otro cliente HTTP, otro runtime o
 * un doble de pruebas (ver `verifactu-ts/testing`).
 *
 * El transporte se encarga del TLS con certificado de cliente; el cliente de la librería nunca
 * toca el certificado.
 */
export interface TransportRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Cuerpo SOAP en UTF-8. */
  readonly body: string;
  /** Señal para cancelar la petición. */
  readonly signal?: AbortSignal;
}

export interface TransportResponse {
  /** Código de estado HTTP. La AEAT devuelve 500 en los SOAP Fault. */
  readonly status: number;
  /** Cuerpo de la respuesta decodificado como UTF-8. */
  readonly body: string;
}

/**
 * Envía una petición. Debe resolver con cualquier respuesta HTTP (también 4xx/5xx) y rechazar solo
 * si no hay respuesta (red, TLS, tiempo de espera), preferiblemente con `TransportError`.
 */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;
