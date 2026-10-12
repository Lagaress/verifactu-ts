# verifactu-ts

Librería TypeScript para integrar **VERI\*FACTU** (Agencia Tributaria; RD 1007/2023 y Orden
HAC/1177/2024) en software de facturación: registros de alta y anulación, huella y
encadenamiento, validación, XML, código QR y envío y consulta en el servicio web de la AEAT.

- **Sin dependencias** en runtime y sin scripts de instalación. Núcleo de ~21 KB gzip.
- **Cualquier runtime** con Web Crypto: Node.js ≥ 22, Deno, Bun, navegadores y workers. El
  cliente de red está separado y su transporte se puede sustituir.
- **Fiel a la especificación**: el XML se genera desde los XSD oficiales y se valida contra ellos
  en los tests; más de 90 reglas de negocio con el código de error de la AEAT.
- TypeScript estricto, ESM, errores tipados y mensajes en español.

> [!IMPORTANT]
> **Aviso legal.** Esta librería **no es un Sistema Informático de Facturación (SIF)** y se
> ofrece **sin declaración responsable**. Quien la integre en su software es responsable de
> auditarla, de cumplir la normativa aplicable y de emitir su propia declaración responsable.
> Se distribuye «tal cual», sin garantías (licencia MIT).

**English summary.** TypeScript library for Spain's VERI\*FACTU e-invoicing records (AEAT): typed
record models, SHA-256 hash chaining, validation against the official rules, XML generated from the
official XSDs, QR codes, and a SOAP client for submitting and querying records. Zero runtime
dependencies, ESM, runs on Node ≥ 22, Deno, Bun and browsers. It is a building block, **not** a
certified invoicing system. Messages and docs are in Spanish.

## Especificación soportada

| Documento de la AEAT             | Versión                                             |
| -------------------------------- | --------------------------------------------------- |
| Esquemas XSD y WSDL (`tikeV1.0`) | instantánea del 12/10/2026 (`spec/aeat/2026-10-12`) |
| Descripción del servicio web     | 1.0.3                                               |
| Validaciones y errores           | 1.2.2 (08/04/2026)                                  |
| Especificación de la huella      | 0.1.2                                               |
| QR y servicio de cotejo          | 0.5.0                                               |

En código: `import { SPEC_VERSION } from 'verifactu-ts'`. Las decisiones sobre ambigüedades de la
especificación están en [docs/SPEC-NOTES.md](./docs/SPEC-NOTES.md).

**Calendario (12/10/2026).** Según el RDL 15/2025, VERI\*FACTU es obligatorio el 1/1/2027
(contribuyentes del Impuesto sobre Sociedades) y el 1/7/2027 (resto). Hacienda anunció el
5/10/2026 su intención de aplazarlo a octubre de 2028, pero aún no hay norma publicada.

## Qué hace y qué no

| Hace                                                         | No hace (responsabilidad del SIF)                                            |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Crear registros de alta y anulación con la huella calculada  | Guardar los registros ni la cadena                                           |
| Encadenar registros y verificar cadenas                      | Numerar facturas ni elegir series                                            |
| Validar formato y reglas de negocio de la AEAT               | Comprobar NIF en el censo, duplicados o apoderamientos (eso lo hace la AEAT) |
| Generar y leer el XML de registros y envíos                  | Esperar `TiempoEsperaEnvio` ni reintentar por sí misma                       |
| Enviar y consultar en el servicio web (pruebas y producción) | Gestionar colas ni persistir el CSV                                          |
| URL del QR y QR en SVG                                       | Maquetar la factura                                                          |
| AEAT simulada para tests                                     | —                                                                            |

**Modalidad NO VERI\*FACTU**: todavía no. Requiere firma XAdES de cada registro y el registro de
eventos firmado; está prevista en la hoja de ruta. El cliente ya admite el servicio de
requerimiento (`service: 'requirement'`) y el QR la URL `ValidarQRNoVerifactu`.

## Instalación

```sh
npm install verifactu-ts
```

Requiere Node.js ≥ 22.12, o Deno, Bun o un navegador moderno para el núcleo. Es un paquete solo
ESM; desde CommonJS, usa `await import('verifactu-ts')`.

| Módulo                        | Contenido                                                    |
| ----------------------------- | ------------------------------------------------------------ |
| `verifactu-ts`                | Modelos, validación, huella, encadenamiento, XML, URL del QR |
| `verifactu-ts/client`         | `AeatClient`, errores de red, `fetchTransport`               |
| `verifactu-ts/transport/node` | Transporte `node:https` con certificado de cliente           |
| `verifactu-ts/qr/render`      | QR en SVG o matriz                                           |
| `verifactu-ts/testing`        | AEAT simulada en memoria                                     |
| `verifactu-ts/errors`         | Catálogo de códigos de error con su descripción oficial      |

## Uso

### 1. Crear un registro de alta

```ts
import { createRegistrationRecord, toChainLink } from 'verifactu-ts';

const record = await createRegistrationRecord({
  invoiceId: { issuerId: 'A00000000', invoiceNumber: 'F2025-0042', issueDate: '2025-06-01' },
  issuerName: 'Perico de los Palotes, S.A.',
  invoiceType: 'F1',
  description: 'Servicios de consultoría',
  recipients: [{ name: 'Cliente Ejemplo SL', nif: '00000000A' }],
  breakdown: [
    {
      taxType: '01',
      regimeType: '01',
      operationType: 'S1',
      taxRate: '21',
      baseAmount: '1000.00',
      taxAmount: '210.00',
    },
  ],
  totalTaxAmount: '210.00',
  totalAmount: '1210.00',
  previous: ultimoEnlace, // ChainLink del registro anterior, o null si es el primero
  system, // datos del sistema informático (ComputerSystem)
  hashedAt: new Date(), // se formatea en Europe/Madrid; también { instant, timeZone } o una cadena
});

record.hash; // huella SHA-256 (64 caracteres hexadecimales en mayúsculas)
await guardar(record, toChainLink(record)); // el siguiente registro se encadena con este enlace
```

- Los importes son **cadenas decimales** (`'1210.00'`) para que el texto del XML y el de la huella
  coincidan exactamente. Se normalizan a 2 decimales. Para convertir:
  `centsToAmount(121000n)` y `amountFromNumber(1210)`.
- Las fechas de factura son `AAAA-MM-DD`. Las claves (`InvoiceType`, `TaxType`, `RegimeType`,
  `OperationType`…) se pueden usar como enums (`InvoiceType.Factura`) o como literales (`'F1'`).
- `createRegistrationRecord` **valida** el registro y lanza `ValidationError` con todas las
  violaciones si alguna provocaría el rechazo de la AEAT.

Para anular una factura, usa `createCancellationRecord({ invoiceId, previous, system, hashedAt })`.
Para subsanar un registro, crea un alta nueva con `isCorrection: true`, y con
`priorRejection: 'X'` si el alta original fue rechazada.

### 2. Validar

```ts
import { validateRecord } from 'verifactu-ts';

for (const v of validateRecord(record)) {
  console.log(v.severity, v.path, v.message, v.aeatCode, v.reference);
  // 'error'     → la AEAT rechazaría el registro
  // 'admisible' → la AEAT lo aceptaría con errores y habría que subsanarlo
}
```

### 3. Código QR

```ts
import { qrUrl } from 'verifactu-ts';
import { qrSvg } from 'verifactu-ts/qr/render';

const url = qrUrl(record, { environment: 'production', mode: 'verifactu' });
const svg = qrSvg(url, { size: '35mm' }); // corrección de errores M, como exige la AEAT
```

La factura debe mostrar «QR tributario:» encima del código y «VERI\*FACTU» (o «Factura
verificable en la sede electrónica de la AEAT») debajo, con un tamaño de entre 30 y 40 mm.

### 4. Enviar a la AEAT

```ts
import { readFile } from 'node:fs/promises';
import { AeatClient, nextSendAllowedAt } from 'verifactu-ts/client';
import { nodeTransport } from 'verifactu-ts/transport/node';

const client = new AeatClient({
  transport: nodeTransport({
    pfx: await readFile('certificado.p12'),
    passphrase: process.env.CERT_PASS,
  }),
  environment: 'test', // o 'production'
  certificateType: 'personal', // o 'seal' (sello electrónico)
  taxpayer: { name: 'Perico de los Palotes, S.A.', nif: 'A00000000' },
  system,
});

const res = await client.send([record]); // hasta 1000 registros (chunkRecords para más)
res.status; // 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto'
res.csv; // guárdalo: la AEAT no lo vuelve a dar
res.items; // por registro: status, error (code, description, kind), duplicate
nextSendAllowedAt(res); // respeta TiempoEsperaEnvio antes del siguiente envío
```

Errores que puede lanzar:

| Error              | Cuándo se lanza                                                                   |
| ------------------ | --------------------------------------------------------------------------------- |
| `ValidationError`  | La validación local falla antes de enviar.                                        |
| `SoapFaultError`   | La AEAT rechaza la petición entera. Lleva `aeatCode` y `retryable`.               |
| `TransportError`   | Falla la red, hay un HTTP inesperado o la respuesta no es XML. Lleva `retryable`. |
| `CertificateError` | El certificado no se puede usar: contraseña incorrecta o algoritmos antiguos.     |

**Certificados antiguos.** Muchos PKCS#12 exportados desde Windows o la FNMT usan RC2-40, que
OpenSSL 3 ya no admite. `nodeTransport` lo detecta al crearse y explica cómo convertirlo. Otra
opción es ejecutar Node con `NODE_OPTIONS=--openssl-legacy-provider`.

**Deno, Bun y otros entornos.** Usa `fetchTransport` con la opción de certificado de cliente de
cada runtime:

```ts
import { fetchTransport } from 'verifactu-ts/client';
// Deno
const transport = fetchTransport({ init: { client: Deno.createHttpClient({ cert, key }) } });
// Bun
const transport = fetchTransport({ init: { tls: { cert, key } } });
```

### 5. Consultar

```ts
for await (const r of client.query({ year: 2025, month: 6 })) {
  console.log(r.invoiceId.invoiceNumber, r.status, r.data.Huella);
}
```

### 6. Probar sin certificado

```ts
import { createFakeAeat } from 'verifactu-ts/testing';

const aeat = createFakeAeat();
const client = new AeatClient({
  transport: aeat.transport,
  environment: 'test',
  certificateType: 'personal',
  taxpayer,
});
```

La AEAT simulada valida el XML contra el esquema y aplica las reglas de la librería. También
detecta duplicados, anulaciones de registros inexistentes y huellas incorrectas, y pagina las
consultas. **No sustituye** a las pruebas en el entorno de pruebas real de la AEAT.

Hay ejemplos completos y ejecutables en [`examples/`](./examples).

## Tamaño

Medido con esbuild (minificado + gzip) sobre lo que se importa; se comprueba en CI
(`npm run size`).

| Uso                                | gzip    |
| ---------------------------------- | ------- |
| Huella + URL del QR                | 1,3 KB  |
| Crear y validar registros          | 9,6 KB  |
| Cliente completo + transporte Node | 21,6 KB |
| QR en SVG                          | 2,6 KB  |

## Hoja de ruta

1. ✅ VERI\*FACTU: registros, huella, validación, XML, QR, envío y consulta.
2. ⏳ NO VERI\*FACTU: firma XAdES-EPES de registros y registro de eventos.
3. ⏳ Factura electrónica B2B (Orden HAC/1028/2026): UBL según EN 16931 y envío a la solución
   pública de la AEAT, cuando se publiquen las especificaciones técnicas.

## Desarrollo

```sh
npm ci
npm run ci                # typecheck, lint, formato, generados al día, tests, paquete y tamaño
npm run test:integration  # entorno de pruebas de la AEAT; requiere certificado (ver test/integration)
```

Para actualizar a una nueva versión de la especificación, sigue [MAINTAINING.md](./MAINTAINING.md).
La correspondencia con Verifactu-PHP está en [docs/PHP-CORRESPONDENCE.md](./docs/PHP-CORRESPONDENCE.md).

## Licencia y atribución

MIT. Incluye lógica y tests portados de [Verifactu-PHP](https://github.com/josemmo/Verifactu-PHP)
(© José M. Moreno, MIT) y una adaptación del generador QR de
[Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library) (MIT). Los esquemas y
ejemplos de `spec/` son de la Agencia Tributaria y se reutilizan citando la fuente y la fecha. Ver
[NOTICE](./NOTICE).
