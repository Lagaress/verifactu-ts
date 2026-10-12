import { describe, expect, it } from 'vitest';
import {
  createCancellationRecord,
  createRegistrationRecord,
  toChainLink,
  XmlSchemaError,
} from '../../../src/index.ts';
import { buildSubmissionXml, soapEnvelope } from '../../../src/xml/soap.ts';
import { SYSTEM, f1Input } from '../../helpers.ts';
import { xsdErrors } from '../../xsd/xsd.ts';

const taxpayer = { name: 'Perico de los Palotes, S.A.', nif: 'A00000000' };

describe('envío de registros (RegFactuSistemaFacturacion)', () => {
  it('valida contra SuministroLR.xsd con altas y anulaciones mezcladas', async () => {
    const alta = await createRegistrationRecord(f1Input());
    const anulacion = await createCancellationRecord({
      invoiceId: alta.invoiceId,
      previous: toChainLink(alta),
      system: SYSTEM,
      hashedAt: '2025-06-01T10:21:00+02:00',
    });
    const xml = buildSubmissionXml(
      {
        taxpayer,
        representative: { name: 'Asesoría', nif: 'B00000000' },
        voluntaryRemission: { endDate: '2026-12-31', incident: true },
      },
      [alta, anulacion],
    );
    expect(await xsdErrors(xml, 'SuministroLR.xsd')).toEqual([]);
    expect(xml).toMatch(
      /^<sum:RegFactuSistemaFacturacion xmlns:sum="[^"]+SuministroLR\.xsd" xmlns:sum1="[^"]+SuministroInformacion\.xsd">/,
    );
    expect(xml).toContain(
      '<sum1:FechaFinVeriFactu>31-12-2026</sum1:FechaFinVeriFactu><sum1:Incidencia>S</sum1:Incidencia>',
    );
  });

  it('admite la remisión por requerimiento', async () => {
    const xml = buildSubmissionXml(
      { taxpayer, requirement: { reference: 'REQ-123', isLast: true } },
      [await createRegistrationRecord(f1Input())],
    );
    expect(await xsdErrors(xml, 'SuministroLR.xsd')).toEqual([]);
    expect(xml).toContain(
      '<sum1:RemisionRequerimiento><sum1:RefRequerimiento>REQ-123</sum1:RefRequerimiento><sum1:FinRequerimiento>S</sum1:FinRequerimiento>',
    );
  });

  it('rechaza envíos vacíos o con más de 1000 registros', async () => {
    const alta = await createRegistrationRecord(f1Input());
    expect(() => buildSubmissionXml({ taxpayer }, [])).toThrow(XmlSchemaError);
    expect(() =>
      buildSubmissionXml(
        { taxpayer },
        Array.from({ length: 1001 }, () => alta),
      ),
    ).toThrow(/1000/);
  });

  it('envuelve el cuerpo en un sobre SOAP 1.1', () => {
    expect(soapEnvelope('<x/>')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body><x/></soapenv:Body></soapenv:Envelope>',
    );
  });
});
