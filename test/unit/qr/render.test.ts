import fc from 'fast-check';
import jsQRModule from 'jsqr';
import { describe, expect, it } from 'vitest';
import {
  qrMatrix,
  qrSvg,
  type ErrorCorrection,
  type QrMatrix,
} from '../../../src/qr/render/index.ts';

// jsqr es CommonJS con `export default` en sus tipos.
type JsQR = (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
const jsQR = ((jsQRModule as unknown as { default?: JsQR }).default ??
  jsQRModule) as unknown as JsQR;

/** API mínima del original de Nayuki que se usa como referencia. */
interface NayukiQr {
  readonly size: number;
  readonly mask: number;
  getModule(x: number, y: number): boolean;
}
interface Nayuki {
  QrCode: {
    Ecc: Record<'LOW' | 'MEDIUM' | 'QUARTILE' | 'HIGH', unknown>;
    encodeSegments(
      segs: unknown[],
      ecl: unknown,
      min: number,
      max: number,
      mask: number,
      boost: boolean,
    ): NayukiQr;
  };
  QrSegment: { makeBytes(data: number[]): unknown };
}
// Se carga con una ruta no literal para que tsc no compile el original (usa `namespace`).
const NAYUKI_PATH = '../../fixtures/nayuki/qrcodegen.ts';
const { qrcodegen } = (await import(/* @vite-ignore */ NAYUKI_PATH)) as { qrcodegen: Nayuki };

const ECC = {
  L: qrcodegen.QrCode.Ecc.LOW,
  M: qrcodegen.QrCode.Ecc.MEDIUM,
  Q: qrcodegen.QrCode.Ecc.QUARTILE,
  H: qrcodegen.QrCode.Ecc.HIGH,
};

/** Matriz del original de Nayuki (modo byte, sin elevar el nivel de corrección). */
function reference(
  text: string,
  ecc: ErrorCorrection,
): { size: number; modules: number[]; mask: number } {
  const bytes = [...new TextEncoder().encode(text)];
  const seg = qrcodegen.QrSegment.makeBytes(bytes);
  const qr = qrcodegen.QrCode.encodeSegments([seg], ECC[ecc], 1, 40, -1, false);
  const modules: number[] = [];
  for (let y = 0; y < qr.size; y++)
    for (let x = 0; x < qr.size; x++) modules.push(qr.getModule(x, y) ? 1 : 0);
  return { size: qr.size, modules, mask: qr.mask };
}

/** Pinta la matriz como imagen RGBA y la lee con jsQR (lector independiente). */
function decode(m: QrMatrix, scale = 4, margin = 4): string | undefined {
  const px = (m.size + margin * 2) * scale;
  const img = new Uint8ClampedArray(px * px * 4).fill(255);
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.modules[y * m.size + x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + margin) * scale + dy) * px + (x + margin) * scale + dx) * 4;
          img[i] = img[i + 1] = img[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(img, px, px)?.data;
}

const URL_ =
  'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%26G33&fecha=01-01-2024&importe=241.4';

describe('codificador QR', () => {
  it('produce el mismo símbolo que el original de Project Nayuki', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'binary', maxLength: 300 }),
        fc.constantFrom<ErrorCorrection>('L', 'M', 'Q', 'H'),
        (text, ecc) => {
          const ours = qrMatrix(text, { errorCorrection: ecc });
          const ref = reference(text, ecc);
          expect(ours.size).toBe(ref.size);
          expect(ours.mask).toBe(ref.mask);
          expect([...ours.modules]).toEqual(ref.modules);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('usa corrección M por defecto y no la eleva', () => {
    const m = qrMatrix(URL_);
    expect(m.errorCorrection).toBe('M');
    expect(m.version).toBe(8); // 131 bytes: la versión 7-M admite 122 y la 8-M, 152
    expect(m.size).toBe(49);
  });

  it('un lector independiente (jsQR) lee las URL de cotejo', () => {
    for (const text of [
      URL_,
      URL_.replace('ValidarQR', 'ValidarQRNoVerifactu'),
      `${URL_}&x=${'A'.repeat(200)}`,
      'Ñandú €',
    ]) {
      expect(decode(qrMatrix(text))).toBe(text);
    }
  });

  it('versiones grandes (con bloques de versión) se leen correctamente', () => {
    const text = 'X'.repeat(1200);
    const m = qrMatrix(text, { errorCorrection: 'L' });
    expect(m.version).toBeGreaterThanOrEqual(7);
    expect(decode(m, 2)).toBe(text);
  });

  it('rechaza datos que no caben', () => {
    expect(() => qrMatrix('x'.repeat(3000), { errorCorrection: 'H' })).toThrow(RangeError);
  });
});

describe('qrSvg', () => {
  it('genera un SVG compacto con zona de silencio y tamaño opcional', () => {
    const svg = qrSvg(URL_, { size: '35mm' });
    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 57 57" width="35mm" height="35mm"/,
    );
    expect(svg).toContain('<rect width="57" height="57" fill="#fff"/>');
    expect(svg.match(/<path/g)).toHaveLength(1);
    expect(qrSvg(URL_, { background: null, margin: 2, color: '#123' })).toMatch(
      /viewBox="0 0 53 53".*fill="#123"/,
    );
    expect(qrSvg(URL_, { background: null })).not.toContain('<rect');
  });

  it('dibuja exactamente los módulos de la matriz', () => {
    const m = qrMatrix(URL_);
    const grid = new Uint8Array(m.size * m.size);
    for (const [, x, y, w] of qrSvg(URL_, { margin: 0 }).matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      for (let i = 0; i < Number(w); i++) grid[Number(y) * m.size + Number(x) + i] = 1;
    }
    expect([...grid]).toEqual([...m.modules]);
  });
});
