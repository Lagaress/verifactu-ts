import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AeatClient,
  parseSubmissionResponse,
  UnexpectedResponseError,
  type Transport,
} from '../../src/client/index.ts';
import { buildQueryXml } from '../../src/client/query.ts';
import {
  createRegistrationRecord,
  recordFromXml,
  recordToXml,
  validateRecord,
  XmlParseError,
} from '../../src/index.ts';
import { parseXml } from '../../src/xml/reader.ts';
import { buildSubmissionXml } from '../../src/xml/soap.ts';
import { f1Input } from '../helpers.ts';
import { xsdErrors } from '../xsd/xsd.ts';

/** Regresiones de la revisión independiente del código (una por hallazgo). */
const ROOT = join(import.meta.dirname, '..', '..');
const SIGNED = readFileSync(
  join(ROOT, 'spec/aeat/2026-10-12/examples/ejemploRegistro-firmado-epes-xades4j.xml'),
  'utf8',
);
const rules = async (overrides: Parameters<typeof f1Input>[0], today = '2026-10-12') =>
  validateRecord(await createRegistrationRecord(f1Input(overrides), { validate: false }), {
    today,
  }).map((v) => v.rule);

describe('revisión: XML', () => {
  it('1. una firma con xmlns:ds heredado sigue siendo XML bien formado al reescribirla', async () => {
    const moved = SIGNED.replace(' xmlns:ds="http://www.w3.org/2000/09/xmldsig#"', '').replace(
      '<sum1:RegistroAlta ',
      '<sum1:RegistroAlta xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ',
    );
    const record = recordFromXml(moved);
    expect(
      record.signature?.raw.startsWith(
        '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"',
      ),
    ).toBe(true);
    const out = recordToXml(record);
    expect(() => parseXml(out)).not.toThrow();
    expect(await xsdErrors(out, 'SuministroInformacion.xsd')).toEqual([]);
    expect(() =>
      parseXml(buildSubmissionXml({ taxpayer: { name: 'X', nif: '89890001K' } }, [record])),
    ).not.toThrow();
  });

  it('7. el coste del lector no crece con namespaces × elementos', () => {
    const decls = Array.from({ length: 2000 }, (_, i) => ` xmlns:p${i}="urn:${i}"`).join('');
    const xml = `<r${decls}>${'<a/>'.repeat(20000)}</r>`;
    const t0 = performance.now();
    parseXml(xml);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('8. referencias de carácter estrictas, fin de línea normalizado y cierres sin espacio inicial', () => {
    expect(() => parseXml('<a>&#65abc;</a>')).toThrow(XmlParseError);
    expect(() => parseXml('<a>&#x41zz;</a>')).toThrow(XmlParseError);
    expect(parseXml('<a>x\r\ny\rz</a>').text).toBe('x\ny\nz');
    expect(parseXml('<a>x&#13;y</a>').text).toBe('x\ry');
    expect(parseXml('<a b="1\t2\n3"/>').attributes.get('b')).toBe('1 2 3');
    expect(() => parseXml('<a></ a>')).toThrow(XmlParseError);
    expect(parseXml('<a></a >').local).toBe('a');
  });
});

describe('revisión: cliente', () => {
  const taxpayer = { name: 'X', nif: 'A00000000' };

  it('2. IndicadorRepresentante no se envía al consultar como destinatario', () => {
    expect(
      buildQueryXml(
        { year: 2026, month: 10 },
        { taxpayer, asRecipient: true, viaRepresentative: true },
      ),
    ).not.toContain('IndicadorRepresentante');
    expect(
      buildQueryXml({ year: 2026, month: 10 }, { taxpayer, viaRepresentative: true }),
    ).toContain('<sum1:IndicadorRepresentante>S</sum1:IndicadorRepresentante>');
  });

  it('6. una respuesta incompleta da UnexpectedResponseError, no TypeError', () => {
    const NS_R =
      'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd';
    const NS_I =
      'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';
    const body = `<e:Envelope xmlns:e="http://schemas.xmlsoap.org/soap/envelope/"><e:Body><r:RespuestaRegFactuSistemaFacturacion xmlns:r="${NS_R}" xmlns:i="${NS_I}"><r:Cabecera><i:ObligadoEmision><i:NombreRazon>X</i:NombreRazon><i:NIF>A00000000</i:NIF></i:ObligadoEmision></r:Cabecera><r:TiempoEsperaEnvio>60</r:TiempoEsperaEnvio><r:EstadoEnvio>Correcto</r:EstadoEnvio><r:RespuestaLinea><r:IDFactura><i:IDEmisorFactura>A00000000</i:IDEmisorFactura><i:NumSerieFactura>F</i:NumSerieFactura><i:FechaExpedicionFactura>01-06-2025</i:FechaExpedicionFactura></r:IDFactura><r:EstadoRegistro>Correcto</r:EstadoRegistro></r:RespuestaLinea></r:RespuestaRegFactuSistemaFacturacion></e:Body></e:Envelope>`;
    expect(() => parseSubmissionResponse(200, body)).toThrow(UnexpectedResponseError);
    expect(() =>
      parseSubmissionResponse(200, body.replace('<r:EstadoEnvio>Correcto</r:EstadoEnvio>', '')),
    ).toThrow(UnexpectedResponseError);
  });

  it('sospecha: la consulta no entra en bucle si la AEAT repite la clave de paginación', async () => {
    const NS =
      'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/';
    const page = `<e:Envelope xmlns:e="http://schemas.xmlsoap.org/soap/envelope/"><e:Body><r:RespuestaConsultaFactuSistemaFacturacion xmlns:r="${NS}RespuestaConsultaLR.xsd" xmlns:i="${NS}SuministroInformacion.xsd"><r:Cabecera><i:IDVersion>1.0</i:IDVersion><i:ObligadoEmision><i:NombreRazon>X</i:NombreRazon><i:NIF>A00000000</i:NIF></i:ObligadoEmision></r:Cabecera><r:PeriodoImputacion><r:Ejercicio>2026</r:Ejercicio><r:Periodo>10</r:Periodo></r:PeriodoImputacion><r:IndicadorPaginacion>S</r:IndicadorPaginacion><r:ResultadoConsulta>SinDatos</r:ResultadoConsulta><r:ClavePaginacion><i:IDEmisorFactura>A00000000</i:IDEmisorFactura><i:NumSerieFactura>F</i:NumSerieFactura><i:FechaExpedicionFactura>01-10-2026</i:FechaExpedicionFactura></r:ClavePaginacion></r:RespuestaConsultaFactuSistemaFacturacion></e:Body></e:Envelope>`;
    let calls = 0;
    const transport: Transport = () => {
      calls++;
      return Promise.resolve({ status: 200, body: page });
    };
    const client = new AeatClient({
      transport,
      environment: 'test',
      certificateType: 'personal',
      taxpayer,
    });
    const consume = async () => {
      for await (const r of client.query({ year: 2026, month: 10 })) expect(r).toBeDefined();
    };
    const err = await consume().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnexpectedResponseError);
    expect(String(err)).toMatch(/paginación repetida/);
    expect(calls).toBe(2);
  });
});

describe('revisión: validación (falsos positivos)', () => {
  const ipsi = {
    taxType: '02',
    regimeType: '01',
    operationType: 'S1',
    taxRate: '4',
    baseAmount: '100.00',
    taxAmount: '4.00',
  } as const;

  it('3. 1146/1173 no se aplican a facturas solo con IPSI u Otros', async () => {
    const r = await rules({
      invoiceId: { issuerId: 'A00000000', invoiceNumber: 'F', issueDate: '2026-10-01' },
      operationDate: '2026-10-20',
      breakdown: [ipsi],
      totalTaxAmount: '4.00',
      totalAmount: '104.00',
    });
    expect(r).toEqual([]);
  });

  it('4. la lista de caracteres de NumSerieFactura solo aplica al IDFactura propio', async () => {
    const r = await rules({
      invoiceType: 'R1',
      correctiveType: 'I',
      correctedInvoices: [
        { issuerId: 'A00000000', invoiceNumber: "O'BRIEN=1", issueDate: '2024-01-01' },
      ],
    });
    expect(r).toEqual([]);
    expect(
      await rules({
        invoiceId: { issuerId: 'A00000000', invoiceNumber: "O'BRIEN", issueDate: '2026-10-01' },
      }),
    ).toContain('format.invoice-number-chars');
  });

  it('5. E7/E8 solo se rechazan con IVA', async () => {
    const line = (taxType: '01' | '02' | '03' | '05', operationType: 'E7' | 'E8') => ({
      taxType,
      ...(taxType !== '05' && { regimeType: '01' as const }),
      operationType,
      baseAmount: '100.00',
    });
    const totals = { totalTaxAmount: '0', totalAmount: '100.00' };
    expect(await rules({ breakdown: [line('02', 'E7')], ...totals })).toEqual([]);
    expect(await rules({ breakdown: [line('05', 'E8')], ...totals })).toEqual([]);
    expect(await rules({ breakdown: [line('03', 'E8')], ...totals })).toEqual([]);
    expect(await rules({ breakdown: [line('01', 'E7')], ...totals })).toEqual([
      'business.exempt-list',
    ]);
  });

  it('sospecha: NIF-IVA de Irlanda del Norte (XI) con país GB', async () => {
    expect(
      await rules({
        recipients: [{ name: 'NI Ltd', country: 'GB', type: '02', value: 'XI123456789' }],
      }),
    ).toEqual([]);
  });
});
