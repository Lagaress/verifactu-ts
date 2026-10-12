import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateXML } from 'xmllint-wasm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createEventRecord,
  eventFromXml,
  eventHashInput,
  eventToXml,
  EventType,
  loadPemCredentials,
  toEventChainLink,
  verifyEventChain,
  type EventRecord,
  type SigningCredentials,
} from 'verifactu-ts/no-verifactu';
import { InvalidArgumentError, ValidationError } from '../../../src/index.ts';
import { fromBase64, parseCertificate, toBase64 } from '../../../src/xades/der.ts';
import { SYSTEM } from '../../helpers.ts';
import { xsdErrors } from '../../xsd/xsd.ts';

const EV =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/EventosSIF.xsd';
const DS = 'http://www.w3.org/2000/09/xmldsig#';
const taxpayer = { name: 'Perico de los Palotes, S.A.', nif: 'A00000000' };

let dir: string;
let creds: SigningCredentials;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'verifactu-events-'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      'k.pem',
      '-out',
      'c.pem',
      '-days',
      '1',
      '-subj',
      '/CN=FIRMANTE EVENTOS',
    ],
    { cwd: dir, stdio: 'pipe' },
  );
  creds = await loadPemCredentials({
    key: readFileSync(join(dir, 'k.pem'), 'utf8'),
    certificates: readFileSync(join(dir, 'c.pem'), 'utf8'),
  });
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const c14n = async (xml: string) =>
  (
    await validateXML({ xml: [{ fileName: 'x.xml', contents: xml }], normalization: 'c14n' })
  ).normalized.replace(/\n$/, '');
const sha = async (s: string) =>
  toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));

async function chain(): Promise<EventRecord[]> {
  const start = await createEventRecord(
    {
      system: SYSTEM,
      taxpayer,
      eventType: EventType.StartNoVerifactu,
      previous: null,
      generatedAt: '2025-06-01T09:00:00+02:00',
    },
    creds,
  );
  const check = await createEventRecord(
    {
      system: SYSTEM,
      taxpayer,
      eventType: EventType.InvoiceAnomalyCheck,
      details: {
        LanzamientoProcesoDeteccionAnomaliasRegFacturacion: {
          RealizadoProcesoSobreIntegridadHuellasRegFacturacion: 'S',
          NumeroDeRegistrosFacturacionProcesadosSobreIntegridadHuellas: '120',
          RealizadoProcesoSobreIntegridadFirmasRegFacturacion: 'S',
          RealizadoProcesoSobreTrazabilidadCadenaRegFacturacion: 'S',
          RealizadoProcesoSobreTrazabilidadFechasRegFacturacion: 'N',
        },
      },
      otherData: 'Revisión diaria',
      previous: toEventChainLink(start),
      generatedAt: '2025-06-01T23:00:00+02:00',
    },
    creds,
  );
  return [start, check];
}

describe('registros de evento (NO VERI*FACTU)', () => {
  it('calcula la huella con los campos de la especificación v0.1.2 §3.c', () => {
    expect(
      eventHashInput({
        system: SYSTEM,
        taxpayer,
        eventType: '01',
        previous: null,
        generatedAt: '2025-06-01T09:00:00+02:00',
      }),
    ).toBe(
      'NIF=A00000000&ID=&IdSistemaInformatico=TS&Version=0.0.1&NumeroInstalacion=01234&NIF=A00000000&TipoEvento=01&HuellaEvento=&FechaHoraHusoGenEvento=2025-06-01T09:00:00+02:00',
    );
  });

  it('genera eventos firmados y encadenados que cumplen EventosSIF.xsd', async () => {
    const events = await chain();
    expect(await verifyEventChain(events)).toEqual([]);
    for (const e of events) {
      const xml = eventToXml(e);
      expect(await xsdErrors(xml, 'EventosSIF.xsd')).toEqual([]);
      expect(eventFromXml(xml)).toEqual(e);
    }
    expect(eventToXml(events[0]!)).toContain('<sf:PrimerEvento>S</sf:PrimerEvento>');
    expect((await verifyEventChain([events[1]!])).length).toBe(1);
  });

  it('la firma del evento se verifica de forma independiente (libxml2 + Web Crypto)', async () => {
    const [event] = await chain();
    const xml = eventToXml(event!);
    const sig = event!.signature.raw;
    const digests = [...sig.matchAll(/<ds:DigestValue>([^<]+)</g)].map((m) => m[1]);
    expect(await sha(await c14n(xml.replace(sig, '')))).toBe(digests[0]);
    const props = /<xades:SignedProperties[\s\S]*<\/xades:SignedProperties>/.exec(xml)![0];
    const propsDoc = props.replace(
      '<xades:SignedProperties',
      `<xades:SignedProperties xmlns:sf="${EV}" xmlns:ds="${DS}" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:xades141="http://uri.etsi.org/01903/v1.4.1#"`,
    );
    expect(await sha(await c14n(propsDoc))).toBe(digests[1]);
    const si = /<ds:SignedInfo>[\s\S]*<\/ds:SignedInfo>/
      .exec(xml)![0]
      .replace('<ds:SignedInfo>', `<ds:SignedInfo xmlns:sf="${EV}" xmlns:ds="${DS}">`);
    const cert = fromBase64(/<ds:X509Certificate>([^<]+)</.exec(sig)![1]!);
    const key = await crypto.subtle.importKey(
      'spki',
      parseCertificate(cert).spki,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const value = fromBase64(/<ds:SignatureValue[^>]*>([^<]+)</.exec(sig)![1]!);
    expect(
      await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        value,
        new TextEncoder().encode(await c14n(si)),
      ),
    ).toBe(true);
  });

  it('valida los datos y rechaza países que EventosSIF.xsd no admite', async () => {
    const base = {
      system: SYSTEM,
      taxpayer,
      eventType: EventType.Other,
      previous: null,
      generatedAt: '2025-06-01T09:00:00+02:00',
    } as const;
    await expect(
      createEventRecord({ ...base, generatedAt: '2025-06-01 09:00' }, creds),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createEventRecord({ ...base, otherData: 'x'.repeat(101) }, creds),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createEventRecord(
        {
          ...base,
          issuedBy: 'D',
          counterparty: { name: 'X', country: 'RE', type: '04', value: '1' },
        },
        creds,
      ),
    ).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(
      createEventRecord(
        {
          ...base,
          issuedBy: 'D',
          counterparty: { name: 'X', country: 'FR', type: '04', value: '1' },
        },
        creds,
      ),
    ).resolves.toHaveProperty('kind', 'event');
  });
});
