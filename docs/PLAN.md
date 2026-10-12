# Plan: librería TypeScript para VERI\*FACTU

> Estado: **decisiones de producto resueltas (§2); pendiente de tu visto bueno para implementar**. No se ha escrito código.
> Fecha: 12/10/2026. Nombre provisional del paquete: `verifactu-ts` (libre en npm; ver §10).

---

## 1. Resumen de la investigación

### 1.1 Estado normativo (verificado el 12/10/2026)

| Tema                                                    | Situación                                                                                                                                                                                                                                                                        | Fuente                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Plazos VERI\*FACTU vigentes                             | 1/1/2027 (contribuyentes del IS) y 1/7/2027 (resto), por el RDL 15/2025 (BOE 3/12/2025).                                                                                                                                                                                         | FAQ desarrolladores v1.3; Sede AEAT                              |
| Aplazamiento a 2028                                     | **Solo anunciado.** La nota de Hacienda del 5/10/2026 habla de una «previsión de modificación… hasta octubre de 2028» para que coincida con la factura electrónica de empresas de ≤ 8 M€. **No hay norma en el BOE** a 12/10/2026, y la Sede sigue mostrando las fechas de 2027. | hacienda.gob.es/sgt/gabsehacienda/nota-informativa-verifactu.pdf |
| Factura electrónica B2B                                 | **Orden HAC/1028/2026** (BOE 5/10/2026, BOE-A-2026-20587), **en vigor desde el 6/10/2026**. Base legal: RD 238/2026. Calendario: 6/10/2027 para empresas de más de 8 M€; 6/10/2028 para el resto.                                                                                | BOE; noticia AEAT del 7/10/2026                                  |
| Especificaciones técnicas de la solución pública (SPFE) | **No publicadas todavía.** Según el seminario AEAT del 10/09/2026: UBL 2.5, modelo EN 16931 extendido con elementos BT-ES/BG-ES, SOAP con sobre ebXML. El grupo **BG-24 «QR FISCAL» (BT-ES-25)** lleva la URL del QR de VERI\*FACTU.                                             | `DIT_FE_Seminario_10_septiembre.pdf`                             |

La relación entre las dos fases es directa: la factura UBL incluye el QR de VERI\*FACTU. Por eso el modelo de datos de esta primera versión tiene que poder alimentar las dos (§3.4).

### 1.2 Versión de la especificación que se implementará

| Documento                                                        | Versión                                                                                                                                      |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Descripción del servicio web (`Veri-Factu_Descripcion_SWeb.pdf`) | **1.0.3**, 28/07/2025                                                                                                                        |
| Validaciones y errores (`Validaciones_Errores_Veri-Factu.pdf`)   | **1.2.2**, 08/04/2026                                                                                                                        |
| Diseño de registro (`DsRegistroVeriFactu.xlsx`)                  | 1.0                                                                                                                                          |
| Especificación de huella                                         | **0.1.2**, 27/08/2024                                                                                                                        |
| QR y servicio de cotejo                                          | **0.5.0**, 10/12/2025                                                                                                                        |
| Firma electrónica de registros                                   | **0.1.5**, 06/03/2025, con el ZIP de ejemplos                                                                                                |
| Servicio de validación NO VERI\*FACTU                            | 0.2, 17/09/2025                                                                                                                              |
| FAQ desarrolladores                                              | 1.3, 04/12/2025                                                                                                                              |
| XSD y WSDL (`tikeV1.0`)                                          | Sin número de versión interno (`IDVersion` = `1.0`). Se identifican por **SHA-256 + Last-Modified** (SuministroInformacion.xsd: 11/01/2026). |
| `errores.properties`                                             | Last-Modified 30/07/2026, 247 códigos                                                                                                        |

### 1.3 Modalidades: qué exige cada una

| Requisito                              | VERI\*FACTU                                                   | NO VERI\*FACTU                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envío a la AEAT                        | Inmediato, servicio `VerifactuSOAP`                           | Solo **por requerimiento**, servicio `RequerimientoSOAP` (`RefRequerimiento` y `FinRequerimiento`)                                                                   |
| Firma XAdES de cada registro           | **No** (opcional)                                             | **Sí.** XAdES Enveloped EPES con la política AGE (OID `2.16.724.1.3.1.1.2.1.9`), RSA-SHA256, C14N inclusiva y firma sobre el nodo `RegistroAlta`/`RegistroAnulacion` |
| Registro de eventos (`EventosSIF.xsd`) | No (sí en un SIF dual cuando funciona en modo NO VERI\*FACTU) | **Sí.** Encadenado, con huella y **firma obligatoria**. No hay servicio web para enviarlo.                                                                           |
| Conservación local                     | Recomendable, no obligatoria                                  | Obligatoria, con detección de anomalías y comprobación del encadenamiento antes de cada registro                                                                     |
| Consulta                               | Sí (`ConsultaFactuSistemaFacturacion`)                        | No                                                                                                                                                                   |
| Subsanación                            | Sí                                                            | No: los registros se envían tal como se generaron                                                                                                                    |
| URL del QR                             | `ValidarQR`                                                   | `ValidarQRNoVerifactu`                                                                                                                                               |
| Leyenda «VERI\*FACTU»                  | Sí                                                            | No                                                                                                                                                                   |

**Propuesta para NO VERI\*FACTU (fase 6):** abordarla cuando la v1 VERI\*FACTU sea estable, por estas razones:

- Añade firma XAdES, eventos y gestión de requerimientos.
- Gran parte de sus obligaciones (conservación, anomalías, eventos) son del SIF, no de una librería.
- Su entrada en vigor es la misma, así que no hay urgencia relativa.

Desde la v1, el diseño la deja preparada:

- el QR ya distingue la modalidad;
- el cliente ya separa los endpoints `Verifactu` y `Requerimiento`;
- los registros tienen un hueco para `ds:Signature`;
- el modelo del sistema informático ya es el que usan los eventos.

### 1.4 Referencias de código estudiadas

**josemmo/Verifactu-PHP v0.3.4** (22/02/2026, MIT). Es la referencia principal.

- Diseño limpio: modelos, registros, enums documentados y validación con violaciones por ruta.
- Huella correcta y cliente con transporte inyectable.
- **Carencias:**
  - no incluye los XSD ni valida contra ellos;
  - no tiene consulta, XAdES ni eventos;
  - las tolerancias se calculan con _floats_ (issue #88);
  - no lee `RegistroDuplicado`;
  - no tiene catálogo de errores;
  - no implementa `RefExterna`, `Tercero`, `Macrodato`, `FacturaSinIdentifDestinatarioArt61d`, `Cupon`, etc.

**pyverifactu**: port parcial y desactualizado.

- Las anulaciones fallan siempre.
- Algunos elementos XML salen fuera del orden del XSD.
- La correspondencia fichero a fichero que anuncia no se cumple: la lógica XML vive en el cliente.

Lección: la correspondencia con PHP hay que **documentarla y vigilarla** (§9); no basta con declararla.

**npm.** El mejor paquete existente es `@waitron/verifactu` 0.2.1 (Apache-2.0, 975 descargas/semana):

- Puro, ESM y con `fetch` inyectado.
- Solo cubre VERI\*FACTU, sin XAdES ni transporte mTLS.

Las demás opciones tienen problemas:

- dependencias nativas: `libxmljs2` en `verifactu-tools` y `@doscientos/verifactu`;
- XML montado con regex: `verifactu-node-lib`;
- XAdES-BES por defecto, que no cumple: `@inoguerols/verifactu`;
- dependencias con CVE: `xml-crypto` 4 y `fast-xml-parser` 4.

**Hueco real en el ecosistema:** ningún paquete reúne a la vez:

- cero dependencias en runtime;
- validación probada contra los XSD oficiales;
- XAdES-EPES conforme;
- un transporte mTLS de producción que gestione los PFX antiguos (RC2-40);
- la correspondencia trazable con Verifactu-PHP.

---

## 2. Decisiones de producto (resueltas con documentación oficial, 12/10/2026)

Cada decisión se recoge también en `docs/SPEC-NOTES.md` con su cita, para que se pueda auditar.

### D1. Espacios en la huella

- **Fuente:** Especificación de huella v0.1.2: los valores deben tener «la misma información contenida en el campo correspondiente del fichero XML, pero **eliminando los espacios al inicio y al final** de cada valor». Verifactu-PHP no hace este recorte. Es un fallo latente de PHP, y en este punto se sigue a la AEAT.
- **Decisión:** el cálculo de la huella **recorta** cada valor, tal como dice la especificación.
- Además, la librería **rechaza** (`error`) espacios al principio o al final en los campos que entran en la huella. Si el XML lleva el valor sin espacios, la AEAT y cualquier otro verificador obtienen siempre la misma huella.
- La lista de caracteres de `NumSerieFactura` sigue Validaciones 1.2.2: ASCII 32–126 **excepto `"` `'` `<` `>` `=`**.

### D2. Decimales en importes

- **Fuente:** Especificación de huella v0.1.2: los valores con uno o dos decimales se consideran «todos igualmente válidos para la generación de la huella». El ejemplo oficial de firma (`ejemploRegistro.xml`) calcula la huella sobre el literal `41.4`.
- **Decisión:** al generar, los importes salen **siempre con 2 decimales** (`/^-?\d{1,12}\.\d{2}$/`). La huella se calcula sobre la misma cadena que va al XML, lo que es válido según la especificación.
- Al **importar o verificar** XML ajeno (por ejemplo `41.4`), se usa el literal tal como venga. Así se reproduce el ejemplo oficial byte a byte.
- Toda la aritmética se hace en **céntimos con `bigint`**, nunca con `number` en coma flotante.

### D3. Severidad de las validaciones

- **Fuente:** Validaciones y errores v1.2.2.
  - `CuotaRepercutida = Base × Tipo / 100 ± 10,00 €` (§15.7) **genera rechazo**. No se aplica si `TipoRectificativa = I` o `TipoFactura` es R2 o R3.
  - `CuotaTotal` (§16) e `ImporteTotal` (§17) fuera de ±10,00 € devuelven «aviso de error (no generará rechazo)». No se aplica con `ClaveRegimen` 03, 05, 06, 08 o 09.
  - F2: la suma no puede superar 3.000 € (+10 €) (§15.8).
- **Decisión:** se aplican **exactamente las reglas y los márgenes de la AEAT**, con dos severidades que reflejan lo que haría la AEAT:
  - `error`: provoca el rechazo del registro o del envío;
  - `admisible`: provoca «Aceptado con errores» e incluye el código AEAT cuando existe.
- **No** se portan las tolerancias de ±0,01/0,02 de Verifactu-PHP. Son más estrictas que la norma y fallarían en casos que la AEAT acepta, como los regímenes excluidos o las rectificativas por diferencias. Es una desviación documentada en `PHP-CORRESPONDENCE.md`.
- `validate()` devuelve todas las violaciones. `assertValid()` lanza `ValidationError` si hay alguna de severidad `error`.
- Cada regla cita el § de Validaciones 1.2.2.

### D4. Nombre del paquete

- **Decisión:** `verifactu-ts`, libre en npm a 12/10/2026. Es descriptivo y sin _scope_, así que no depende de ninguna organización.
- El propietario del repositorio en GitHub solo hace falta para `repository.url` y para Trusted Publishing. Se fijará en la fase de publicación, que requiere tu permiso de todas formas.

### D5. Incluir material de la AEAT en el repositorio

- **Fuente:** Aviso legal de la Sede de la AEAT, «Utilización de la información contenida en la web» (actualizado el 03/02/2022). Permite la reutilización «para usos comerciales y no comerciales», con «reproducción total o parcial, modificación, distribución». Condiciones: citar la fuente, indicar la fecha de última actualización y no desnaturalizar el contenido.
- **Decisión:** se **incluyen** sin modificar los XSD, el WSDL, `errores.properties` y los ejemplos XML oficiales en `spec/aeat/<id>/`. El `manifest.json` indica la fuente (URL), la fecha (Last-Modified o versión del documento) y el SHA-256.
- Los XSD usados en los tests son **copias derivadas**, generadas por script con `schemaLocation` local. Los originales no se tocan.
- Los PDF se enlazan con su versión y su hash, sin incluirlos: así el repositorio pesa menos, y la referencia autorizada sigue siendo la Sede.

### D6. Relación con `@waitron/verifactu`

- **Decisión:** **se sigue con este proyecto.** Ese paquete solo cubre VERI\*FACTU por diseño: no tiene XAdES, ni registro de eventos, ni transporte mTLS. Además usa Apache-2.0 (frente al MIT pedido) y no tiene correspondencia con Verifactu-PHP.
- Se usará como **referencia de calidad**, pero **no se copiará código**: tiene otra licencia y otra base de diseño.

### D7. Codificación de la URL del QR

- **Fuente:** Especificación del QR v0.5.0, §4 y §4.1. Los parámetros se codifican con «URL encoding» en UTF-8. El ejemplo oficial en Java usa `java.net.URLEncoder.encode(param, "UTF-8")`: los espacios pasan a `+`, `&` a `%26` y `/` a `%2F`; no se codifican `*`, `-`, `.` ni `_`.
- **Decisión:** se usa la serialización `application/x-www-form-urlencoded` (`URLSearchParams`). Produce exactamente el mismo conjunto de caracteres que `URLEncoder` y coincide con lo que hace PHP.
- Hay un test de equivalencia con el ejemplo oficial (`12345678&G33` → `12345678%26G33`) y con números de serie que contienen espacios, `/`, `+` y `*`.

---

## 3. Arquitectura

### 3.1 Principios

1. **Núcleo puro, sin E/S y sin dependencias.**
   - Solo usa APIs estándar: `crypto.subtle.digest`, `Intl.DateTimeFormat`, `TextEncoder`, `URLSearchParams`.
   - Funciona en Node ≥ 22, Deno, Bun, navegadores y _workers_.
2. **Cliente de red separado** mediante una interfaz `Transport`. El núcleo nunca toca TLS.
3. **Sin estado.** La librería no guarda la cadena ni la cola. Ofrece tipos y funciones para que el SIF lo haga: «el último registro» es responsabilidad del integrador. El mantenedor de Verifactu-PHP defiende la misma postura.
4. **Datos planos e inmutables, funciones puras.**
   - Se evitan las clases mutables tipo «bolsa de propiedades».
   - Se mantienen los **nombres de campo de Verifactu-PHP** para poder comparar el comportamiento lado a lado.
5. **Generación de XML sin dependencias** y dirigida por el XSD.
   - Hay dos capas: modelo de dominio → «tipos de cable» generados a partir del XSD → serializador genérico.
   - El orden de los elementos sale del XSD, no de código escrito a mano.
   - Si la AEAT cambia un XSD, regenerar provoca **errores de tipos** en el mapeo; no se producen fallos silenciosos.
6. **Parser de respuestas mínimo y endurecido**, escrito a mano.
   - Es _namespace-aware_ y rechaza `<!DOCTYPE>` y entidades no predefinidas.
   - Elimina de raíz las vulnerabilidades de `fast-xml-parser` y `xmldom` (varias CVE en 2026).
   - Las respuestas de la AEAT tienen una forma fija y pequeña.

### 3.2 Estructura de carpetas

```
verifactu-ts/
├─ spec/                                  ← ÚNICO sitio con material de la AEAT
│  ├─ aeat/
│  │  └─ 2026-04-08/                      ← id de la versión de la especificación (fecha de la versión de Validaciones)
│  │     ├─ manifest.json                 ← documentos, versiones, URL, SHA-256, Last-Modified
│  │     ├─ xsd/  (SuministroLR, SuministroInformacion, RespuestaSuministro,
│  │     │        ConsultaLR, RespuestaConsultaLR, EventosSIF,
│  │     │        RespuestaValRegistNoVeriFactu, xmldsig-core-schema)
│  │     ├─ wsdl/SistemaFacturacion.wsdl
│  │     ├─ errores.properties
│  │     └─ examples/                     ← ejemplos oficiales (XML firmado, vectores de huella/QR)
│  └─ current -> aeat/2026-04-08          ← (o fichero `current.json`; los enlaces simbólicos fallan en Windows)
├─ scripts/
│  ├─ fetch-spec.ts                       ← descarga, calcula hashes y compara con el manifiesto
│  ├─ gen-wire-types.ts                   ← XSD → src/xml/generated/*.ts (tipos + orden + enums)
│  └─ gen-error-catalog.ts                ← errores.properties → src/spec/generated/errors.ts
├─ src/
│  ├─ index.ts                            ← exporta el núcleo
│  ├─ spec/
│  │  ├─ version.ts                       ← SPEC_VERSION, namespaces, IDVersion, URL base
│  │  └─ generated/errors.ts              ← catálogo de códigos AEAT (generado)
│  ├─ common/                             ← tipos reutilizables también por UBL (fase 7)
│  │  ├─ amount.ts                        ← Amount (cadena decimal canónica), aritmética en céntimos (bigint)
│  │  ├─ dates.ts                         ← IsoDate, DateTimeWithOffset, formateo dd-mm-aaaa y con offset
│  │  ├─ tax-id.ts                        ← NIF / IDOtro (sin validar el dígito de control; opcional)
│  │  └─ errors.ts                        ← jerarquía de errores tipados
│  ├─ models/                             ← correspondencia con Verifactu-PHP src/Models
│  │  ├─ computer-system.ts               ← ComputerSystem.php
│  │  ├─ invoice-identifier.ts            ← InvoiceIdentifier.php
│  │  ├─ fiscal-identifier.ts             ← FiscalIdentifier.php
│  │  ├─ foreign-fiscal-identifier.ts     ← ForeignFiscalIdentifier.php
│  │  ├─ enums/ (invoice-type, corrective-type, tax-type, regime-type,
│  │  │          operation-type, foreign-id-type, …)
│  │  ├─ records/
│  │  │  ├─ record.ts                     ← Record.php (base común, encadenamiento)
│  │  │  ├─ registration-record.ts        ← RegistrationRecord.php
│  │  │  ├─ cancellation-record.ts        ← CancellationRecord.php
│  │  │  └─ breakdown-details.ts          ← BreakdownDetails.php
│  │  └─ responses/                       ← AeatResponse.php, ResponseItem.php, + query
│  ├─ hash/                               ← huella de alta, anulación y evento
│  ├─ chain/                              ← enlace con el registro anterior, verificación de una cadena
│  ├─ validation/
│  │  ├─ violation.ts                     ← { path, code, severity, message (es), aeatCode? }
│  │  └─ rules/                           ← una regla por fichero, con referencia a Validaciones §x.y
│  ├─ xml/
│  │  ├─ generated/                       ← tipos de cable + metadatos de secuencia (generados, commiteados)
│  │  ├─ writer.ts                        ← serializador genérico + escape
│  │  ├─ reader.ts                        ← tokenizador mínimo endurecido
│  │  ├─ records.ts                       ← dominio ⇄ cable (alta, anulación); también importación desde XML
│  │  └─ soap.ts                          ← sobres de suministro y consulta; lectura de respuestas y faults
│  ├─ qr/
│  │  ├─ url.ts                           ← URL de cotejo (núcleo)
│  │  └─ render/                          ← subpath opcional: matriz/SVG (qrcodegen de Nayuki incluido en el código, MIT)
│  └─ client/                             ← subpath `verifactu-ts/client`
│     ├─ transport.ts                     ← interfaz Transport
│     ├─ endpoints.ts                     ← entorno × tipo de certificado × servicio
│     ├─ aeat-client.ts                   ← send(), query(); sin estado
│     ├─ flow-control.ts                  ← helper TiempoEsperaEnvio / lotes de 1000
│     └─ transports/
│        ├─ node.ts                       ← subpath `verifactu-ts/transport/node` (node:https, mTLS)
│        └─ fetch.ts                      ← fetch propio con TLS ya configurado (Deno/Bun/undici)
├─ test/
│  ├─ unit/ …                             ← refleja src/
│  ├─ vectors/                            ← vectores oficiales AEAT + portados de PHP (JSON)
│  ├─ fixtures/xml/                       ← XML de PHP (MIT, con atribución) + propios
│  ├─ xsd/                                ← validación contra los XSD de spec/current (xmllint-wasm)
│  └─ integration/                        ← contra prewww1/prewww10; desactivados por defecto
├─ docs/
│  ├─ PHP-CORRESPONDENCE.md               ← tabla fichero PHP ↔ fichero TS + commit PHP de referencia
│  └─ SPEC-NOTES.md                       ← ambigüedades y decisiones (D1–D7, …) con cita
├─ MAINTAINING.md · README.md · LICENSE · NOTICE · SECURITY.md · CHANGELOG.md
└─ .github/workflows/ (ci.yml, release.yml)
```

**Paquete único con _subpath exports_, no monorepo.** Exige menos mantenimiento, una sola versión y un solo Trusted Publisher.

| Subpath            | Contenido                   |
| ------------------ | --------------------------- |
| `.`                | núcleo                      |
| `./client`         | cliente SOAP                |
| `./transport/node` | transporte con `node:https` |
| `./qr/render`      | QR en matriz o SVG          |
| `./xades`          | firma (fase 6)              |
| `./testing`        | AEAT simulada               |

Si en el futuro hace falta, se puede dividir sin romper la API.

### 3.3 Dependencias

| Ámbito                                             | Dependencia                                                                                                                                                                                                                                                                                                     | Justificación                                                                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Runtime (núcleo, cliente, transporte Node, QR)** | **Ninguna**                                                                                                                                                                                                                                                                                                     | SHA-256 con Web Crypto; offsets con `Intl`; XML hecho a mano; HTTPS con `node:https`; QR con [qrcodegen de Nayuki](https://github.com/nayuki/QR-Code-generator) (MIT, un fichero TS) **incluido en el código** con atribución. |
| Runtime de `./xades` (fase 6)                      | **Se decide en la fase 6.** La opción preferida es **ninguna**: C14N inclusiva y XAdES-EPES con plantilla, ya que solo firmamos XML generado por nosotros. Cargar PFX necesita un parser PKCS#12; Web Crypto no descifra RC2/3DES. Alternativa: aceptar PEM/PKCS#8 y ofrecer `node-forge` como _peer_ opcional. | Te pediré aprobación antes de añadir cualquier dependencia.                                                                                                                                                                    |
| Dev                                                | `typescript` 6.0.x                                                                                                                                                                                                                                                                                              | TS 7.0 salió en julio, pero `typescript-eslint` aún no lo soporta. Se usa 6.0 en todo y se migra cuando el ecosistema esté listo.                                                                                              |
| Dev                                                | `vitest` 4.1.x, `fast-check`                                                                                                                                                                                                                                                                                    | Tests y propiedades (escape, cadena, importes). Vitest 5 salió hoy, así que se descarta por ahora.                                                                                                                             |
| Dev                                                | `eslint` 10 + `typescript-eslint` (`strictTypeChecked`), `prettier`                                                                                                                                                                                                                                             | Lint.                                                                                                                                                                                                                          |
| Dev                                                | `xmllint-wasm` 5.x                                                                                                                                                                                                                                                                                              | Validación XSD en tests, sin dependencias nativas y con preload de varios ficheros.                                                                                                                                            |
| Dev                                                | `@xmldom/xmldom`                                                                                                                                                                                                                                                                                                | Solo en `scripts/gen-wire-types.ts`, para leer los XSD.                                                                                                                                                                        |
| Dev                                                | `publint`, `@arethetypeswrong/cli`                                                                                                                                                                                                                                                                              | Comprobar que el paquete publicado es correcto.                                                                                                                                                                                |
| Dev                                                | `@changesets/cli`                                                                                                                                                                                                                                                                                               | Versionado y CHANGELOG.                                                                                                                                                                                                        |

Otras condiciones:

- Sin `postinstall` ni scripts de ciclo de vida.
- `"sideEffects": false`.
- ESM-only con `engines.node >= 22.12`. Node 20 está fuera de soporte desde 04/2026 y Node 22.12+ admite `require(esm)`.

### 3.4 Modelo de datos y encaje con UBL

Hay dos capas:

- **`models/records/*`**: fieles a la AEAT y a Verifactu-PHP. Son lo que entra en la huella y en el XML.
- **`common/*`**: tipos de valor neutros (`Amount`, `IsoDate`, `TaxId`, `InvoiceIdentifier`, códigos de impuesto, régimen y calificación). Se reutilizarán tal cual en UBL.

En la fase 7 se añadirá un modelo de dominio `Invoice` (líneas, partes, totales) con dos _adapters_ puros: `invoiceToRegistrationRecord()` e `invoiceToUbl()`. El registro VeriFactu no se rehace, porque es una **proyección** de la factura.

No se introduce ya el `Invoice` completo para no diseñar a ciegas antes de que existan las especificaciones de la SPFE. Sí se reservan los nombres y los tipos comunes.

---

## 4. API pública propuesta

### 4.1 Crear un registro de alta, encadenarlo y calcular la huella

```ts
import {
  createRegistrationRecord,
  validate,
  assertValid,
  toXml,
  InvoiceType,
  TaxType,
  RegimeType,
  OperationType,
  amount,
  type ComputerSystem,
  type ChainLink,
} from 'verifactu-ts';

const system: ComputerSystem = {
  vendorName: 'Mi Empresa de Software SL',
  vendorNif: 'B12345678',
  name: 'MiFactura',
  id: '01',
  version: '1.4.0',
  installationNumber: 'INST-0001',
  onlySupportsVerifactu: true,
  supportsMultipleTaxpayers: false,
  hasMultipleTaxpayers: false,
};

// El SIF persiste el último enlace de la cadena (por obligado tributario / instalación).
const previous: ChainLink | null = await miBaseDeDatos.ultimoEnlace('B87654321');

const record = await createRegistrationRecord({
  invoiceId: { issuerId: 'B87654321', invoiceNumber: 'F2026-0042', issueDate: '2026-10-12' },
  issuerName: 'Cliente Ejemplo SA',
  invoiceType: InvoiceType.Factura, // 'F1'
  description: 'Servicios de consultoría',
  recipients: [{ name: 'Destinatario SL', nif: 'B11111111' }],
  breakdown: [
    {
      taxType: TaxType.IVA,
      regimeType: RegimeType.C01,
      operationType: OperationType.S1,
      taxRate: '21.00',
      baseAmount: amount.fromCents(100_000n),
      taxAmount: '210.00',
    },
  ],
  totalTaxAmount: '210.00',
  totalAmount: '1210.00',
  system,
  previous, // null ⇒ PrimerRegistro = S
  generatedAt: { instant: new Date(), timeZone: 'Europe/Madrid' }, // o '2026-10-12T10:20:30+02:00'
});
// record.hash        → 'A1B2…' (64 hex en mayúsculas)
// record.hashedAt    → '2026-10-12T10:20:30+02:00' (la misma cadena va al XML y a la huella)

const violations = validate(record); // Violation[] con severidad 'error' | 'admisible' (§2 D3)
assertValid(record); // lanza ValidationError si hay algún 'error'

await miBaseDeDatos.guardar(record, { enlace: toChainLink(record) });
```

`createRegistrationRecord` es `async` porque Web Crypto lo es. También existen `calculateHash(record)` y `verifyHash(record)` sueltos, y `verifyChain(records)` para auditar una secuencia.

### 4.2 Anulación y subsanación

```ts
import { createCancellationRecord, createRegistrationRecord } from 'verifactu-ts';

const anulacion = await createCancellationRecord({
  invoiceId: { issuerId: 'B87654321', invoiceNumber: 'F2026-0042', issueDate: '2026-10-12' },
  system,
  previous: ultimoEnlace,
  generatedAt: ahora,
  // withoutPriorRecord: true   → SinRegistroPrevio = S
  // isPriorRejection: true     → RechazoPrevio = S
});

// Subsanación de un alta aceptada con errores
const subsanacion = await createRegistrationRecord({
  ...datos,
  isCorrection: true,
  previous: ultimoEnlace,
  generatedAt: ahora,
});
// Alta tras rechazo: { isCorrection: true, isPriorRejection: 'X' }
```

`isPriorRejection` en el alta es `'N' | 'S' | 'X'`, explícito, en lugar del `null → X` de PHP. Es una desviación documentada en `PHP-CORRESPONDENCE.md`.

### 4.3 QR

```ts
import { qrUrl } from 'verifactu-ts';
import { renderQrSvg } from 'verifactu-ts/qr/render';

const url = qrUrl(record, { environment: 'production', mode: 'verifactu' });
// https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=B87654321&numserie=F2026-0042&fecha=12-10-2026&importe=1210.00

const svg = renderQrSvg(url); // corrección de errores M (obligatoria), zona de silencio incluida
// Se recuerda en el JSDoc lo que se debe imprimir: «QR tributario:» encima y «VERI*FACTU» debajo, de 30 a 40 mm.
```

La URL se codifica igual que `java.net.URLEncoder` del ejemplo oficial (§2 D7): espacio → `+`, `&` → `%26`, `/` → `%2F`.

### 4.4 Envío y consulta

```ts
import { AeatClient } from 'verifactu-ts/client';
import { nodeTransport } from 'verifactu-ts/transport/node';

const client = new AeatClient({
  transport: nodeTransport({ pfx: await readFile('cert.p12'), passphrase: process.env.CERT_PASS }),
  environment: 'test', // 'test' | 'production'  (obligatorio, sin valor por defecto)
  certificateType: 'personal', // 'personal' | 'seal' (www1 vs www10); explícito, sin heurísticas
  system,
  taxpayer: { name: 'Cliente Ejemplo SA', nif: 'B87654321' },
  // representative?, voluntaryRemission?: { endDate, incident }, requirement?: { reference, isLast }
});

const res = await client.send([record, anulacion]); // ≤ 1000 registros; si hay más, error tipado
res.status; // 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto'
res.csv; // guardarlo: la AEAT no lo devuelve otra vez
res.waitSeconds; // TiempoEsperaEnvio → helper nextSendAllowedAt(res)
for (const item of res.items) {
  item.status; // 'Correcto' | 'AceptadoConErrores' | 'Incorrecto'
  item.error?.code; // 2000, 3000, …  item.error.kind: 'admisible' | 'rechazo-registro'
  item.duplicate; // RegistroDuplicado, si viene
}

// Consulta con paginación automática (ClavePaginacion estructurada)
for await (const r of client.query({
  period: { year: 2026, month: 10 },
  invoiceNumber: 'F2026-0042',
})) {
  r.status; // 'Correcto' | 'AceptadoConErrores' | 'Anulado'
}
```

**Errores tipados.** Todos heredan de `VerifactuError` y llevan `code` estable y `message` en español.

| Error              | Cuándo se lanza                                  | Detalle                                                                                                         |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `ValidationError`  | el registro no es válido                         | `.violations`                                                                                                   |
| `XmlError`         | XML de respuesta mal formado o inesperado        |                                                                                                                 |
| `SoapFaultError`   | la AEAT rechaza el envío entero                  | `faultCode` (Client/Server), código AEAT extraído de `Codigo[4104]`, `retryable`                                |
| `TransportError`   | fallo de red, HTTP o HTML inesperado (401, etc.) |                                                                                                                 |
| `CertificateError` | problema con el certificado                      | si el PFX usa RC2-40, explica cómo convertirlo con `openssl pkcs12 -legacy …` o con `--openssl-legacy-provider` |
| `BatchLimitError`  | más de 1000 registros en un envío                |                                                                                                                 |

---

## 5. Estrategia de tests

| Nivel                  | Qué                                                                                                                                                                                                                                                                                                                                               | Cómo                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Vectores de huella     | Los 3 ejemplos oficiales (alta, alta encadenada, anulación) y el R3 derivado del ejemplo de firma (`41.4`). Además, los 5 vectores de PHP.                                                                                                                                                                                                        | JSON en `test/vectors/`, recalculados de forma independiente (ya los he comprobado con `shasum`).                              |
| Encadenamiento         | Primer registro; cadena alta→alta→anulación; subsanaciones encadenadas; `verifyChain` detecta roturas y reordenaciones.                                                                                                                                                                                                                           | Unitarios y propiedades con fast-check.                                                                                        |
| QR                     | 3 URL de PHP, 4 oficiales, `numserie` con `&`, `/`, espacios y `+`.                                                                                                                                                                                                                                                                               | Unitarios. Golden de la matriz QR.                                                                                             |
| XML contra XSD         | Cada fixture y cada caso generado se valida contra `spec/current/xsd`.                                                                                                                                                                                                                                                                            | `xmllint-wasm` con los `schemaLocation` reescritos a ficheros locales. Contraste con `xmllint` del sistema en CI.              |
| Ida y vuelta           | export → import → export idéntico. Fixtures de PHP.                                                                                                                                                                                                                                                                                               | Unitarios.                                                                                                                     |
| Matriz de casos límite | F1, F2 (sin destinatario, ≤ 3000 €), F3 con sustituidas, R1–R4 (S/I), R5; IVA, IGIC e IPSI; regímenes 01–20; recargo de equivalencia (C18); exentas E1–E6; no sujetas N1/N2; destinatario extranjero (IDOtro 02–07); importes negativos; subsanación y rechazo previo (combinaciones del anexo 6 de Validaciones); anulación sin registro previo. | Tabla parametrizada: cada caso valida contra XSD, comprueba la huella y las violaciones esperadas.                             |
| Validación             | Cada regla con un caso positivo y uno negativo, que referencia el § de Validaciones 1.2.2 y el código AEAT.                                                                                                                                                                                                                                       | Unitarios.                                                                                                                     |
| Lectura de respuestas  | Correcto, ParcialmenteCorrecto con 2000/3000, Incorrecto sin CSV, RegistroDuplicado, SOAP Fault Client y Server, HTML 401, XML con DOCTYPE (se rechaza), consulta paginada.                                                                                                                                                                       | Fixtures. Se sustituirán por respuestas reales capturadas en pruebas, anonimizadas.                                            |
| Cliente                | Endpoints por entorno y certificado, cabeceras, límite de 1000, `retryable`.                                                                                                                                                                                                                                                                      | Transporte simulado (`verifactu-ts/testing`).                                                                                  |
| PFX                    | Moderno, 3DES y RC2-40 (error con instrucciones).                                                                                                                                                                                                                                                                                                 | Certificados autofirmados generados con `openssl` en el test; nunca certificados reales.                                       |
| Runtimes               | El núcleo funciona en Deno y Bun.                                                                                                                                                                                                                                                                                                                 | Smoke test en CI.                                                                                                              |
| Integración            | Alta, subsanación, anulación y consulta contra `prewww1`/`prewww10`.                                                                                                                                                                                                                                                                              | `test/integration`, solo con `VERIFACTU_IT_PFX` y `VERIFACTU_IT_PASS`; script `npm run test:integration`; nunca en CI pública. |
| Tests de PHP portados  | Todos los de `tests/` que tengan sentido, con la referencia al test original en el nombre.                                                                                                                                                                                                                                                        | Atribución en `NOTICE`.                                                                                                        |

Cobertura objetivo: más del 95 % de líneas en `hash`, `chain`, `xml` y `validation`. Se puede valorar _mutation testing_ (Stryker) en una fase posterior.

---

## 6. Mantenibilidad (cambios de la especificación)

- **Un solo sitio:** `spec/aeat/<id>/`, con `manifest.json` (documento, versión, URL, SHA-256, Last-Modified) y `src/spec/version.ts`, que expone `SPEC_VERSION` en la API para que el integrador sepa con qué versión trabaja.
- **`scripts/fetch-spec.ts`:** descarga los XSD, el WSDL y `errores.properties` y los compara por hash con el manifiesto. Un workflow semanal en CI abre una _issue_ si cambian.
- **`scripts/gen-wire-types.ts`:** genera los tipos y el orden de secuencia desde los XSD. Se commitea la salida y un test comprueba que regenerar no produce diferencias.
- **`scripts/gen-error-catalog.ts`:** convierte `errores.properties` (ISO-8859-1) en un catálogo tipado.
- **`MAINTAINING.md`:** procedimiento paso a paso. Nueva carpeta de versión → regenerar → corregir errores de tipos → revisar el changelog de los PDF → actualizar reglas y `SPEC-NOTES.md` → ejecutar integración en pruebas → changeset.
- **`docs/PHP-CORRESPONDENCE.md`:**
  - tabla de cada fichero PHP con su fichero TS y el commit PHP de referencia (`0fd9d89`, v0.3.4);
  - desviaciones deliberadas;
  - un script compara los ficheros que han cambiado en upstream desde ese commit.

---

## 7. Fases

Cada fase va en commits pequeños, con tests en verde y CI pasando.

| Fase                                                                 | Contenido                                                                                                                                                                                                                                                       | Criterio de salida                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **0. Esqueleto**                                                     | `git init`, `package.json` (ESM, exports, engines, sin scripts de instalación), TS estricto, ESLint/Prettier, Vitest, CI (typecheck, lint, test y build en Node 22/24/26), LICENSE MIT + NOTICE, `spec/` con manifiesto y XSD, README mínimo con el aviso legal | CI en verde                                                                                                                       |
| **1. Núcleo**                                                        | `Amount`, fechas con offset, enums, modelos, huella (alta y anulación), encadenamiento, `verifyChain`, URL del QR                                                                                                                                               | Todos los vectores oficiales y de PHP pasan                                                                                       |
| **2. XML**                                                           | Generador de tipos desde XSD, serializador, mapeo alta/anulación, sobre de suministro, importación desde XML                                                                                                                                                    | Fixtures de PHP y casos generados validan contra XSD; ida y vuelta idéntico                                                       |
| **3. Validación**                                                    | Reglas de campo y de negocio (Validaciones 1.2.2) con severidades; matriz de casos límite                                                                                                                                                                       | Matriz completa en verde                                                                                                          |
| **4. Cliente**                                                       | `Transport`, transporte Node (PFX/PEM, diagnóstico RC2), lectura de respuestas y faults, catálogo de errores, consulta paginada, helper de control de flujo, `./testing`                                                                                        | Tests con transporte simulado; **integración real en el entorno de pruebas** (con tu certificado)                                 |
| **5. QR render + docs**                                              | qrcodegen incluido en el código, SVG; README completo (ES/EN), `MAINTAINING.md`, `SECURITY.md`, ejemplos ejecutables; workflow `release.yml` preparado **sin publicar**                                                                                         | Revisión tuya → **v0.1.0** (publicar solo con tu permiso explícito)                                                               |
| **6. NO VERI\*FACTU**                                                | `./xades` (C14N inclusiva + XAdES-EPES; golden contra el ejemplo de la AEAT), registro de eventos (modelo, huella, firma, XSD), endpoint `RequerimientoSOAP`, servicio de validación NoVF de pruebas                                                            | Validación XSD; firma verificada con una herramienta externa (p. ej. `xmlsec1`/VALIDe); aceptación en el servicio NoVF de pruebas |
| **7. UBL / EN 16931** (cuando la AEAT publique las especificaciones) | Modelo `Invoice`, adaptadores a registro VeriFactu y a UBL 2.5 con extensiones ES, cliente SPFE                                                                                                                                                                 | Por definir                                                                                                                       |

---

## 8. Riesgos

| Riesgo                                                                                                                        | Impacto       | Mitigación                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cambio normativo (aplazamiento a 2028, convergencia con ViDA «en aspectos técnicos»)                                          | Alto          | Versionado por especificación; las reglas dependientes de fecha (p. ej. `FechaFinVeriFactu` a partir de 1/1/2027) se aíslan y parametrizan; vigilancia semanal de los XSD        |
| Ambigüedades de la especificación (D1–D3, tolerancia horaria de `FechaHoraHusoGen` sin publicar, ~240 s medidos por terceros) | Medio         | `SPEC-NOTES.md` con cada decisión y su cita; contraste en el entorno de pruebas; ante una contradicción con PHP prevalece la documentación oficial, y la desviación se documenta |
| Correcciones de XSD sin aviso ni versión interna                                                                              | Medio         | Hash en el manifiesto y alerta en CI                                                                                                                                             |
| PFX antiguos (RC2-40, habituales en exportaciones de FNMT y Windows)                                                          | Medio         | Diagnóstico claro y guía de conversión; conversor opcional en el futuro                                                                                                          |
| Firma XAdES hecha a mano: es fácil equivocarse en la canonicalización                                                         | Alto (fase 6) | Firmar solo XML propio en forma canónica controlada; golden contra el ejemplo de la AEAT; verificación con herramientas externas                                                 |
| Sin acceso al entorno de pruebas (necesita certificado)                                                                       | Medio         | Te pediré un certificado de pruebas en la fase 4; hasta entonces, fixtures de la documentación                                                                                   |
| Responsabilidad legal                                                                                                         | —             | Aviso visible: no es un SIF ni lleva declaración responsable; el integrador audita y responde                                                                                    |
| Mantenimiento: un solo mantenedor                                                                                             | Medio         | Alcance acotado, generación desde XSD, documentación de mantenimiento                                                                                                            |
| Ecosistema TS en transición (TS 7, Vitest 5, ESLint 10)                                                                       | Bajo          | Versiones conservadoras fijadas y Renovate/Dependabot                                                                                                                            |

---

## 9. Licencia y atribución

- MIT. Copyright del proyecto.
- `NOTICE` con atribución a **Verifactu-PHP** (© 2025-present José M. Moreno, MIT) por la lógica y los tests portados, y a **qrcodegen** (© Project Nayuki, MIT).
- Cabecera `// Port de josemmo/Verifactu-PHP src/… (MIT)` en los ficheros portados.
- Material de la AEAT: fuente y fecha en el manifiesto.

## 10. Publicación (preparada, no ejecutada)

- `release.yml`: `permissions: id-token: write`; Node 24 (npm ≥ 11.5.1); `npm ci` sin caché; build; test; `publint` y `attw --profile esm-only`; `npm publish` mediante Changesets. Provenance automática por ser repositorio público.
- **El paquete debe existir antes de configurar el Trusted Publisher.** Opciones:
  - primera publicación manual por tu parte (con 2FA);
  - o `npm trust github …`.
- Después: «Require 2FA and disallow tokens».
- **Todo esto lo haré solo con tu permiso explícito**, como pediste.

---

## Próximo paso

Con tu visto bueno al plan empiezo la **fase 0** (esqueleto, CI y `spec/`).
