/**
 * Mide lo que añade la librería al bundle de quien la usa (minificado + gzip) y falla si se supera
 * el presupuesto. Cada escenario importa solo lo que necesita, para comprobar también que el
 * tree-shaking funciona (p. ej. calcular la huella no debe arrastrar el XML ni la validación).
 *
 *   npm run build && node --experimental-strip-types scripts/size.ts [--analyze]
 */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const SCENARIOS: { name: string; code: string; budget: number }[] = [
  {
    name: 'huella + QR',
    code: `export { calculateHash, qrUrl } from './dist/index.js';`,
    budget: 1_500,
  },
  {
    name: 'crear y validar registros',
    code: `export { createRegistrationRecord, createCancellationRecord } from './dist/index.js';`,
    budget: 10_500,
  },
  {
    name: 'crear registros + XML de envío',
    code: `export { createRegistrationRecord, buildSubmissionXml, soapEnvelope } from './dist/index.js';`,
    budget: 17_000,
  },
  { name: 'núcleo completo', code: `export * from './dist/index.js';`, budget: 22_500 },
  {
    name: 'catálogo de errores (opcional)',
    code: `export * from './dist/errors.js';`,
    budget: 6_700,
  },
];

let failed = false;
for (const s of SCENARIOS) {
  const result = await build({
    stdin: { contents: s.code, resolveDir: ROOT, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    treeShaking: true,
    metafile: true,
  });
  const bytes = result.outputFiles[0]!.contents;
  const gz = gzipSync(bytes, { level: 9 }).length;
  const ok = gz <= s.budget;
  failed ||= !ok;
  console.log(
    `${ok ? '✓' : '✗'} ${s.name.padEnd(30)} ${(bytes.length / 1024).toFixed(1).padStart(6)} KB min  ${(gz / 1024).toFixed(1).padStart(5)} KB gzip  (presupuesto ${(s.budget / 1024).toFixed(1)} KB)`,
  );
  if (process.argv.includes('--analyze')) {
    const inputs = Object.values(result.metafile.outputs)[0]!.inputs;
    for (const [file, info] of Object.entries(inputs)
      .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
      .slice(0, 10)) {
      console.log(`    ${String(info.bytesInOutput).padStart(7)}  ${file}`);
    }
  }
}
if (failed) process.exitCode = 1;
