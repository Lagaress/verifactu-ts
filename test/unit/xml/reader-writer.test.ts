import { describe, expect, it } from 'vitest';
import { XmlParseError, XmlSchemaError } from '../../../src/index.ts';
import { parseXml } from '../../../src/xml/reader.ts';
import { escapeText, writeElement } from '../../../src/xml/writer.ts';
import { xsdErrors } from '../../xsd/xsd.ts';

describe('lector XML', () => {
  it('resuelve namespaces, atributos, CDATA, comentarios y referencias', () => {
    const el = parseXml(
      '<?xml version="1.0"?><!-- c --><a:r xmlns:a="urn:a" xmlns="urn:d" x="1&amp;2"><b>x &lt; y &#x41;&#66;<![CDATA[<z>]]></b><a:c/></a:r>',
    );
    expect(el.ns).toBe('urn:a');
    expect(el.local).toBe('r');
    expect(el.attributes.get('x')).toBe('1&2');
    expect(el.children[0]?.ns).toBe('urn:d');
    expect(el.children[0]?.text).toBe('x < y AB<z>');
    expect(el.children[1]?.local).toBe('c');
  });

  it.each([
    ['DOCTYPE', '<!DOCTYPE r [<!ENTITY x "y">]><r>&x;</r>'],
    ['entidad externa', '<r>&nbsp;</r>'],
    ['& sin escapar', '<r>a & b</r>'],
    ['cierre incorrecto', '<a><b></a></b>'],
    ['sin cerrar', '<a><b></b>'],
    ['dos raíces', '<a/><b/>'],
    ['prefijo no declarado', '<x:a/>'],
    ['carácter inválido', '<a>&#0;</a>'],
    ['vacío', '   '],
    ['atributo duplicado', '<a x="1" x="2"/>'],
  ])('rechaza %s', (_name, xml) => {
    expect(() => parseXml(xml)).toThrow(XmlParseError);
  });

  it('limita la profundidad de anidamiento', () => {
    const deep = '<a>'.repeat(100) + '</a>'.repeat(100);
    expect(() => parseXml(deep)).toThrow(/profundidad/);
    expect(() => parseXml(deep, { maxDepth: 200 })).not.toThrow();
  });
});

describe('escritor XML', () => {
  it('escapa el texto', () => {
    expect(escapeText('a & b < c > d\r')).toBe('a &amp; b &lt; c &gt; d&#xD;');
  });

  const cabecera = { ObligadoEmision: { NombreRazon: 'X', NIF: 'A00000000' } };

  it('rechaza objetos que no cumplen el esquema', () => {
    expect(() => writeElement('sfLR:RegFactuSistemaFacturacion', { Cabecera: cabecera })).toThrow(
      XmlSchemaError,
    );
    expect(() =>
      writeElement('sfLR:RegFactuSistemaFacturacion', {
        Cabecera: { ...cabecera, Extra: '1' },
        RegistroFactura: [],
      }),
    ).toThrow(/Extra/);
    expect(() =>
      writeElement('sfLR:RegFactuSistemaFacturacion', {
        Cabecera: { ObligadoEmision: { NombreRazon: 'X', NIF: 'CORTO' } },
        RegistroFactura: [{}],
      }),
    ).toThrow(/NIF/);
  });

  it('rechaza caracteres no válidos en XML', () => {
    expect(() =>
      writeElement('sfLR:RegFactuSistemaFacturacion', {
        Cabecera: { ObligadoEmision: { NombreRazon: 'X\u0001', NIF: 'A00000000' } },
        RegistroFactura: [],
      }),
    ).toThrow(/caracteres no permitidos/);
  });
});

describe('la validación XSD de los tests detecta errores', () => {
  it('marca un registro sin TipoFactura', async () => {
    const xml =
      '<sum1:RegistroAnulacion xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd"><sum1:IDVersion>1.0</sum1:IDVersion></sum1:RegistroAnulacion>';
    expect((await xsdErrors(xml, 'SuministroInformacion.xsd')).length).toBeGreaterThan(0);
  });
});
