# verifactu-ts — Spain's VERI\*FACTU for TypeScript and Node.js

[![npm](https://img.shields.io/npm/v/verifactu-ts?label=npm)](https://www.npmjs.com/package/verifactu-ts)
[![CI](https://github.com/Lagaress/verifactu-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/Lagaress/verifactu-ts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](./package.json)
[![TypeScript types](https://img.shields.io/badge/types-TypeScript-3178c6)](./src/index.ts)

[Español](./README.es.md) · **English**

Open-source library to integrate **VERI\*FACTU** — the invoicing records system of the Spanish Tax
Agency (**AEAT**, Agencia Tributaria; Royal Decree 1007/2023, Order HAC/1177/2024, the
"Ley Antifraude") — into any invoicing software written in JavaScript or TypeScript. It creates
**invoice records** (registration and cancellation), computes the **SHA-256 hash (huella)** and
the record chain, validates them against the official rules, produces the **XML** and the
verification **QR code**, and **submits and queries** records through the AEAT web service with
the taxpayer's electronic certificate. It also includes **XAdES signatures** and event records for
the NO VERI\*FACTU mode.

- **Zero runtime dependencies** and no install scripts. The core is about 22 KB gzipped.
- **Any runtime** with Web Crypto: Node.js ≥ 22, Deno, Bun, browsers and workers.
- **Faithful to the specification**: the XML is generated from the official XSD schemas and
  validated against them in the tests. It implements 90+ AEAT business rules with their official
  error codes and reproduces the official hash and signature examples.
- Strict TypeScript, ESM-only, typed errors. Identifiers are in English; error messages and
  validation texts are in Spanish (they mirror the AEAT terminology).

```sh
npm install verifactu-ts
```

> **⚠️ Legal notice.** This library **is not an invoicing system (SIF)** and comes **without a
> declaración responsable**. Whoever integrates it into their software is responsible for
> auditing it, complying with the applicable regulations and issuing their own declaración
> responsable. It is provided "as is", without warranty (MIT license).

## Supported specification

| AEAT document                     | Version                                         |
| --------------------------------- | ----------------------------------------------- |
| XSD schemas and WSDL (`tikeV1.0`) | snapshot of 2026-10-12 (`spec/aeat/2026-10-12`) |
| Web service description           | 1.0.3                                           |
| Validations and errors            | 1.2.2 (2026-04-08)                              |
| Hash specification                | 0.1.2                                           |
| QR and verification service       | 0.5.0                                           |

In code: `import { SPEC_VERSION } from 'verifactu-ts'`. Decisions on ambiguous points of the
specification are documented (in Spanish) in [docs/SPEC-NOTES.md](./docs/SPEC-NOTES.md).

**Timeline (as of 2026-10-12).** Under RDL 15/2025, VERI\*FACTU becomes mandatory on 2027-01-01
(corporate income tax payers) and 2027-07-01 (everyone else). On 2026-10-05 the Spanish Treasury
announced its intention to postpone it to October 2028, but no regulation has been published yet.

## What it does and what it doesn't

| Does                                                         | Doesn't (the invoicing system's job)                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Create registration and cancellation records with their hash | Store records or the chain                                                      |
| Chain records and verify chains                              | Number invoices or choose series                                                |
| Validate format and AEAT business rules                      | Check NIFs against the tax census, duplicates or powers of attorney (AEAT does) |
| Generate and parse record and submission XML                 | Wait for `TiempoEsperaEnvio` or retry on its own                                |
| Submit and query records (test and production environments)  | Manage queues or persist the CSV receipt                                        |
| QR verification URL and QR as SVG                            | Lay out the invoice                                                             |
| In-memory fake AEAT for tests                                | —                                                                               |

**NO VERI\*FACTU mode** (`verifactu-ts/no-verifactu`, experimental): XAdES-EPES signatures for
records, and signed, chained event records. Submission upon request uses
`client.send(records, { service: 'requirement', requirement })`. Anomaly detection and record
retention are the invoicing system's responsibility.

## Installation

```sh
npm install verifactu-ts
```

Requires Node.js ≥ 22.12, or Deno, Bun or a modern browser for the core. ESM-only package; from
CommonJS use `await import('verifactu-ts')`.

| Module                        | Contents                                                 |
| ----------------------------- | -------------------------------------------------------- |
| `verifactu-ts`                | Models, validation, hash, chaining, XML, QR URL          |
| `verifactu-ts/client`         | `AeatClient`, network errors, `fetchTransport`           |
| `verifactu-ts/transport/node` | `node:https` transport with client certificate           |
| `verifactu-ts/qr/render`      | QR code as SVG or matrix                                 |
| `verifactu-ts/no-verifactu`   | XAdES-EPES signatures and event records (NO VERI\*FACTU) |
| `verifactu-ts/testing`        | In-memory fake AEAT                                      |
| `verifactu-ts/errors`         | AEAT error code catalogue with official descriptions     |

## Usage

### 1. Create a registration record

```ts
import { createRegistrationRecord, toChainLink } from 'verifactu-ts';

const record = await createRegistrationRecord({
  invoiceId: { issuerId: 'A00000000', invoiceNumber: 'F2025-0042', issueDate: '2025-06-01' },
  issuerName: 'Perico de los Palotes, S.A.',
  invoiceType: 'F1',
  description: 'Consulting services',
  recipients: [{ name: 'Example Customer SL', nif: '00000000A' }],
  breakdown: [
    {
      taxType: '01', // VAT (IVA)
      regimeType: '01', // general regime
      operationType: 'S1', // subject and not exempt
      taxRate: '21',
      baseAmount: '1000.00',
      taxAmount: '210.00',
    },
  ],
  totalTaxAmount: '210.00',
  totalAmount: '1210.00',
  previous: lastLink, // ChainLink of the previous record, or null for the first one
  system, // your invoicing system's data (ComputerSystem)
  hashedAt: new Date(), // formatted in Europe/Madrid; also { instant, timeZone } or a string
});

record.hash; // SHA-256 hash (64 uppercase hex characters)
await save(record, toChainLink(record)); // the next record chains to this link
```

- Amounts are **decimal strings** (`'1210.00'`), so the text in the XML and in the hash match
  exactly. They are normalised to 2 decimals. Helpers: `centsToAmount(121000n)` and
  `amountFromNumber(1210)`.
- Invoice dates are `YYYY-MM-DD`. Codes (`InvoiceType`, `TaxType`, `RegimeType`, `OperationType`…)
  can be used as enums (`InvoiceType.Factura`) or as literals (`'F1'`).
- `createRegistrationRecord` **validates** the record and throws a `ValidationError` with every
  violation if any of them would make the AEAT reject it.

To cancel an invoice, use `createCancellationRecord({ invoiceId, previous, system, hashedAt })`.
To correct a record, create a new registration with `isCorrection: true`, plus
`priorRejection: 'X'` if the original registration was rejected.

### 2. Validate

```ts
import { validateRecord } from 'verifactu-ts';

for (const v of validateRecord(record)) {
  console.log(v.severity, v.path, v.message, v.aeatCode, v.reference);
  // 'error'     → the AEAT would reject the record
  // 'admisible' → the AEAT would accept it with errors and it must be corrected
}
```

### 3. QR code

```ts
import { qrUrl } from 'verifactu-ts';
import { qrSvg } from 'verifactu-ts/qr/render';

const url = qrUrl(record, { environment: 'production', mode: 'verifactu' });
const svg = qrSvg(url, { size: '35mm' }); // error correction level M, as the AEAT requires
```

The invoice must show "QR tributario:" above the code and "VERI\*FACTU" (or "Factura verificable
en la sede electrónica de la AEAT") below it, with a size between 30 and 40 mm.

### 4. Submit to the AEAT

```ts
import { readFile } from 'node:fs/promises';
import { AeatClient, nextSendAllowedAt } from 'verifactu-ts/client';
import { nodeTransport } from 'verifactu-ts/transport/node';

const client = new AeatClient({
  transport: nodeTransport({
    pfx: await readFile('certificate.p12'),
    passphrase: process.env.CERT_PASS,
  }),
  environment: 'test', // or 'production'
  certificateType: 'personal', // or 'seal' (electronic seal certificate)
  taxpayer: { name: 'Perico de los Palotes, S.A.', nif: 'A00000000' },
  system,
});

const res = await client.send([record]); // up to 1000 records (use chunkRecords for more)
res.status; // 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto'
res.csv; // store it: the AEAT will not give it to you again
res.items; // per record: status, error (code, description, kind), duplicate
nextSendAllowedAt(res); // honour TiempoEsperaEnvio before the next submission
```

Errors it can throw:

| Error              | When                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| `ValidationError`  | Local validation fails before sending.                                               |
| `SoapFaultError`   | The AEAT rejects the whole request. Includes `aeatCode` and `retryable`.             |
| `TransportError`   | Network failure, unexpected HTTP status or a non-XML response. Includes `retryable`. |
| `CertificateError` | The certificate can't be used: wrong password or legacy algorithms.                  |

**Retries.** If a `TransportError` happens after the request was sent (for example, the
connection drops while waiting for the response), the AEAT may already have stored the records.
On retry they will come back as duplicates (error 3000) with `item.duplicate`. If the duplicate's
status is `Correcta` or `AceptadaConErrores`, treat them as delivered.

**Legacy certificates.** Many PKCS#12 files exported from Windows or the FNMT use RC2-40, which
OpenSSL 3 no longer supports. `nodeTransport` detects this when it is created and explains how to
convert the file. Alternatively, run Node with `NODE_OPTIONS=--openssl-legacy-provider`.

**Deno, Bun and other runtimes.** Use `fetchTransport` with each runtime's client-certificate
option:

```ts
import { fetchTransport } from 'verifactu-ts/client';
// Deno
const transport = fetchTransport({ init: { client: Deno.createHttpClient({ cert, key }) } });
// Bun
const transport = fetchTransport({ init: { tls: { cert, key } } });
```

### 5. Query

```ts
for await (const r of client.query({ year: 2025, month: 6 })) {
  console.log(r.invoiceId.invoiceNumber, r.status, r.data.Huella);
}
```

### 6. NO VERI\*FACTU: signatures and events

```ts
import {
  createEventRecord,
  EventType,
  loadPemCredentials,
  signRecord,
  toEventChainLink,
} from 'verifactu-ts/no-verifactu';

// Unencrypted PEM; from a PKCS#12: openssl pkcs12 -in cert.p12 -nodes -out cert.pem
const credentials = await loadPemCredentials({ key: keyPem, certificates: certificatesPem });

const signed = await signRecord(record, credentials); // XAdES-EPES; the hash doesn't change
const event = await createEventRecord(
  {
    system,
    taxpayer,
    eventType: EventType.StartNoVerifactu,
    previous: lastEvent,
    generatedAt: new Date(),
  },
  credentials,
);
await save(event, toEventChainLink(event));
```

The signature follows the structure of the official AEAT example, and the tests verify that
example's signature with the same code. Before using it in production, read the open points in
[docs/SPEC-NOTES.md](./docs/SPEC-NOTES.md#no-verifactu-firma-xades-y-eventos).

### 7. Test without a certificate

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

The fake AEAT validates the XML against the schema and applies the library's rules. It also
detects duplicates, cancellations of unknown records and wrong hashes, and paginates queries. It
**does not replace** testing against the real AEAT test environment.

Complete, runnable examples are in [`examples/`](./examples).

## Size

Measured with esbuild (minified + gzip) on what you import; checked in CI (`npm run size`).

| Use                                 | gzip    |
| ----------------------------------- | ------- |
| Hash + QR URL                       | 1.3 KB  |
| Create and validate records         | 9.6 KB  |
| Full client + Node transport        | 22.1 KB |
| QR as SVG                           | 2.6 KB  |
| NO VERI\*FACTU (signature + events) | 15.3 KB |

## Roadmap

1. ✅ VERI\*FACTU: records, hash, validation, XML, QR, submission and queries.
2. 🧪 NO VERI\*FACTU: XAdES-EPES signatures and event records (experimental, to be confirmed
   against the AEAT submission-upon-request service).
3. ⏳ B2B e-invoicing (Order HAC/1028/2026): UBL invoices following EN 16931 and submission to the
   AEAT public e-invoicing platform, once the technical specifications are published.

## Development

```sh
npm ci
npm run ci                # typecheck, lint, format, generated code, tests, package and size
npm run test:integration  # AEAT test environment; needs a certificate (see test/integration)
```

To update to a new specification version, follow [MAINTAINING.md](./MAINTAINING.md). The mapping to
Verifactu-PHP is in [docs/PHP-CORRESPONDENCE.md](./docs/PHP-CORRESPONDENCE.md). Contributions are
welcome: see [CONTRIBUTING.md](./CONTRIBUTING.md). Internal documentation is in Spanish.

## License and attribution

MIT. Includes logic and tests ported from [Verifactu-PHP](https://github.com/josemmo/Verifactu-PHP)
(© José M. Moreno, MIT) and an adaptation of
[Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library)'s QR code generator (MIT).
The schemas and examples in `spec/` belong to the Agencia Tributaria and are reused citing their
source and date. See [NOTICE](./NOTICE).
