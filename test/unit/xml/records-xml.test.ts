import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createCancellationRecord,
  createRegistrationRecord,
  toChainLink,
  verifyHash,
  type InvoiceRecord,
} from '../../../src/index.ts';
import { recordFromXml, recordToXml } from '../../../src/xml/records.ts';
import { SYSTEM, f1Input } from '../../helpers.ts';
import { canonical } from '../../xml-utils.ts';
import { xsdErrors } from '../../xsd/xsd.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const fixture = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const AEAT_EXAMPLE = 'spec/aeat/2026-10-12/examples/ejemploRegistro.xml';
const { vendorNif: _nif, ...SYSTEM_WITHOUT_NIF } = SYSTEM;
const FOREIGN_SYSTEM = {
  ...SYSTEM_WITHOUT_NIF,
  vendorForeignId: { country: 'DE', type: '02', value: 'DE123' },
} as const;

describe('registros → XML', () => {
  it('un alta F1 valida contra SuministroInformacion.xsd', async () => {
    const xml = recordToXml(await createRegistrationRecord(f1Input()));
    expect(await xsdErrors(xml, 'SuministroInformacion.xsd')).toEqual([]);
    expect(
      xml.startsWith('<sum1:RegistroAlta xmlns:sum1="https://www2.agenciatributaria.gob.es/'),
    ).toBe(true);
  });

  it('un alta con todos los campos opcionales valida contra el XSD y vuelve igual', async () => {
    const record = await createRegistrationRecord(
      f1Input({
        externalReference: 'REF-1',
        isCorrection: true,
        priorRejection: 'X',
        invoiceType: 'R1',
        correctiveType: 'S',
        correctedInvoices: [
          { issuerId: 'A00000000', invoiceNumber: 'F-0001', issueDate: '2025-05-01' },
        ],
        correctedBaseAmount: '100.00',
        correctedTaxAmount: '21.00',
        correctedSurchargeAmount: '0.00',
        operationDate: '2025-05-15',
        isSimplifiedArt7273: false,
        isWithoutRecipientArt61d: false,
        isMacrodata: false,
        issuedBy: 'T',
        thirdParty: { name: 'Tercero SL', nif: 'B00000000' },
        recipients: [
          { name: 'Cliente ES', nif: '00000000A' },
          { name: 'Client FR', country: 'FR', type: '02', value: 'FR12345678901' },
          { name: 'Sin país', type: '06', value: 'X-1' },
        ],
        hasCoupon: false,
        breakdown: [
          {
            taxType: '01',
            regimeType: '01',
            operationType: 'S1',
            taxRate: '21',
            baseAmount: '100',
            taxAmount: '21',
          },
          {
            taxType: '01',
            regimeType: '18',
            operationType: 'S1',
            taxRate: '21',
            baseAmount: '10',
            taxAmount: '2.10',
            surchargeRate: '5.2',
            surchargeAmount: '0.52',
          },
          { taxType: '03', regimeType: '01', operationType: 'E7', baseAmount: '5' },
          { operationType: 'N2', baseAmount: '-3.50' },
          {
            taxType: '01',
            regimeType: '03',
            operationType: 'S1',
            taxRate: '21',
            baseAmount: '50',
            costBaseAmount: '40',
            taxAmount: '8.40',
          },
        ],
        billingAgreementNumber: 'ACUERDO-1',
        systemAgreementId: 'SIS-1',
        totalTaxAmount: '31.02',
        totalAmount: '182.52',
        previous: {
          invoiceId: { issuerId: 'A00000000', invoiceNumber: 'P-0', issueDate: '2025-05-31' },
          hash: 'A'.repeat(64),
        },
      }),
      { validate: false },
    );
    const xml = recordToXml(record);
    expect(await xsdErrors(xml, 'SuministroInformacion.xsd')).toEqual([]);
    expect(recordFromXml(xml)).toEqual(record);
  });

  it('un alta F2 sin destinatarios omite el bloque Destinatarios', async () => {
    const record = await createRegistrationRecord(f1Input({ invoiceType: 'F2', recipients: [] }), {
      validate: false,
    });
    const xml = recordToXml(record);
    expect(xml).not.toContain('Destinatarios');
    expect(await xsdErrors(xml, 'SuministroInformacion.xsd')).toEqual([]);
  });

  it('una anulación valida contra el XSD y vuelve igual', async () => {
    const alta = await createRegistrationRecord(f1Input());
    const record = await createCancellationRecord(
      {
        invoiceId: alta.invoiceId,
        externalReference: 'ANU-1',
        withoutPriorRecord: true,
        isPriorRejection: true,
        generatedBy: 'T',
        generator: { name: 'Gestoría', country: 'PT', type: '02', value: 'PT123456789' },
        previous: toChainLink(alta),
        system: FOREIGN_SYSTEM,
        hashedAt: '2025-06-01T10:21:00+02:00',
      },
      { validate: false },
    );
    const xml = recordToXml(record);
    expect(await xsdErrors(xml, 'SuministroInformacion.xsd')).toEqual([]);
    const back = recordFromXml(xml) as Extract<InvoiceRecord, { kind: 'cancellation' }>;
    expect(back).toEqual(record);
  });

  it('escapa los caracteres especiales de XML', async () => {
    const record = await createRegistrationRecord(
      f1Input({ issuerName: 'Ruiz & Hijos <S.L.>', description: 'Línea "1" & \'2\'' }),
    );
    const xml = recordToXml(record);
    expect(xml).toContain(
      '<sum1:NombreRazonEmisor>Ruiz &amp; Hijos &lt;S.L.&gt;</sum1:NombreRazonEmisor>',
    );
    expect(await xsdErrors(xml, 'SuministroInformacion.xsd')).toEqual([]);
    expect(recordFromXml(xml)).toEqual(record);
  });
});

describe('XML → registros', () => {
  it('lee el ejemplo oficial de la AEAT, conserva los literales y reproduce la huella', async () => {
    const xml = fixture(AEAT_EXAMPLE);
    const record = recordFromXml(xml);
    expect(record.kind).toBe('registration');
    if (record.kind !== 'registration') return;
    expect(record.totalTaxAmount).toBe('41.4');
    expect(record.breakdown[0]?.taxRate).toBe('4');
    expect(record.breakdown[0]?.taxType).toBeUndefined();
    expect(await verifyHash(record)).toBe(true);
    expect(canonical(recordToXml(record))).toBe(canonical(xml));
  });

  it.each(['registration-record-f1.xml', 'registration-record-f2.xml', 'cancellation-record.xml'])(
    'lee y reescribe el fixture de Verifactu-PHP %s',
    async (name) => {
      const xml = fixture(`test/fixtures/xml/php/${name}`);
      expect(await xsdErrors(xml, 'SuministroInformacion.xsd')).toEqual([]);
      const record = recordFromXml(xml);
      expect(await verifyHash(record)).toBe(true);
      const out = recordToXml(record);
      expect(canonical(out)).toBe(canonical(xml));
      expect(await xsdErrors(out, 'SuministroInformacion.xsd')).toEqual([]);
    },
  );

  it('acepta un RegistroFactura que envuelve el registro', () => {
    const inner = fixture(AEAT_EXAMPLE);
    const wrapped = `<sum:RegistroFactura xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd">${inner}</sum:RegistroFactura>`;
    expect(recordFromXml(wrapped).invoiceId.invoiceNumber).toBe('12345678-G66');
  });

  it('rechaza XML que no cumple el esquema', () => {
    const xml = fixture(AEAT_EXAMPLE);
    expect(() => recordFromXml(xml.replace('<sum1:TipoFactura>R3</sum1:TipoFactura>', ''))).toThrow(
      /TipoFactura/,
    );
    expect(() =>
      recordFromXml(xml.replace('R3</sum1:TipoFactura>', 'R9</sum1:TipoFactura>')),
    ).toThrow(/TipoFactura/);
    expect(() =>
      recordFromXml(
        xml.replace('<sum1:Subsanacion>N', '<sum1:Inventado>1</sum1:Inventado><sum1:Subsanacion>N'),
      ),
    ).toThrow(/Inventado/);
    expect(() => recordFromXml('<x:RegistroAlta xmlns:x="urn:otro"/>')).toThrow(/RegistroAlta/);
  });
});
