/**
 * Genera src/spec/generated/errors.ts a partir de `errores.properties` (ISO-8859-1) de la AEAT.
 *
 *   node --experimental-strip-types scripts/gen-error-catalog.ts [--check]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** Las secciones del fichero, en orden, y la clase de error que representan. */
const SECTIONS = [
  { marker: 'rechazo del envío completo', kind: 'rechazo-envio' },
  { marker: 'rechazo de la factura', kind: 'rechazo-registro' },
  { marker: 'aceptación del registro', kind: 'admisible' },
] as const;

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const { id } = JSON.parse(await readFile(join(ROOT, 'spec/current.json'), 'utf8')) as {
    id: string;
  };
  const raw = await readFile(join(ROOT, 'spec/aeat', id, 'errores.properties'));
  const text = new TextDecoder('iso-8859-1').decode(raw);

  let kind: (typeof SECTIONS)[number]['kind'] | undefined;
  const entries: { code: number; kind: string; description: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('*')) {
      const section = SECTIONS.find((s) => line.includes(s.marker));
      if (!section) throw new Error(`Sección desconocida en errores.properties: ${line}`);
      kind = section.kind;
      continue;
    }
    const m = /^\s*(\d+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) {
      if (line.trim()) throw new Error(`Línea no reconocida en errores.properties: ${line}`);
      continue;
    }
    if (!kind) throw new Error('Código de error fuera de sección');
    const code = Number(m[1]);
    if (entries.some((e) => e.code === code)) throw new Error(`Código duplicado: ${code}`);
    entries.push({ code, kind, description: m[2] ?? '' });
  }

  const out =
    `// GENERADO AUTOMÁTICAMENTE por scripts/gen-error-catalog.ts a partir de spec/aeat/${id}/errores.properties.\n` +
    `// No editar a mano: ejecutar \`npm run gen:errors\`.\n/* eslint-disable */\n` +
    `import type { AeatErrorInfo } from '../errors.ts';\n\n` +
    `export const AEAT_ERRORS: Readonly<Record<number, AeatErrorInfo>> = {\n` +
    entries
      .map(
        (e) =>
          `  ${e.code}: { kind: ${JSON.stringify(e.kind)}, description: ${JSON.stringify(e.description)} },`,
      )
      .join('\n') +
    `\n};\n`;

  const path = join(ROOT, 'src/spec/generated/errors.ts');
  if (check) {
    const prev = await readFile(path, 'utf8').catch(() => '');
    if (prev !== out) {
      console.error(
        '✗ src/spec/generated/errors.ts no coincide con errores.properties (ejecuta npm run gen:errors)',
      );
      process.exitCode = 1;
    }
    return;
  }
  await mkdir(join(ROOT, 'src/spec/generated'), { recursive: true });
  await writeFile(path, out);
  console.log(`Generados ${entries.length} códigos de error desde spec/aeat/${id}.`);
}

await main();
