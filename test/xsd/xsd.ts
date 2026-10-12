import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateXML, type XMLFileInfo } from 'xmllint-wasm';

/**
 * Validación contra los XSD oficiales de spec/current con xmllint (libxml2 compilado a WASM).
 * Solo se usa en tests: no es dependencia de runtime.
 *
 * Los XSD de la AEAT importan xmldsig desde w3.org con una URL absoluta; aquí se reescribe a la
 * copia local para que la validación no dependa de la red. Los originales de spec/ no se tocan.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const { id } = JSON.parse(readFileSync(join(ROOT, 'spec/current.json'), 'utf8')) as { id: string };
const DIR = join(ROOT, 'spec/aeat', id, 'xsd');

const FILES = [
  'SuministroInformacion.xsd',
  'SuministroLR.xsd',
  'RespuestaSuministro.xsd',
  'ConsultaLR.xsd',
  'RespuestaConsultaLR.xsd',
  'EventosSIF.xsd',
  'RespuestaValRegistNoVeriFactu.xsd',
  'xmldsig-core-schema.xsd',
] as const;
export type SchemaFile = (typeof FILES)[number];

const preload: XMLFileInfo[] = FILES.map((fileName) => ({
  fileName,
  contents: readFileSync(join(DIR, fileName), 'utf8')
    .replaceAll(
      'http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd',
      'xmldsig-core-schema.xsd',
    )
    // xmldsig-core-schema.xsd declara un DOCTYPE con DTD externa que xmllint no necesita.
    .replace(/<!DOCTYPE[\s\S]*?\]>/, ''),
}));

/** Valida `xml` contra el esquema indicado. Devuelve los errores (vacío si es válido). */
export async function xsdErrors(xml: string, schema: SchemaFile): Promise<string[]> {
  const main = preload.find((f) => f.fileName === schema)!;
  const result = await validateXML({
    xml: [{ fileName: 'input.xml', contents: xml }],
    schema: [main],
    preload: preload.filter((f) => f !== main),
  });
  return result.errors.map((e) => e.rawMessage);
}
