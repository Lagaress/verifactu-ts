/*
 * Codificador QR (ISO/IEC 18004, modelo 2) en modo byte.
 *
 * Adaptación de «QR Code generator library (TypeScript)» de Project Nayuki
 * (https://www.nayuki.io/page/qr-code-generator-library, commit 3c6d0b3), reducida al modo byte y
 * convertida a funciones ESM con matrices `Uint8Array`.
 *
 * Copyright (c) Project Nayuki. (MIT License)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */

/** Nivel de corrección de errores. La AEAT exige `M` (QR v0.5.0). */
export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

/** Matriz de un código QR: `modules[y * size + x]` es 1 si el módulo es oscuro. */
export interface QrMatrix {
  readonly version: number;
  readonly size: number;
  readonly errorCorrection: ErrorCorrection;
  readonly mask: number;
  readonly modules: Uint8Array;
}

const ECC_ORDINAL: Readonly<Record<ErrorCorrection, number>> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS: Readonly<Record<ErrorCorrection, number>> = { L: 1, M: 0, Q: 3, H: 2 };

// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
// prettier-ignore
const NUM_ERROR_CORRECTION_BLOCKS: readonly (readonly number[])[] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const at = (table: readonly (readonly number[])[], ecc: ErrorCorrection, ver: number): number =>
  table[ECC_ORDINAL[ecc]]?.[ver] ?? 0;

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver: number, ecc: ErrorCorrection): number {
  return (
    Math.floor(numRawDataModules(ver) / 8) -
    at(ECC_CODEWORDS_PER_BLOCK, ecc, ver) * at(NUM_ERROR_CORRECTION_BLOCKS, ecc, ver)
  );
}

function rsMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = rsMultiply(result[j] ?? 0, root) ^ (j + 1 < degree ? (result[j + 1] ?? 0) : 0);
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] = (result[i] ?? 0) ^ rsMultiply(coef, factor);
    });
  }
  return result;
}

/**
 * Codifica `data` (bytes) como código QR en modo byte, en la versión mínima que lo admita.
 * El nivel de corrección se respeta tal cual (no se eleva automáticamente).
 *
 * @throws RangeError si los datos no caben en un QR de versión 40.
 */
export function encodeQr(data: Uint8Array, ecc: ErrorCorrection = 'M'): QrMatrix {
  // Versión mínima: 4 bits de modo + contador (8 o 16 bits) + 8 bits por byte.
  let version = 1;
  for (; ; version++) {
    if (version > 40) throw new RangeError('Los datos no caben en un código QR');
    const used = 4 + (version <= 9 ? 8 : 16) + data.length * 8;
    if (used <= numDataCodewords(version, ecc) * 8) break;
  }

  // Flujo de bits: modo byte (0100), contador, datos, terminador, relleno.
  const bits: number[] = [];
  const append = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  append(0b0100, 4);
  append(data.length, version <= 9 ? 8 : 16);
  for (const b of data) append(b, 8);
  const capacity = numDataCodewords(version, ecc) * 8;
  append(0, Math.min(4, capacity - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);
  const codewords = new Array<number>(capacity / 8).fill(0);
  bits.forEach((b, i) => {
    codewords[i >>> 3] = (codewords[i >>> 3] ?? 0) | (b << (7 - (i & 7)));
  });

  const size = version * 4 + 17;
  const modules = new Uint8Array(size * size);
  const isFunction = new Uint8Array(size * size);
  const set = (x: number, y: number, dark: boolean) => {
    modules[y * size + x] = dark ? 1 : 0;
    isFunction[y * size + x] = 1;
  };

  // Patrones de función.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const align: number[] = [];
  if (version > 1) {
    const numAlign = Math.floor(version / 7) + 2;
    const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    align.push(6);
    for (let pos = size - 7; align.length < numAlign; pos -= step) align.splice(1, 0, pos);
  }
  const n = align.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      const cx = align[i] ?? 0;
      const cy = align[j] ?? 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++)
          set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  const drawFormat = (mask: number) => {
    const d = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((d << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((f >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const v = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((v >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  // Corrección de errores (Reed-Solomon) e intercalado.
  const numBlocks = at(NUM_ERROR_CORRECTION_BLOCKS, ecc, version);
  const blockEccLen = at(ECC_CODEWORDS_PER_BLOCK, ecc, version);
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = codewords.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const eccBytes = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(eccBytes));
  }
  const all: number[] = [];
  const blockLen = blocks[0]?.length ?? 0;
  for (let i = 0; i < blockLen; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) all.push(block[i] ?? 0);
    });
  }

  // Colocación en zigzag.
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        const idx = y * size + x;
        if (!isFunction[idx] && bitIndex < all.length * 8) {
          modules[idx] = ((all[bitIndex >>> 3] ?? 0) >>> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
        }
      }
    }
  }

  // Máscara: se elige la de menor penalización.
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        if (isFunction[idx]) continue;
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break; // prettier-ignore
          case 1: invert = y % 2 === 0; break; // prettier-ignore
          case 2: invert = x % 3 === 0; break; // prettier-ignore
          case 3: invert = (x + y) % 3 === 0; break; // prettier-ignore
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break; // prettier-ignore
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break; // prettier-ignore
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break; // prettier-ignore
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; // prettier-ignore
        }
        if (invert) modules[idx] = (modules[idx] ?? 0) ^ 1;
      }
    }
  };
  let best = 0;
  let minPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const p = penalty(modules, size);
    if (p < minPenalty) {
      best = m;
      minPenalty = p;
    }
    applyMask(m);
  }
  applyMask(best);
  drawFormat(best);
  return { version, size, errorCorrection: ecc, mask: best, modules };
}

function penalty(modules: Uint8Array, size: number): number {
  let result = 0;
  const finderCount = (h: number[]): number => {
    const n = h[1] ?? 0;
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (
      (core && (h[0] ?? 0) >= n * 4 && (h[6] ?? 0) >= n ? 1 : 0) +
      (core && (h[6] ?? 0) >= n * 4 && (h[0] ?? 0) >= n ? 1 : 0)
    );
  };
  const addHistory = (run: number, h: number[]) => {
    if (h[0] === 0) run += size;
    h.pop();
    h.unshift(run);
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      let runColor = 0;
      let run = 0;
      const h = [0, 0, 0, 0, 0, 0, 0];
      for (let b = 0; b < size; b++) {
        const c = pass === 0 ? (modules[a * size + b] ?? 0) : (modules[b * size + a] ?? 0);
        if (c === runColor) {
          run++;
          if (run === 5) result += 3;
          else if (run > 5) result++;
        } else {
          addHistory(run, h);
          if (!runColor) result += finderCount(h) * 40;
          runColor = c;
          run = 1;
        }
      }
      if (runColor) {
        addHistory(run, h);
        run = 0;
      }
      run += size;
      addHistory(run, h);
      result += finderCount(h) * 40;
    }
  }
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y * size + x];
      if (
        c === modules[y * size + x + 1] &&
        c === modules[(y + 1) * size + x] &&
        c === modules[(y + 1) * size + x + 1]
      )
        result += 3;
    }
  }
  let dark = 0;
  for (const m of modules) dark += m;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return result + k * 10;
}
