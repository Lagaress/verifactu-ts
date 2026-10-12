/**
 * Descarga el material técnico de la AEAT a `spec/aeat/<id>/` y genera `manifest.json`.
 *
 *   node --experimental-strip-types scripts/fetch-spec.ts <id>   → descarga una instantánea nueva
 *   node --experimental-strip-types scripts/fetch-spec.ts --check → compara la AEAT con la versión actual
 *
 * Con `--check` termina con código 1 si algún fichero ha cambiado (lo usa el workflow semanal).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const PROD =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/';
const PRE =
  'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/';
const DOCS =
  'https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/';

interface FileSource {
  /** Ruta relativa dentro de la carpeta de la versión. */
  path: string;
  url: string;
}

/** Ficheros que se versionan en el repositorio (reutilización permitida citando fuente y fecha). */
const FILES: FileSource[] = [
  ...[
    'SuministroLR.xsd',
    'SuministroInformacion.xsd',
    'RespuestaSuministro.xsd',
    'ConsultaLR.xsd',
    'RespuestaConsultaLR.xsd',
    'EventosSIF.xsd',
    'RespuestaValRegistNoVeriFactu.xsd',
  ].map((name) => ({ path: `xsd/${name}`, url: PROD + name })),
  { path: 'wsdl/SistemaFacturacion.wsdl', url: PROD + 'SistemaFacturacion.wsdl' },
  // El catálogo de errores solo se publica en el entorno de pruebas.
  { path: 'errores.properties', url: PRE + 'errores.properties' },
  {
    path: 'xsd/xmldsig-core-schema.xsd',
    url: 'http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd',
  },
];

/** Documentos que solo se referencian (no se versionan): versión anotada a mano al revisar. */
const DOCUMENTS: { id: string; title: string; version: string; date: string; url: string }[] = [
  {
    id: 'sweb',
    title: 'Descripción del servicio web',
    version: '1.0.3',
    date: '2025-07-28',
    url: DOCS + 'Veri-Factu_Descripcion_SWeb.pdf',
  },
  {
    id: 'validaciones',
    title: 'Validaciones y errores',
    version: '1.2.2',
    date: '2026-04-08',
    url: DOCS + 'Validaciones_Errores_Veri-Factu.pdf',
  },
  {
    id: 'diseno-registro',
    title: 'Diseño de registro',
    version: '1.0',
    date: '2024-10-28',
    url: DOCS + 'DsRegistroVeriFactu.xlsx',
  },
  {
    id: 'huella',
    title: 'Especificaciones técnicas de la huella o hash',
    version: '0.1.2',
    date: '2024-08-27',
    url: DOCS + 'Veri-Factu_especificaciones_huella_hash_registros.pdf',
  },
  {
    id: 'qr',
    title: 'Características del QR y servicio de cotejo',
    version: '0.5.0',
    date: '2025-12-10',
    url: DOCS + 'DetalleEspecificacTecnCodigoQRfactura.pdf',
  },
  {
    id: 'firma',
    title: 'Especificaciones de firma electrónica de registros',
    version: '0.1.5',
    date: '2025-03-06',
    url: DOCS + 'Espec-Tecnicas/EspecTecGenerFirmaElectRfact.pdf',
  },
  {
    id: 'firma-ejemplos',
    title: 'Ejemplos de firma de registros',
    version: '0.1.5',
    date: '2025-03-06',
    url: DOCS + 'Espec-Tecnicas/AnexosEjemplosFirmaRegFact.zip',
  },
  {
    id: 'validacion-novf',
    title: 'Servicio de validación de registros NO VERI*FACTU',
    version: '0.2',
    date: '2025-09-17',
    url: DOCS + 'Descripcion_ServicioWeb_ValidacionNoVerifactu.pdf',
  },
  {
    id: 'faq-desarrolladores',
    title: 'FAQ para desarrolladores',
    version: '1.3',
    date: '2025-12-04',
    url: DOCS + 'FAQs-Desarrolladores.pdf',
  },
];

interface ManifestEntry {
  path: string;
  url: string;
  sha256: string;
  lastModified: string | null;
}

interface Manifest {
  id: string;
  retrievedAt: string;
  source: string;
  files: ManifestEntry[];
  documents: ((typeof DOCUMENTS)[number] & { sha256: string; lastModified: string | null })[];
}

async function download(url: string): Promise<{ body: Uint8Array; lastModified: string | null }> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
    return {
      body: new Uint8Array(await res.arrayBuffer()),
      lastModified: res.headers.get('last-modified'),
    };
  } catch (error) {
    // www.agenciatributaria.es presenta una cadena con una CA firmada con un algoritmo que
    // OpenSSL 3 rechaza ("CA signature digest algorithm too weak"); curl usa el almacén del sistema.
    if ((error as { cause?: { message?: string } }).cause?.message?.includes('too weak'))
      return curl(url);
    throw error;
  }
}

function curl(url: string): { body: Uint8Array; lastModified: string | null } {
  const headers = execFileSync('curl', ['-sSfLI', url], { encoding: 'utf8' });
  const lastModified = /^last-modified:\s*(.+?)\r?$/im.exec(headers)?.[1] ?? null;
  return {
    body: new Uint8Array(execFileSync('curl', ['-sSfL', url], { maxBuffer: 64 * 1024 * 1024 })),
    lastModified,
  };
}

const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');

async function currentId(): Promise<string> {
  const current = JSON.parse(await readFile(join(ROOT, 'spec/current.json'), 'utf8')) as {
    id: string;
  };
  return current.id;
}

async function snapshot(id: string): Promise<void> {
  const dir = join(ROOT, 'spec/aeat', id);
  const files: ManifestEntry[] = [];
  for (const f of FILES) {
    const { body, lastModified } = await download(f.url);
    await mkdir(dirname(join(dir, f.path)), { recursive: true });
    await writeFile(join(dir, f.path), body);
    files.push({ path: f.path, url: f.url, sha256: sha256(body), lastModified });
    console.log(`✓ ${f.path}`);
  }
  const documents: Manifest['documents'] = [];
  for (const d of DOCUMENTS) {
    const { body, lastModified } = await download(d.url);
    documents.push({ ...d, sha256: sha256(body), lastModified });
    console.log(`✓ ${d.id} (${d.version})`);
  }
  const manifest: Manifest = {
    id,
    retrievedAt: new Date().toISOString(),
    source:
      'Agencia Estatal de Administración Tributaria (https://sede.agenciatributaria.gob.es). ' +
      'Reutilización conforme al aviso legal de la Sede: se cita la fuente y la fecha de actualización (lastModified).',
    files,
    documents,
  };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

async function check(): Promise<boolean> {
  const id = await currentId();
  const manifest = JSON.parse(
    await readFile(join(ROOT, 'spec/aeat', id, 'manifest.json'), 'utf8'),
  ) as Manifest;
  let changed = false;
  for (const entry of [...manifest.files, ...manifest.documents]) {
    const { body, lastModified } = await download(entry.url);
    const hash = sha256(body);
    if (hash !== entry.sha256) {
      changed = true;
      console.log(`✗ CAMBIADO: ${entry.url} (Last-Modified: ${lastModified ?? '—'})`);
    }
  }
  if (!changed) console.log(`Sin cambios respecto a spec/aeat/${id}.`);
  return changed;
}

const arg = process.argv[2];
if (arg === '--check') {
  process.exitCode = (await check()) ? 1 : 0;
} else if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  await snapshot(arg);
} else {
  console.error('Uso: fetch-spec.ts <AAAA-MM-DD> | --check');
  process.exitCode = 2;
}
