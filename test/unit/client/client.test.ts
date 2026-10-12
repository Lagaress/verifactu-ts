import { describe, expect, it } from 'vitest';
import {
  AeatClient,
  BatchLimitError,
  chunkRecords,
  nextSendAllowedAt,
  SoapFaultError,
  validateSubmissionHeader,
  type Transport,
} from '../../../src/client/index.ts';
import {
  createCancellationRecord,
  createRegistrationRecord,
  toChainLink,
  ValidationError,
  type RegistrationRecord,
} from '../../../src/index.ts';
import { createFakeAeat } from '../../../src/testing/index.ts';
import { parseXml } from '../../../src/xml/reader.ts';
import { SYSTEM, f1Input } from '../../helpers.ts';
import { xsdErrors } from '../../xsd/xsd.ts';

const TODAY = '2025-07-01';
const taxpayer = { name: 'Perico de los Palotes, S.A.', nif: 'A00000000' };

function setup(options: Parameters<typeof createFakeAeat>[0] = {}) {
  const aeat = createFakeAeat({ today: TODAY, ...options });
  const client = new AeatClient({
    transport: aeat.transport,
    environment: 'test',
    certificateType: 'personal',
    taxpayer,
    system: SYSTEM,
  });
  return { aeat, client };
}

async function alta(n: number, previous: RegistrationRecord | null = null, overrides = {}) {
  return createRegistrationRecord(
    f1Input({
      invoiceId: { issuerId: 'A00000000', invoiceNumber: `F-${n}`, issueDate: '2025-06-01' },
      previous: previous && toChainLink(previous),
      hashedAt: `2025-06-01T10:${String(n).padStart(2, '0')}:00+02:00`,
      ...overrides,
    }),
  );
}

/** Extrae el cuerpo SOAP (primer hijo de Body) como XML independiente. */
function soapPayload(xml: string): string {
  const body = parseXml(xml).children.find((c) => c.local === 'Body')!;
  const payload = body.children[0]!;
  return xml.slice(payload.start, payload.end).replace(/^<([\w]+:)?(\w+)/, (m) => m);
}

describe('AeatClient: envío', () => {
  it('envía altas y anulaciones y devuelve el resultado de cada registro', async () => {
    const { aeat, client } = setup();
    const a = await alta(1);
    const b = await alta(2, a);
    const res = await client.send([a, b], { today: TODAY });
    expect(res.status).toBe('Correcto');
    expect(res.csv).toMatch(/^FAKE/);
    expect(res.waitSeconds).toBe(60);
    expect(res.items.map((i) => [i.invoiceId.invoiceNumber, i.recordType, i.status])).toEqual([
      ['F-1', 'registration', 'Correcto'],
      ['F-2', 'registration', 'Correcto'],
    ]);

    const anulacion = await createCancellationRecord({
      invoiceId: a.invoiceId,
      previous: toChainLink(b),
      system: SYSTEM,
      hashedAt: '2025-06-01T11:00:00+02:00',
    });
    const res2 = await client.send([anulacion], { today: TODAY });
    expect(res2.items[0]).toMatchObject({ recordType: 'cancellation', status: 'Correcto' });
    expect(aeat.records.get('A00000000|F-1|2025-06-01')?.cancelled).toBe(true);
  });

  it('usa el endpoint y las cabeceras correctas', async () => {
    const { aeat, client } = setup();
    await client.send([await alta(1)], { today: TODAY });
    const req = aeat.requests[0]!;
    expect(req.url).toBe(
      'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    );
    expect(req.headers).toMatchObject({
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '""',
      'User-Agent': 'verifactu-ts (Test SIF/0.0.1)',
    });
    expect(await xsdErrors(soapPayload(req.body), 'SuministroLR.xsd')).toEqual([]);
  });

  it('informa de duplicados, anulaciones inexistentes y subsanaciones', async () => {
    const { client } = setup();
    const a = await alta(1);
    await client.send([a], { today: TODAY });
    const dup = await client.send([a], { today: TODAY });
    expect(dup.status).toBe('Incorrecto');
    expect(dup.csv).toBeUndefined();
    expect(dup.items[0]).toMatchObject({
      status: 'Incorrecto',
      error: { code: 3000, kind: 'rechazo-registro' },
      duplicate: { status: 'Correcta' },
    });

    const fix = await createRegistrationRecord({
      ...f1Input({
        invoiceId: a.invoiceId,
        previous: toChainLink(a),
        hashedAt: '2025-06-01T12:00:00+02:00',
      }),
      isCorrection: true,
    });
    expect((await client.send([fix], { today: TODAY })).items[0]).toMatchObject({
      status: 'Correcto',
      isCorrection: true,
    });

    const ghost = await createCancellationRecord({
      invoiceId: { issuerId: 'A00000000', invoiceNumber: 'NO-EXISTE', issueDate: '2025-06-01' },
      previous: toChainLink(fix),
      system: SYSTEM,
      hashedAt: '2025-06-01T12:01:00+02:00',
    });
    expect((await client.send([ghost], { today: TODAY })).items[0]?.error?.code).toBe(3002);
  });

  it('marca como aceptados con errores las huellas incorrectas y los totales descuadrados', async () => {
    const { client } = setup();
    const a = await alta(1);
    const b = await alta(2, a, { totalTaxAmount: '40.00', totalAmount: '140.00' });
    const res = await client.send([{ ...a, hash: 'F'.repeat(64) }, b], { today: TODAY });
    expect(res.status).toBe('ParcialmenteCorrecto');
    expect(res.items.map((i) => [i.status, i.error?.code])).toEqual([
      ['AceptadoConErrores', 2000],
      ['AceptadoConErrores', 2006],
    ]);
  });

  it('valida antes de enviar y no envía nada si hay errores', async () => {
    const { aeat, client } = setup();
    const otro = await createRegistrationRecord(
      f1Input({
        invoiceId: { issuerId: 'B00000000', invoiceNumber: 'X', issueDate: '2025-06-01' },
      }),
    );
    await expect(client.send([otro], { today: TODAY })).rejects.toBeInstanceOf(ValidationError);
    await expect(client.send([otro], { today: TODAY })).rejects.toThrow(
      /records\[0\]\.invoiceId\.issuerId/,
    );
    expect(aeat.requests).toHaveLength(0);
    // Sin validación local, la AEAT simulada lo rechaza igual que la real.
    expect((await client.send([otro], { validate: false })).items[0]?.error?.code).toBe(1108);
  });

  it('rechaza más de 1000 registros y ofrece chunkRecords', async () => {
    const { client } = setup();
    const a = await alta(1);
    await expect(client.send(Array.from({ length: 1001 }, () => a))).rejects.toBeInstanceOf(
      BatchLimitError,
    );
    expect(chunkRecords(Array.from({ length: 2500 }, (_, i) => i)).map((c) => c.length)).toEqual([
      1000, 1000, 500,
    ]);
  });

  it('propaga los SOAP Fault de la AEAT', async () => {
    const transport: Transport = () =>
      Promise.resolve({
        status: 500,
        body: '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault><faultcode>env:Client</faultcode><faultstring>Codigo[4104].El NIF del titular en la cabecera no está identificado.</faultstring></env:Fault></env:Body></env:Envelope>',
      });
    const client = new AeatClient({
      transport,
      environment: 'production',
      certificateType: 'seal',
      taxpayer,
    });
    const error = await client.send([await alta(1)], { today: TODAY }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SoapFaultError);
    expect(error).toMatchObject({ aeatCode: 4104, faultCode: 'env:Client', retryable: false });
    expect(client.endpoint()).toBe(
      'https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
    );
    expect(client.endpoint('requirement')).toBe(
      'https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP',
    );
  });

  it('calcula cuándo se puede volver a enviar', () => {
    expect(
      nextSendAllowedAt({ waitSeconds: 60 }, new Date('2025-06-01T10:00:00Z')).toISOString(),
    ).toBe('2025-06-01T10:01:00.000Z');
  });
});

describe('cabecera del envío (§3.1.1)', () => {
  const header = { taxpayer };
  const rules = (
    h: Parameters<typeof validateSubmissionHeader>[0],
    service: 'verifactu' | 'requirement',
    today = TODAY,
  ) => validateSubmissionHeader(h, service, today).map((v) => v.rule);

  it('separa remisión voluntaria y requerimiento', () => {
    expect(rules(header, 'verifactu')).toEqual([]);
    expect(rules({ ...header, requirement: { reference: 'R' } }, 'verifactu')).toEqual([
      'header.requirement-in-verifactu',
    ]);
    expect(rules(header, 'requirement')).toEqual(['header.requirement-required']);
    expect(
      rules(
        {
          ...header,
          requirement: { reference: 'R', isLast: true },
          voluntaryRemission: { incident: true },
        },
        'requirement',
      ),
    ).toEqual(['header.voluntary-in-requirement']);
    expect(rules({ ...header, requirement: { reference: 'X'.repeat(19) } }, 'requirement')).toEqual(
      ['header.requirement-reference'],
    );
  });

  it('desde 2027, FechaFinVeriFactu debe ser 31/12 del año actual o anterior', () => {
    const at = (endDate: string) =>
      rules({ ...header, voluntaryRemission: { endDate } }, 'verifactu', '2027-03-01');
    expect(at('2027-12-31')).toEqual([]);
    expect(at('2026-12-31')).toEqual([]);
    expect(at('2027-06-30')).toEqual(['header.end-date-format']);
    expect(at('2025-12-31')).toEqual(['header.end-date-format']);
    expect(
      rules(
        { ...header, voluntaryRemission: { endDate: '2026-06-30' } },
        'verifactu',
        '2026-03-01',
      ),
    ).toEqual([]);
  });
});

describe('AeatClient: consulta', () => {
  it('recorre todas las páginas', async () => {
    const { aeat, client } = setup({ pageSize: 2 });
    const records: RegistrationRecord[] = [];
    for (let i = 1; i <= 5; i++) records.push(await alta(i, records[i - 2] ?? null));
    await client.send(records, { today: TODAY });

    const seen: string[] = [];
    for await (const r of client.query({ year: 2025, month: 6 }))
      seen.push(`${r.invoiceId.invoiceNumber}:${r.status}`);
    expect(seen).toEqual([
      'F-1:Correcto',
      'F-2:Correcto',
      'F-3:Correcto',
      'F-4:Correcto',
      'F-5:Correcto',
    ]);

    const queries = aeat.requests.slice(1);
    expect(queries).toHaveLength(3);
    for (const q of queries)
      expect(await xsdErrors(soapPayload(q.body), 'ConsultaLR.xsd')).toEqual([]);
    expect(queries[1]!.body).toContain('<sum1:NumSerieFactura>F-2</sum1:NumSerieFactura>');
  });

  it('devuelve vacío si no hay datos y filtra por número', async () => {
    const { client } = setup();
    await client.send([await alta(1)], { today: TODAY });
    expect((await client.queryPage({ year: 2025, month: 5 })).records).toEqual([]);
    const page = await client.queryPage({
      year: 2025,
      month: 6,
      invoiceNumber: 'F-1',
      issueDate: { from: '2025-06-01' },
      showIssuerName: true,
    });
    expect(page.records.map((r) => r.data.Huella?.length)).toEqual([64]);
    expect(page.nextPageKey).toBeUndefined();
  });
});
