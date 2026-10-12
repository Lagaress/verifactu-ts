import { InvalidArgumentError } from '../common/errors.ts';
import type { InvoiceRecord } from '../models/records.ts';
import { NAMESPACES } from '../xml/generated/namespaces.ts';
import { recordToXml } from '../xml/records.ts';
import { DEFAULT_PREFIXES, escapeAttribute, escapeText } from '../xml/writer.ts';
import { parseCertificate, pemBlocks, toBase64, type CertificateInfo } from './der.ts';

/**
 * Firma XAdES-EPES Enveloped de registros de facturación (modalidad NO VERI*FACTU).
 *
 * Especificación: «Especificaciones técnicas para la generación de la firma electrónica de los
 * registros de facturación» v0.1.5 (AEAT) y su ejemplo `ejemploRegistro-firmado-epes-xades4j.xml`:
 *
 * - se firma el nodo `RegistroAlta`/`RegistroAnulacion` completo (Reference `URI=""` con la
 *   transformación enveloped-signature) y la firma queda como su último hijo;
 * - canonicalización C14N 1.0 inclusiva, RSA-SHA256 y digest SHA-256;
 * - política de firma de la AGE (`urn:oid:2.16.724.1.3.1.1.2.1.9`), SigningTime,
 *   SigningCertificate y DataObjectFormat.
 *
 * Como el XML lo genera la propia librería en forma canónica, las formas canónicas se construyen
 * directamente (sin un canonicalizador genérico). `test/unit/xades` reproduce con esta misma
 * construcción los `DigestValue` y la `SignatureValue` del ejemplo oficial.
 */

const DS = NAMESPACES.ds;
const XADES = 'http://uri.etsi.org/01903/v1.3.2#';
const XADES141 = 'http://uri.etsi.org/01903/v1.4.1#';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SIGNED_PROPS_TYPE = 'http://uri.etsi.org/01903#SignedProperties';

/** Política de firma de la AGE exigida por la AEAT (Especificación de firma v0.1.5 §4). */
export const AGE_SIGNATURE_POLICY = {
  identifier: 'urn:oid:2.16.724.1.3.1.1.2.1.9',
  url: 'https://sede.administracion.gob.es/politica_de_firma_anexo_1.pdf',
  /** SHA-1 del documento de la política, en Base64. */
  digest: 'G7roucf600+f03r/o0bAOQ6WAs0=',
} as const;

/** Clave de Web Crypto (`CryptoKey`), sin depender de los tipos del DOM ni de Node. */
export type SigningKey = Parameters<typeof globalThis.crypto.subtle.sign>[1];

/** Credenciales de firma: clave privada RSA y certificados (el del firmante primero). */
export interface SigningCredentials {
  /** Clave privada RSASSA-PKCS1-v1_5 con hash SHA-256 (Web Crypto). */
  readonly privateKey: SigningKey;
  /** Certificados en DER: primero el del firmante y después, opcionalmente, la cadena. */
  readonly certificates: readonly Uint8Array[];
}

export interface SignOptions {
  /** Momento de la firma (`SigningTime`). Por defecto, ahora. */
  readonly signingTime?: Date;
  /** Identificador base de la firma. Por defecto, uno aleatorio. */
  readonly id?: string;
}

const subtle = () => globalThis.crypto.subtle;
const sha = async (alg: 'SHA-1' | 'SHA-256', data: Uint8Array | string) =>
  toBase64(
    new Uint8Array(
      await subtle().digest(alg, typeof data === 'string' ? new TextEncoder().encode(data) : data),
    ),
  );

/** Envuelve una clave RSA PKCS#1 (`RSA PRIVATE KEY`) en PKCS#8 para Web Crypto. */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const len = (n: number) =>
    n < 0x80
      ? [n]
      : n < 0x100
        ? [0x81, n]
        : n < 0x10000
          ? [0x82, n >> 8, n & 0xff]
          : [0x83, n >> 16, (n >> 8) & 0xff, n & 0xff];
  const algo = [
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ];
  const octet = [0x04, ...len(pkcs1.length)];
  const body = [0x02, 0x01, 0x00, ...algo, ...octet];
  const total = body.length + pkcs1.length;
  const out = new Uint8Array([0x30, ...len(total), ...body, ...pkcs1]);
  return out;
}

/**
 * Carga credenciales desde PEM: la clave privada (`PRIVATE KEY` PKCS#8 o `RSA PRIVATE KEY`
 * PKCS#1, sin cifrar) y uno o varios certificados (`CERTIFICATE`, el del firmante primero).
 *
 * Para convertir un PKCS#12: `openssl pkcs12 -in cert.p12 -nodes -out cert.pem`.
 */
export async function loadPemCredentials(pem: {
  readonly key: string;
  readonly certificates: string;
}): Promise<SigningCredentials> {
  const keyBlock = pemBlocks(pem.key).find(
    (b) => b.label === 'PRIVATE KEY' || b.label === 'RSA PRIVATE KEY',
  );
  if (!keyBlock) {
    const encrypted = pemBlocks(pem.key).some((b) => b.label === 'ENCRYPTED PRIVATE KEY');
    throw new InvalidArgumentError(
      encrypted
        ? 'La clave privada está cifrada; Web Crypto no admite claves PKCS#8 cifradas. Descífrala con: openssl pkcs8 -in clave.pem -out clave-sin-cifrar.pem'
        : 'No se ha encontrado la clave privada (PRIVATE KEY o RSA PRIVATE KEY) en el PEM.',
    );
  }
  const pkcs8 = keyBlock.label === 'RSA PRIVATE KEY' ? pkcs1ToPkcs8(keyBlock.der) : keyBlock.der;
  const privateKey = await subtle().importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const certificates = pemBlocks(pem.certificates)
    .filter((b) => b.label === 'CERTIFICATE')
    .map((b) => b.der);
  if (certificates.length === 0)
    throw new InvalidArgumentError(
      'No se ha encontrado ningún certificado (CERTIFICATE) en el PEM.',
    );
  return { privateKey, certificates };
}

/** @internal */
export const ns = (prefix: string, uri: string) => ` xmlns:${prefix}="${escapeAttribute(uri)}"`;

function signedProperties(
  id: string,
  signingTime: string,
  certs: readonly { info: CertificateInfo; sha1: string }[],
  canonicalNs: string,
): { canonical: string; inner: string; open: (canonical: boolean) => string } {
  const certXml = certs
    .map(
      (c) =>
        `<xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="${SHA1}"></ds:DigestMethod><ds:DigestValue>${c.sha1}</ds:DigestValue></xades:CertDigest>` +
        `<xades:IssuerSerial><ds:X509IssuerName>${escapeText(c.info.issuer)}</ds:X509IssuerName><ds:X509SerialNumber>${c.info.serialNumber}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert>`,
    )
    .join('');
  const inner =
    `<xades:SignedSignatureProperties><xades:SigningTime>${signingTime}</xades:SigningTime>` +
    `<xades:SigningCertificate>${certXml}</xades:SigningCertificate>` +
    `<xades:SignaturePolicyIdentifier><xades:SignaturePolicyId><xades:SigPolicyId><xades:Identifier>${AGE_SIGNATURE_POLICY.identifier}</xades:Identifier><xades:Description></xades:Description></xades:SigPolicyId>` +
    `<xades:SigPolicyHash><ds:DigestMethod Algorithm="${SHA1}"></ds:DigestMethod><ds:DigestValue>${AGE_SIGNATURE_POLICY.digest}</ds:DigestValue></xades:SigPolicyHash>` +
    `<xades:SigPolicyQualifiers><xades:SigPolicyQualifier><xades:SPURI>${AGE_SIGNATURE_POLICY.url}</xades:SPURI></xades:SigPolicyQualifier></xades:SigPolicyQualifiers></xades:SignaturePolicyId></xades:SignaturePolicyIdentifier></xades:SignedSignatureProperties>` +
    `<xades:SignedDataObjectProperties><xades:DataObjectFormat ObjectReference="#${id}-ref0"><xades:ObjectIdentifier><xades:Identifier>urn:oid:1.2.840.10003.5.109.10</xades:Identifier><xades:Description></xades:Description></xades:ObjectIdentifier>` +
    `<xades:MimeType>text/xml</xades:MimeType><xades:Encoding>UTF-8</xades:Encoding></xades:DataObjectFormat></xades:SignedDataObjectProperties></xades:SignedProperties>`;
  // C14N inclusiva: el elemento hereda los namespaces de sus ancestros (ds en Signature, el del
  // documento en la raíz, xades y xades141 en QualifyingProperties), ordenados por prefijo.
  const open = (canonical: boolean) =>
    `<xades:SignedProperties${canonical ? canonicalNs : ''} Id="${id}-signedprops">`;
  return { canonical: open(true) + inner, inner, open };
}

/**
 * `SignedInfo`; con `canonicalNs` = namespaces heredados, es su forma canónica (lo que se firma).
 * @internal
 */
export function signedInfo(
  id: string,
  documentDigest: string,
  propsDigest: string,
  canonicalNs: string,
): string {
  return (
    `<ds:SignedInfo${canonicalNs}><ds:CanonicalizationMethod Algorithm="${C14N}"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="${RSA_SHA256}"></ds:SignatureMethod>` +
    `<ds:Reference Id="${id}-ref0" URI=""><ds:Transforms><ds:Transform Algorithm="${ENVELOPED}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${SHA256}"></ds:DigestMethod><ds:DigestValue>${documentDigest}</ds:DigestValue></ds:Reference>` +
    `<ds:Reference Type="${SIGNED_PROPS_TYPE}" URI="#${id}-signedprops"><ds:Transforms><ds:Transform Algorithm="${C14N}"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="${SHA256}"></ds:DigestMethod><ds:DigestValue>${propsDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`
  );
}

/** `SigningTime` con milisegundos y huso de Europe/Madrid no es necesario: se usa UTC. */
const isoUtc = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Genera la firma XAdES-EPES Enveloped de un documento XML producido por la librería (en forma
 * canónica, sin declaración XML y con el único namespace del esquema declarado en la raíz).
 *
 * @param unsignedXml documento sin la firma (lo que queda tras la transformación enveloped)
 * @param root prefijo y namespace del elemento raíz, heredados en la C14N inclusiva
 * @returns el elemento `ds:Signature` serializado
 * @internal
 */
export async function signDocument(
  unsignedXml: string,
  root: { readonly prefix: string; readonly ns: string },
  credentials: SigningCredentials,
  options: SignOptions = {},
): Promise<string> {
  const [signer, ...chain] = credentials.certificates;
  if (!signer) throw new InvalidArgumentError('Se necesita al menos el certificado del firmante.');
  const certs = await Promise.all(
    [signer, ...chain].map(async (der) => ({
      info: parseCertificate(der),
      sha1: await sha('SHA-1', der),
    })),
  );
  const id = options.id ?? `xmldsig-${globalThis.crypto.randomUUID()}`;
  if (!/^[A-Za-z_][\w.-]*$/.test(id))
    throw new InvalidArgumentError(`Identificador de firma no válido: ${id}`);
  if (root.prefix === 'ds' || root.prefix.startsWith('xades')) {
    throw new InvalidArgumentError(`Prefijo de la raíz incompatible con la firma: ${root.prefix}`);
  }
  // Namespaces heredados en la C14N inclusiva, ordenados por prefijo.
  const inherited = (extra: [string, string][]) =>
    [['ds', DS] as [string, string], [root.prefix, root.ns] as [string, string], ...extra]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([p, u]) => ns(p, u))
      .join('');

  const documentDigest = await sha('SHA-256', unsignedXml);
  const props = signedProperties(
    id,
    isoUtc(options.signingTime ?? new Date()),
    certs,
    inherited([
      ['xades', XADES],
      ['xades141', XADES141],
    ]),
  );
  const propsDigest = await sha('SHA-256', props.canonical);
  const signedInfoCanonical = signedInfo(id, documentDigest, propsDigest, inherited([]));
  const signatureValue = toBase64(
    new Uint8Array(
      await subtle().sign(
        'RSASSA-PKCS1-v1_5',
        credentials.privateKey,
        new TextEncoder().encode(signedInfoCanonical),
      ),
    ),
  );

  const rsa = certs[0]?.info.rsa;
  const keyValue = rsa
    ? `<ds:KeyValue><ds:RSAKeyValue><ds:Modulus>${toBase64(rsa.modulus)}</ds:Modulus><ds:Exponent>${toBase64(rsa.exponent)}</ds:Exponent></ds:RSAKeyValue></ds:KeyValue>`
    : '';
  return (
    `<ds:Signature${ns('ds', DS)} Id="${id}">` +
    signedInfo(id, documentDigest, propsDigest, '') +
    `<ds:SignatureValue Id="${id}-sigvalue">${signatureValue}</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data>${certs.map((c) => `<ds:X509Certificate>${toBase64(c.info.der)}</ds:X509Certificate>`).join('')}</ds:X509Data>${keyValue}</ds:KeyInfo>` +
    `<ds:Object><xades:QualifyingProperties${ns('xades', XADES)}${ns('xades141', XADES141)} Target="#${id}">${props.open(false)}${props.inner}</xades:QualifyingProperties></ds:Object>` +
    `</ds:Signature>`
  );
}

/**
 * Firma un registro de facturación con XAdES-EPES Enveloped y devuelve una copia con la firma
 * en `signature`. La firma cubre el registro serializado por {@link recordToXml} y no altera su
 * huella. Si el registro ya estaba firmado, la firma se sustituye.
 *
 * Obligatoria en la modalidad NO VERI*FACTU; opcional en VERI*FACTU.
 *
 * @throws InvalidArgumentError si las credenciales no son válidas.
 */
export async function signRecord<R extends InvoiceRecord>(
  record: R,
  credentials: SigningCredentials,
  options: SignOptions = {},
): Promise<R> {
  const { signature: _previous, ...unsigned } = record;
  const xml = recordToXml(unsigned as unknown as InvoiceRecord);
  const raw = await signDocument(
    xml,
    { prefix: DEFAULT_PREFIXES.sf, ns: NAMESPACES.sf },
    credentials,
    options,
  );
  return { ...record, signature: { raw } };
}
