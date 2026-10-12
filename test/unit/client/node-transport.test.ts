import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TLSSocket } from 'node:tls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CertificateError, TransportError } from '../../../src/client/index.ts';
import { nodeTransport } from '../../../src/client/transports/node.ts';

/**
 * Transporte de Node con TLS real: CA, servidor y cliente generados con openssl en un directorio
 * temporal. Nunca se usan certificados reales.
 */
const hasOpenssl = (() => {
  try {
    execFileSync('openssl', ['version']);
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasOpenssl)('nodeTransport', () => {
  let dir: string;
  let server: Server | undefined;
  let url: string;
  const file = (name: string) => readFileSync(join(dir, name));
  const ssl = (...args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'verifactu-tls-'));
    ssl(
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      'ca.key',
      '-out',
      'ca.pem',
      '-days',
      '1',
      '-subj',
      '/CN=CA de pruebas',
    );
    writeFileSync(join(dir, 'server.ext'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\n');
    for (const [name, cn] of [
      ['server', 'localhost'],
      ['client', 'CLIENTE PRUEBA - 00000000T'],
    ] as const) {
      ssl(
        'req',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        `${name}.key`,
        '-out',
        `${name}.csr`,
        '-subj',
        `/CN=${cn}`,
      );
      const ext = name === 'server' ? ['-extfile', 'server.ext'] : [];
      ssl(
        'x509',
        '-req',
        '-in',
        `${name}.csr`,
        '-CA',
        'ca.pem',
        '-CAkey',
        'ca.key',
        '-CAcreateserial',
        '-out',
        `${name}.pem`,
        '-days',
        '1',
        ...ext,
      );
    }
    ssl(
      'pkcs12',
      '-export',
      '-inkey',
      'client.key',
      '-in',
      'client.pem',
      '-out',
      'client.p12',
      '-passout',
      'pass:secreto',
    );
    // PKCS#12 «antiguo» (RC2-40), como los que exportan Windows o la FNMT.
    try {
      ssl(
        'pkcs12',
        '-export',
        '-legacy',
        '-inkey',
        'client.key',
        '-in',
        'client.pem',
        '-out',
        'legacy.p12',
        '-passout',
        'pass:secreto',
      );
    } catch {
      ssl(
        'pkcs12',
        '-export',
        '-certpbe',
        'PBE-SHA1-RC2-40',
        '-keypbe',
        'PBE-SHA1-RC2-40',
        '-inkey',
        'client.key',
        '-in',
        'client.pem',
        '-out',
        'legacy.p12',
        '-passout',
        'pass:secreto',
      );
    }

    server = createServer(
      {
        key: file('server.key'),
        cert: file('server.pem'),
        ca: file('ca.pem'),
        requestCert: true,
        rejectUnauthorized: true,
      },
      (req, res) => {
        let body = '';
        req.on('data', (c: Buffer) => (body += c.toString('utf8')));
        req.on('end', () => {
          if (req.url === '/lento') return; // no responde nunca
          const cn = String((req.socket as TLSSocket).getPeerCertificate().subject.CN);
          res.writeHead(req.url === '/error' ? 500 : 200, { 'Content-Type': 'text/xml' });
          res.end(`${String(req.headers['content-type'])}|${cn}|${body}`);
        });
      },
    );
    const listening = server;
    await new Promise<void>((resolve) => listening.listen(0, '127.0.0.1', resolve));
    url = `https://localhost:${(listening.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    // Si beforeAll falló, el servidor no existe.
    if (typeof server !== 'undefined') {
      server.closeAllConnections();
      server.close();
    }
    rmSync(dir, { recursive: true, force: true });
  });

  const send = (t: ReturnType<typeof nodeTransport>, path = '/') =>
    t({
      url: url + path,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: '<ñ>€</ñ>',
    });

  it('envía con certificado PKCS#12 y devuelve cualquier estado HTTP', async () => {
    const t = nodeTransport(
      { pfx: file('client.p12'), passphrase: 'secreto' },
      { ca: file('ca.pem') },
    );
    expect(await send(t)).toEqual({
      status: 200,
      body: 'text/xml; charset=utf-8|CLIENTE PRUEBA - 00000000T|<ñ>€</ñ>',
    });
    expect((await send(t, '/error')).status).toBe(500);
  });

  it('envía con certificado PEM', async () => {
    const t = nodeTransport(
      { cert: file('client.pem'), key: file('client.key').toString() },
      { ca: file('ca.pem') },
    );
    expect((await send(t)).body).toContain('CLIENTE PRUEBA');
  });

  it('detecta una contraseña incorrecta al crear el transporte', () => {
    expect(() => nodeTransport({ pfx: file('client.p12'), passphrase: 'otra' })).toThrow(
      /contraseña/,
    );
  });

  it('explica cómo convertir un PKCS#12 con algoritmos antiguos', () => {
    let error: unknown;
    try {
      nodeTransport({ pfx: file('legacy.p12'), passphrase: 'secreto' }, { ca: file('ca.pem') });
    } catch (e) {
      error = e;
    }
    // Con --openssl-legacy-provider Node sí puede cargarlo; en ese caso no hay error.
    const legacyProvider =
      `${process.env['NODE_OPTIONS'] ?? ''} ${process.execArgv.join(' ')}`.includes(
        'legacy-provider',
      );
    if (legacyProvider) return;
    expect(error).toBeInstanceOf(CertificateError);
    expect((error as Error).message).toMatch(/openssl pkcs12 -legacy/);
  });

  it('falla con CertificateError si el servidor no es de confianza', async () => {
    const t = nodeTransport({ pfx: file('client.p12'), passphrase: 'secreto' });
    await expect(send(t)).rejects.toBeInstanceOf(CertificateError);
  });

  it('aplica el tiempo de espera y los errores de conexión son reintentables', async () => {
    const t = nodeTransport(
      { pfx: file('client.p12'), passphrase: 'secreto' },
      { ca: file('ca.pem'), timeoutMs: 200 },
    );
    await expect(send(t, '/lento')).rejects.toMatchObject({
      name: 'TransportError',
      retryable: true,
    });
    const closed = nodeTransport(
      { pfx: file('client.p12'), passphrase: 'secreto' },
      { ca: file('ca.pem') },
    );
    const error = await closed({ url: 'https://127.0.0.1:1/', headers: {}, body: '' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(TransportError);
  });
});
