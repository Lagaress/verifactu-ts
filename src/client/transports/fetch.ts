import { TransportError } from '../errors.ts';
import type { Transport } from '../transport.ts';

export interface FetchTransportOptions {
  /** Implementación de `fetch`. Por defecto, `globalThis.fetch`. */
  readonly fetch?: typeof globalThis.fetch;
  /**
   * Opciones adicionales de `fetch` específicas del runtime para el certificado de cliente:
   *
   * - Deno: `{ client: Deno.createHttpClient({ cert, key }) }`
   * - Bun: `{ tls: { cert, key, passphrase } }`
   * - Node con undici: `{ dispatcher: new Agent({ connect: { pfx, passphrase } }) }`
   */
  readonly init?: Record<string, unknown>;
  /** Tiempo máximo de espera en milisegundos. Por defecto, 60 000. */
  readonly timeoutMs?: number;
}

/**
 * Transporte basado en `fetch` para cualquier runtime. El certificado de cliente se configura con
 * las opciones propias del runtime (`init`).
 *
 * @example
 * // Deno
 * const client = Deno.createHttpClient({ cert, key });
 * const transport = fetchTransport({ init: { client } });
 */
export function fetchTransport(options: FetchTransportOptions = {}): Transport {
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  return async (req) => {
    const signals = [AbortSignal.timeout(timeoutMs), ...(req.signal ? [req.signal] : [])];
    let res: Response;
    try {
      res = await doFetch(req.url, {
        ...options.init,
        method: 'POST',
        headers: req.headers,
        body: req.body,
        signal: AbortSignal.any(signals),
      });
    } catch (cause) {
      const timeout = cause instanceof DOMException && cause.name === 'TimeoutError';
      throw new TransportError(
        timeout
          ? `La AEAT no ha respondido en ${timeoutMs} ms.`
          : 'No se ha podido conectar con la AEAT.',
        { cause, retryable: true },
      );
    }
    return { status: res.status, body: await res.text() };
  };
}
