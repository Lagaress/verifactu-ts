import { parseXml, type XmlElement } from '../src/xml/reader.ts';

/** Representación canónica (namespaces + nombres locales + texto) para comparar XML sin formato. */
export function canonical(xml: string): string {
  const walk = (el: XmlElement): string =>
    el.children.length > 0
      ? `{${el.ns}}${el.local}(${el.children.map(walk).join(',')})`
      : `{${el.ns}}${el.local}=${JSON.stringify(el.text)}`;
  return walk(parseXml(xml));
}
