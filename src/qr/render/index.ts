/**
 * verifactu-ts/qr/render — generación del código QR (matriz o SVG) sin dependencias.
 *
 * Requisitos de la AEAT (QR v0.5.0): ISO/IEC 18004, corrección de errores **M**, tamaño entre
 * 30×30 y 40×40 mm, zona de silencio de al menos 2 mm (recomendado 6 mm), el texto
 * «QR tributario:» encima y, en VERI*FACTU, «VERI*FACTU» o «Factura verificable en la sede
 * electrónica de la AEAT» debajo. Esta función genera solo el símbolo; los textos y el tamaño
 * físico corresponden a la maquetación de la factura.
 *
 * @packageDocumentation
 */
import { encodeQr, type ErrorCorrection, type QrMatrix } from './qrcodegen.ts';

export type { ErrorCorrection, QrMatrix };

export interface QrOptions {
  /** Nivel de corrección de errores. Por defecto `M`, el que exige la AEAT. */
  readonly errorCorrection?: ErrorCorrection;
}

/** Codifica un texto (normalmente la URL de `qrUrl`) en UTF-8 y devuelve la matriz de módulos. */
export function qrMatrix(text: string, options: QrOptions = {}): QrMatrix {
  return encodeQr(new TextEncoder().encode(text), options.errorCorrection ?? 'M');
}

export interface QrSvgOptions extends QrOptions {
  /** Zona de silencio en módulos. Por defecto, 4 (lo que recomienda la norma). */
  readonly margin?: number;
  /** Color de los módulos oscuros. Por defecto, `#000`. */
  readonly color?: string;
  /** Color de fondo; `null` para transparente. Por defecto, `#fff`. */
  readonly background?: string | null;
  /**
   * Tamaño CSS del SVG (atributos `width`/`height`), p. ej. `'35mm'`. Si se omite, el SVG escala
   * con su contenedor (`viewBox`).
   */
  readonly size?: string;
}

const escapeAttr = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Genera el código QR como SVG compacto (un único `path`).
 *
 * @example
 * const svg = qrSvg(qrUrl(record, { environment: 'production', mode: 'verifactu' }), { size: '35mm' });
 */
export function qrSvg(text: string, options: QrSvgOptions = {}): string {
  const { size, modules } = qrMatrix(text, options);
  const margin = options.margin ?? 4;
  const total = size + margin * 2;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules[y * size + x]) continue;
      // Agrupa módulos oscuros consecutivos de la fila en un solo rectángulo.
      let w = 1;
      while (x + w < size && modules[y * size + x + w]) w++;
      d += `M${x + margin} ${y + margin}h${w}v1h-${w}z`;
      x += w - 1;
    }
  }
  const dims =
    options.size === undefined
      ? ''
      : ` width="${escapeAttr(options.size)}" height="${escapeAttr(options.size)}"`;
  const bg =
    options.background === null
      ? ''
      : `<rect width="${total}" height="${total}" fill="${escapeAttr(options.background ?? '#fff')}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"${dims} shape-rendering="crispEdges">` +
    `${bg}<path fill="${escapeAttr(options.color ?? '#000')}" d="${d}"/></svg>`
  );
}
