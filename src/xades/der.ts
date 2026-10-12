import { InvalidArgumentError } from '../common/errors.ts';

/**
 * Lector DER mínimo, suficiente para extraer de un certificado X.509 los datos que necesita la
 * firma XAdES: emisor, número de serie y clave pública RSA. No valida el certificado.
 */
export interface DerNode {
  readonly tag: number;
  /** Contenido (sin cabecera). */
  readonly value: Uint8Array;
  /** Nodo completo (cabecera + contenido). */
  readonly raw: Uint8Array;
}

export function readDer(bytes: Uint8Array, offset = 0): DerNode {
  const fail = (): never => {
    throw new InvalidArgumentError('Estructura DER no válida');
  };
  if (offset + 2 > bytes.length) fail();
  const tag = bytes[offset] ?? fail();
  let len = bytes[offset + 1] ?? fail();
  let header = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) fail();
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + (bytes[offset + 2 + i] ?? fail());
    header += n;
  }
  const end = offset + header + len;
  if (end > bytes.length) fail();
  return { tag, value: bytes.subarray(offset + header, end), raw: bytes.subarray(offset, end) };
}

/** Hijos de un nodo construido (SEQUENCE, SET, [n]…). */
export function children(node: DerNode): DerNode[] {
  const out: DerNode[] = [];
  for (let i = 0; i < node.value.length;) {
    const child = readDer(node.value, i);
    out.push(child);
    i += child.raw.length;
  }
  return out;
}

const child = (node: DerNode, i: number): DerNode => {
  const c = children(node)[i];
  if (!c) throw new InvalidArgumentError('Certificado X.509 incompleto');
  return c;
};

function oid(bytes: Uint8Array): string {
  const parts: number[] = [];
  let acc = 0;
  for (const b of bytes) {
    acc = acc * 128 + (b & 0x7f);
    if (!(b & 0x80)) {
      if (parts.length === 0)
        parts.push(acc < 80 ? Math.floor(acc / 40) : 2, acc < 80 ? acc % 40 : acc - 80);
      else parts.push(acc);
      acc = 0;
    }
  }
  return parts.join('.');
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

function unsignedBigInt(bytes: Uint8Array): bigint {
  return bytes.length === 0 ? 0n : BigInt(`0x${hex(bytes)}`);
}

/** Nombres cortos de RFC 4514 (en minúsculas, como los escribe xades4j en el ejemplo oficial). */
const SHORT_NAMES: Readonly<Record<string, string>> = {
  '2.5.4.3': 'cn',
  '2.5.4.6': 'c',
  '2.5.4.7': 'l',
  '2.5.4.8': 'st',
  '2.5.4.9': 'street',
  '2.5.4.10': 'o',
  '2.5.4.11': 'ou',
  '0.9.2342.19200300.100.1.25': 'dc',
  '0.9.2342.19200300.100.1.1': 'uid',
};

/** Tipos de cadena ASN.1 que se pueden escribir como texto. */
const STRING_TAGS = new Set([0x0c, 0x13, 0x14, 0x16, 0x1a, 0x1e]);

function decodeString(node: DerNode): string {
  if (node.tag === 0x1e) {
    // BMPString (UTF-16BE)
    let s = '';
    for (let i = 0; i + 1 < node.value.length; i += 2)
      s += String.fromCharCode(((node.value[i] ?? 0) << 8) | (node.value[i + 1] ?? 0));
    return s;
  }
  return new TextDecoder(node.tag === 0x0c ? 'utf-8' : 'latin1').decode(node.value);
}

/** Escapa un valor de atributo según RFC 4514 §2.4. */
function escapeDnValue(v: string): string {
  let out = v.replace(/[\\",+;<>=]/g, (c) => `\\${c}`);
  if (out.startsWith('#') || out.startsWith(' ')) out = `\\${out}`;
  if (out.endsWith(' ')) out = `${out.slice(0, -1)}\\ `;
  return out;
}

/** Nombre distinguido en formato RFC 4514 (el RDN más específico primero). */
function distinguishedName(name: DerNode): string {
  return children(name)
    .reverse()
    .map((rdn) =>
      children(rdn)
        .map((atv) => {
          const [type, value] = children(atv);
          if (!type || !value) throw new InvalidArgumentError('Nombre X.500 no válido');
          const id = oid(type.value);
          const short = SHORT_NAMES[id];
          return short && STRING_TAGS.has(value.tag)
            ? `${short}=${escapeDnValue(decodeString(value))}`
            : `${id}=#${hex(value.raw)}`;
        })
        .join('+'),
    )
    .join(',');
}

/** Datos de un certificado X.509 que usa la firma XAdES. */
export interface CertificateInfo {
  /** Certificado completo en DER. */
  readonly der: Uint8Array;
  /** Emisor en formato RFC 4514. */
  readonly issuer: string;
  /** Número de serie en decimal. */
  readonly serialNumber: string;
  /** Clave pública (SubjectPublicKeyInfo en DER). */
  readonly spki: Uint8Array;
  /** Módulo y exponente RSA (big-endian, sin ceros iniciales), si la clave es RSA. */
  readonly rsa?: { readonly modulus: Uint8Array; readonly exponent: Uint8Array };
}

const stripLeadingZeros = (b: Uint8Array) => {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  return b.subarray(i);
};

/** Lee un certificado X.509 en DER. */
export function parseCertificate(der: Uint8Array): CertificateInfo {
  const cert = readDer(der);
  const tbs = child(cert, 0);
  const fields = children(tbs);
  // version [0] es opcional
  const base = fields[0]?.tag === 0xa0 ? 1 : 0;
  const serial = fields[base];
  const issuer = fields[base + 2];
  const spki = fields[base + 5];
  if (!serial || !issuer || !spki) throw new InvalidArgumentError('Certificado X.509 incompleto');
  const algorithm = oid(child(child(spki, 0), 0).value);
  let rsa: CertificateInfo['rsa'];
  if (algorithm === '1.2.840.113549.1.1.1') {
    const bitString = child(spki, 1);
    const key = readDer(bitString.value.subarray(1)); // primer byte: bits sin usar
    const [modulus, exponent] = children(key);
    if (modulus && exponent)
      rsa = {
        modulus: stripLeadingZeros(modulus.value),
        exponent: stripLeadingZeros(exponent.value),
      };
  }
  return {
    der,
    issuer: distinguishedName(issuer),
    serialNumber: unsignedBigInt(serial.value).toString(10),
    spki: spki.raw,
    ...(rsa && { rsa }),
  };
}

/** Bloques PEM de un texto (`-----BEGIN <label>-----`). */
export function pemBlocks(pem: string): { label: string; der: Uint8Array }[] {
  const out: { label: string; der: Uint8Array }[] = [];
  for (const m of pem.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g)) {
    const b64 = (m[2] ?? '').replace(/[^A-Za-z0-9+/=]/g, '');
    out.push({ label: m[1] ?? '', der: fromBase64(b64) });
  }
  return out;
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
