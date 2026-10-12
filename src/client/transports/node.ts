import { Agent, request } from 'node:https';
import { createSecureContext, type SecureContextOptions } from 'node:tls';
import { CertificateError, TransportError } from '../errors.ts';
import type { Transport } from '../transport.ts';

/**
 * Certificado de cliente para la conexión con la AEAT:
 *
 * - PKCS#12 (`.p12`/`.pfx`): `{ pfx, passphrase }`;
 * - PEM: `{ cert, key, passphrase? }` (`cert` puede incluir la cadena de certificados).
 *
 * El certificado se mantiene en memoria; la librería nunca lo escribe en disco.
 */
export type ClientCertificate =
  | { readonly pfx: Uint8Array; readonly passphrase?: string }
  | {
      readonly cert: string | Uint8Array;
      readonly key: string | Uint8Array;
      readonly passphrase?: string;
    };

export interface NodeTransportOptions {
  /** Tiempo máximo de espera en milisegundos. Por defecto, 60 000. */
  readonly timeoutMs?: number;
  /** Reutilizar la conexión TLS entre peticiones. Por defecto, `true`. */
  readonly keepAlive?: boolean;
  /** Certificados de CA adicionales. No suelen ser necesarios: los de la AEAT están en el almacén de Node. */
  readonly ca?: string | Uint8Array | readonly (string | Uint8Array)[];
}

const LEGACY_HINT =
  'El certificado PKCS#12 usa algoritmos antiguos (p. ej. RC2-40, habitual en exportaciones de Windows o de la FNMT) ' +
  'que OpenSSL 3 ya no admite por defecto. Conviértelo con:\n' +
  '  openssl pkcs12 -legacy -in antiguo.p12 -nodes -out tmp.pem && openssl pkcs12 -export -in tmp.pem -out nuevo.p12 && rm tmp.pem\n' +
  'o ejecuta Node con NODE_OPTIONS=--openssl-legacy-provider.';

function tlsOptions(cert: ClientCertificate): SecureContextOptions {
  if ('pfx' in cert)
    return {
      pfx: Buffer.from(cert.pfx),
      ...(cert.passphrase !== undefined && { passphrase: cert.passphrase }),
    };
  return {
    cert: typeof cert.cert === 'string' ? cert.cert : Buffer.from(cert.cert),
    key: typeof cert.key === 'string' ? cert.key : Buffer.from(cert.key),
    ...(cert.passphrase !== undefined && { passphrase: cert.passphrase }),
  };
}

/** Comprueba que el certificado se puede cargar y traduce los errores de OpenSSL. */
function checkCertificate(options: SecureContextOptions): void {
  try {
    createSecureContext(options);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/unsupported pkcs12|unsupported algorithm|RC2/i.test(message))
      throw new CertificateError(LEGACY_HINT, { cause });
    if (/mac verify|bad decrypt|wrong password|bad password/i.test(message)) {
      throw new CertificateError('La contraseña del certificado no es correcta.', { cause });
    }
    throw new CertificateError(`No se ha podido cargar el certificado de cliente: ${message}`, {
      cause,
    });
  }
}

/**
 * Transporte para Node.js con `node:https` y certificado de cliente. Sin dependencias.
 *
 * El certificado se valida al crear el transporte, de modo que los problemas (contraseña,
 * formato, algoritmos antiguos) se detectan antes del primer envío.
 *
 * @throws CertificateError si el certificado no se puede cargar.
 *
 * @example
 * const transport = nodeTransport({ pfx: await readFile('certificado.p12'), passphrase: process.env.CERT_PASS });
 */
export function nodeTransport(
  certificate: ClientCertificate,
  options: NodeTransportOptions = {},
): Transport {
  const tls = tlsOptions(certificate);
  if (options.ca !== undefined) {
    const list = Array.isArray(options.ca) ? options.ca : [options.ca];
    tls.ca = list.map((c: string | Uint8Array) => (typeof c === 'string' ? c : Buffer.from(c)));
  }
  checkCertificate(tls);
  const agent = new Agent({ ...tls, keepAlive: options.keepAlive ?? true, maxCachedSessions: 10 });
  const timeoutMs = options.timeoutMs ?? 60_000;

  return (req) =>
    new Promise((resolve, reject) => {
      const body = Buffer.from(req.body, 'utf8');
      const r = request(
        req.url,
        {
          method: 'POST',
          agent,
          headers: { ...req.headers, 'Content-Length': String(body.length) },
          timeout: timeoutMs,
          ...(req.signal && { signal: req.signal }),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
          });
          res.on('error', (cause) => {
            reject(
              new TransportError('La conexión con la AEAT se ha interrumpido.', {
                cause,
                retryable: true,
              }),
            );
          });
        },
      );
      r.on('timeout', () => {
        r.destroy(
          new TransportError(`La AEAT no ha respondido en ${timeoutMs} ms.`, { retryable: true }),
        );
      });
      r.on('error', (cause) => {
        if (cause instanceof TransportError) {
          reject(cause);
          return;
        }
        const code = (cause as { code?: string }).code ?? '';
        if (
          /CERT|SSL|TLS|HANDSHAKE/i.test(code) ||
          /alert|certificate|handshake/i.test(cause.message)
        ) {
          reject(
            new CertificateError(`Error TLS al conectar con la AEAT: ${cause.message}`, { cause }),
          );
          return;
        }
        reject(
          new TransportError(`No se ha podido conectar con la AEAT: ${cause.message}`, {
            cause,
            retryable: true,
          }),
        );
      });
      r.end(body);
    });
}
