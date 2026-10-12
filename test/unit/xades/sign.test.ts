import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateXML } from 'xmllint-wasm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createRegistrationRecord,
  recordFromXml,
  recordToXml,
  sha256Hex,
} from '../../../src/index.ts';
import { fromBase64, parseCertificate, toBase64 } from '../../../src/xades/der.ts';
import { loadPemCredentials, ns, signedInfo, signRecord } from '../../../src/xades/sign.ts';
import { f1Input } from '../../helpers.ts';
import { xsdErrors } from '../../xsd/xsd.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const EXAMPLE = readFileSync(
  join(ROOT, 'spec/aeat/2026-10-12/examples/ejemploRegistro-firmado-epes-xades4j.xml'),
  'utf8',
);
const DS = 'http://www.w3.org/2000/09/xmldsig#';
const SF =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';

const pick = (xml: string, re: RegExp) => re.exec(xml)?.[1] ?? '';
const b64 = (s: string) => s.replace(/&#13;|\s/g, '');

async function verifyRsa(
  certDer: Uint8Array,
  signature: Uint8Array,
  data: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'spki',
    parseCertificate(certDer).spki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(data));
}

/** C14N de libxml2 (xmllint-wasm), independiente de la implementación de la librería. */
async function c14n(xml: string): Promise<string> {
  const r = await validateXML({
    xml: [{ fileName: 'x.xml', contents: xml }],
    normalization: 'c14n',
  });
  // xmllint añade un salto de línea final que no forma parte de la forma canónica.
  return r.normalized.replace(/\n$/, '');
}

const sha256b64 = async (s: string) =>
  toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));

describe('firma XAdES: ejemplo oficial de la AEAT', () => {
  it('lee el certificado FNMT del ejemplo', () => {
    const cert = parseCertificate(
      fromBase64(b64(pick(EXAMPLE, /<ds:X509Certificate>([\s\S]*?)<\/ds:X509Certificate>/))),
    );
    expect(cert.issuer).toBe('cn=AC FNMT Usuarios,ou=Ceres,o=FNMT-RCM,c=ES');
    expect(cert.serialNumber).toBe('80044384284793334134753462931839354305');
  });

  it('la forma canónica de SignedInfo que construye la librería verifica la SignatureValue oficial', async () => {
    const id = pick(EXAMPLE, /<ds:Signature [^>]*Id="([^"]+)"/);
    const [docDigest = '', propsDigest = ''] = [
      ...EXAMPLE.matchAll(/<ds:Reference[\s\S]*?<ds:DigestValue>([^<]+)</g),
    ].map((m) => m[1] ?? '');
    const canonical = signedInfo(id, docDigest, propsDigest, ns('ds', DS) + ns('sum1', SF));
    const cert = fromBase64(
      b64(pick(EXAMPLE, /<ds:X509Certificate>([\s\S]*?)<\/ds:X509Certificate>/)),
    );
    const sig = fromBase64(
      b64(pick(EXAMPLE, /<ds:SignatureValue[^>]*>([\s\S]*?)<\/ds:SignatureValue>/)),
    );
    // xades4j escribe SignedInfo con saltos de línea; la forma canónica los conserva.
    const officialSignedInfo = /<ds:SignedInfo[\s\S]*<\/ds:SignedInfo>/
      .exec(await c14n(EXAMPLE.replace(/^<\?xml[^>]*\?>/, '')))?.[0]
      ?.replace('<ds:SignedInfo>', `<ds:SignedInfo${ns('ds', DS)}${ns('sum1', SF)}>`);
    expect(await verifyRsa(cert, sig, officialSignedInfo ?? '')).toBe(true);
    // La plantilla de la librería es la misma estructura sin espacios entre elementos.
    expect(canonical).toBe(officialSignedInfo?.replace(/>\s+</g, '><'));
  });

  it('el DigestValue del documento es el SHA-256 de su forma canónica sin la firma', async () => {
    const unsigned = EXAMPLE.replace(/<ds:Signature[\s\S]*<\/ds:Signature>/, '').replace(
      /^<\?xml[^>]*\?>/,
      '',
    );
    expect(await sha256b64(await c14n(unsigned))).toBe(pick(EXAMPLE, /<ds:DigestValue>([^<]+)</));
  });
});

describe('firma XAdES: registros propios', () => {
  let dir: string;
  let pem: { key: string; certificates: string };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'verifactu-xades-'));
    const ssl = (...a: string[]) => execFileSync('openssl', a, { cwd: dir, stdio: 'pipe' });
    ssl(
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      'key.pem',
      '-out',
      'cert.pem',
      '-days',
      '1',
      '-subj',
      '/C=ES/O=Pruebas, S.L./CN=FIRMANTE PRUEBA - 00000000T',
    );
    ssl('rsa', '-in', 'key.pem', '-traditional', '-out', 'key-pkcs1.pem');
    pem = {
      key: readFileSync(join(dir, 'key.pem'), 'utf8'),
      certificates: readFileSync(join(dir, 'cert.pem'), 'utf8'),
    };
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('genera una firma XAdES-EPES verificable de forma independiente', async () => {
    const record = await createRegistrationRecord(
      f1Input({ description: 'Línea con "comillas" & <signos>' }),
    );
    const signed = await signRecord(record, await loadPemCredentials(pem), {
      signingTime: new Date('2025-06-01T08:20:31Z'),
      id: 'firma-1',
    });
    const xml = recordToXml(signed);
    const sig = signed.signature?.raw ?? '';

    // 1. Esquema: el registro firmado cumple SuministroInformacion.xsd (incluido xmldsig).
    expect(await xsdErrors(xml, 'SuministroInformacion.xsd')).toEqual([]);

    // 2. Referencia al documento: C14N de libxml2 del registro sin la firma.
    const docDigest = [...sig.matchAll(/<ds:DigestValue>([^<]+)</g)].map((m) => m[1]);
    expect(await sha256b64(await c14n(xml.replace(sig, '')))).toBe(docDigest[0]);

    // 3. Referencia a SignedProperties: subárbol con los namespaces heredados declarados.
    const props = /<xades:SignedProperties[\s\S]*<\/xades:SignedProperties>/.exec(xml)?.[0] ?? '';
    const standaloneProps = props.replace(
      '<xades:SignedProperties',
      `<xades:SignedProperties xmlns:xades141="http://uri.etsi.org/01903/v1.4.1#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:sum1="${SF}" xmlns:ds="${DS}"`,
    );
    expect(await sha256b64(await c14n(standaloneProps))).toBe(docDigest[1]);

    // 4. SignatureValue sobre la C14N de libxml2 de SignedInfo.
    const si = /<ds:SignedInfo>[\s\S]*<\/ds:SignedInfo>/.exec(xml)?.[0] ?? '';
    const siCanonical = await c14n(
      si.replace('<ds:SignedInfo>', `<ds:SignedInfo xmlns:sum1="${SF}" xmlns:ds="${DS}">`),
    );
    const certDer = fromBase64(pick(sig, /<ds:X509Certificate>([^<]+)</));
    expect(
      await verifyRsa(
        certDer,
        fromBase64(pick(sig, /<ds:SignatureValue[^>]*>([^<]+)</)),
        siCanonical,
      ),
    ).toBe(true);

    // 5. Contenido XAdES-EPES.
    expect(sig).toContain('<xades:Identifier>urn:oid:2.16.724.1.3.1.1.2.1.9</xades:Identifier>');
    expect(sig).toContain('<ds:DigestValue>G7roucf600+f03r/o0bAOQ6WAs0=</ds:DigestValue>');
    expect(sig).toContain('<xades:SigningTime>2025-06-01T08:20:31Z</xades:SigningTime>');
    expect(sig).toContain(
      '<ds:X509IssuerName>cn=FIRMANTE PRUEBA - 00000000T,o=Pruebas\\, S.L.,c=ES</ds:X509IssuerName>',
    );
  });

  it('la firma no altera la huella y se conserva al leer y reescribir el XML', async () => {
    const record = await createRegistrationRecord(f1Input());
    const signed = await signRecord(record, await loadPemCredentials(pem));
    expect(signed.hash).toBe(record.hash);
    const back = recordFromXml(recordToXml(signed));
    expect(back.signature?.raw).toBe(signed.signature?.raw);
    expect(recordToXml(back)).toBe(recordToXml(signed));
    // Volver a firmar sustituye la firma anterior.
    const resigned = await signRecord(signed, await loadPemCredentials(pem));
    expect(recordToXml(resigned).match(/<ds:Signature /g)).toHaveLength(1);
  });

  it('acepta claves PKCS#1 y explica las claves cifradas', async () => {
    const pkcs1 = readFileSync(join(dir, 'key-pkcs1.pem'), 'utf8');
    expect(pkcs1).toContain('BEGIN RSA PRIVATE KEY');
    const record = await createRegistrationRecord(f1Input());
    await expect(
      signRecord(record, await loadPemCredentials({ key: pkcs1, certificates: pem.certificates })),
    ).resolves.toHaveProperty('signature');
    await expect(
      loadPemCredentials({
        key: '-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----',
        certificates: pem.certificates,
      }),
    ).rejects.toThrow(/cifrada/);
    expect(await sha256Hex('x')).toHaveLength(64);
  });
});
