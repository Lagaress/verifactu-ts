import { describe, expect, it } from 'vitest';
import {
  parseQueryResponse,
  parseSubmissionResponse,
  SoapFaultError,
  TransportError,
  UnexpectedResponseError,
} from '../../../src/client/index.ts';
import { createFakeAeat } from '../../../src/testing/index.ts';
import { buildSubmissionXml, soapEnvelope } from '../../../src/xml/soap.ts';
import { createRegistrationRecord } from '../../../src/index.ts';
import { parseXml } from '../../../src/xml/reader.ts';
import { f1Input } from '../../helpers.ts';
import { xsdErrors } from '../../xsd/xsd.ts';

const ENV = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Header/><env:Body>${body}</env:Body></env:Envelope>`;
const NS_R =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd';
const NS_I =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';

/** Respuesta con los prefijos que usa la AEAT (tikR, tik), un campo desconocido y RegistroDuplicado. */
const REAL_LIKE =
  ENV(`<tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="${NS_R}" xmlns:tik="${NS_I}">
  <tikR:CSV>A-Y23JP3582934</tikR:CSV>
  <tikR:DatosPresentacion><tik:NIFPresentador>A00000000</tik:NIFPresentador><tik:TimestampPresentacion>2025-06-01T10:20:31+02:00</tik:TimestampPresentacion></tikR:DatosPresentacion>
  <tikR:Cabecera><tik:ObligadoEmision><tik:NombreRazon>X</tik:NombreRazon><tik:NIF>A00000000</tik:NIF></tik:ObligadoEmision></tikR:Cabecera>
  <tikR:TiempoEsperaEnvio>60</tikR:TiempoEsperaEnvio>
  <tikR:EstadoEnvio>ParcialmenteCorrecto</tikR:EstadoEnvio>
  <tikR:CampoNuevoDeLaAEAT>ignorado</tikR:CampoNuevoDeLaAEAT>
  <tikR:RespuestaLinea>
    <tikR:IDFactura><tik:IDEmisorFactura>A00000000</tik:IDEmisorFactura><tik:NumSerieFactura>F-1</tik:NumSerieFactura><tik:FechaExpedicionFactura>01-06-2025</tik:FechaExpedicionFactura></tikR:IDFactura>
    <tikR:Operacion><tik:TipoOperacion>Alta</tik:TipoOperacion></tikR:Operacion>
    <tikR:EstadoRegistro>Incorrecto</tikR:EstadoRegistro>
    <tikR:CodigoErrorRegistro>3000</tikR:CodigoErrorRegistro>
    <tikR:DescripcionErrorRegistro>Registro de facturación duplicado.</tikR:DescripcionErrorRegistro>
    <tikR:RegistroDuplicado><tik:IdPeticionRegistroDuplicado>202506011020</tik:IdPeticionRegistroDuplicado><tik:EstadoRegistroDuplicado>AceptadaConErrores</tik:EstadoRegistroDuplicado><tik:CodigoErrorRegistro>2000</tik:CodigoErrorRegistro></tikR:RegistroDuplicado>
  </tikR:RespuestaLinea>
  <tikR:RespuestaLinea>
    <tikR:IDFactura><tik:IDEmisorFactura>A00000000</tik:IDEmisorFactura><tik:NumSerieFactura>F-2</tik:NumSerieFactura><tik:FechaExpedicionFactura>01-06-2025</tik:FechaExpedicionFactura></tikR:IDFactura>
    <tikR:Operacion><tik:TipoOperacion>Anulacion</tik:TipoOperacion></tikR:Operacion>
    <tikR:RefExterna>R-2</tikR:RefExterna>
    <tikR:EstadoRegistro>Correcto</tikR:EstadoRegistro>
  </tikR:RespuestaLinea>
</tikR:RespuestaRegFactuSistemaFacturacion>`);

describe('respuestas de la AEAT', () => {
  it('interpreta una respuesta de envío con prefijos de la AEAT', () => {
    const r = parseSubmissionResponse(200, REAL_LIKE);
    expect(r).toMatchObject({
      status: 'ParcialmenteCorrecto',
      csv: 'A-Y23JP3582934',
      waitSeconds: 60,
    });
    expect(r.submission).toEqual({
      submitterNif: 'A00000000',
      submittedAt: '2025-06-01T10:20:31+02:00',
    });
    expect(r.items).toEqual([
      {
        invoiceId: { issuerId: 'A00000000', invoiceNumber: 'F-1', issueDate: '2025-06-01' },
        recordType: 'registration',
        isCorrection: false,
        status: 'Incorrecto',
        error: {
          code: 3000,
          description: 'Registro de facturación duplicado.',
          kind: 'rechazo-registro',
        },
        duplicate: {
          requestId: '202506011020',
          status: 'AceptadaConErrores',
          error: { code: 2000, description: '', kind: 'admisible' },
        },
      },
      {
        invoiceId: { issuerId: 'A00000000', invoiceNumber: 'F-2', issueDate: '2025-06-01' },
        recordType: 'cancellation',
        isCorrection: false,
        externalReference: 'R-2',
        status: 'Correcto',
      },
    ]);
    expect(r.rawXml).toBe(REAL_LIKE);
  });

  it('distingue SOAP Fault de cliente y de servidor', () => {
    const f = (code: string) =>
      ENV(
        `<env:Fault><faultcode>${code}</faultcode><faultstring>Error técnico</faultstring></env:Fault>`,
      );
    let server: unknown;
    try {
      parseSubmissionResponse(500, f('env:Server'));
    } catch (e) {
      server = e;
    }
    expect(server).toBeInstanceOf(SoapFaultError);
    expect(server).toMatchObject({ retryable: true, aeatCode: undefined });
  });

  it('trata las páginas HTML y los cuerpos vacíos como errores de transporte', () => {
    const html =
      '<html><head><title>401 Unauthorized</title></head><body><h1>401</h1></body></html>';
    expect(() => parseSubmissionResponse(401, html)).toThrow(TransportError);
    expect(() => parseSubmissionResponse(502, 'Bad gateway')).toThrow(TransportError);
    expect(() => parseSubmissionResponse(200, '')).toThrow(TransportError);
    try {
      parseSubmissionResponse(502, 'Bad gateway');
    } catch (e) {
      expect(e).toMatchObject({ status: 502, retryable: true, bodySnippet: 'Bad gateway' });
    }
  });

  it('rechaza respuestas con otro elemento o estructura inesperada', () => {
    expect(() => parseSubmissionResponse(200, ENV('<x:Otra xmlns:x="urn:x"/>'))).toThrow(
      UnexpectedResponseError,
    );
    expect(() => parseQueryResponse(200, REAL_LIKE)).toThrow(UnexpectedResponseError);
  });

  it('las respuestas de la AEAT simulada cumplen el XSD oficial', async () => {
    const aeat = createFakeAeat({ today: '2025-07-01' });
    const record = await createRegistrationRecord(f1Input());
    const body = soapEnvelope(
      buildSubmissionXml({ taxpayer: { name: 'X', nif: 'A00000000' } }, [record, record]),
    );
    const res = await aeat.transport({ url: '', headers: {}, body });
    const payload = parseXml(res.body).children[1]!.children[0]!;
    expect(
      await xsdErrors(res.body.slice(payload.start, payload.end), 'RespuestaSuministro.xsd'),
    ).toEqual([]);
    expect(parseSubmissionResponse(res.status, res.body).items.map((i) => i.status)).toEqual([
      'Correcto',
      'Incorrecto',
    ]);
  });
});
