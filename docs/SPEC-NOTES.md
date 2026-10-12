# Notas sobre la especificación

Decisiones tomadas donde la documentación de la AEAT es ambigua, se contradice o difiere de
Verifactu-PHP. Cada entrada cita la fuente. Versión de referencia: instantánea
`spec/aeat/2026-10-12` (ver `src/spec/version.ts`).

Criterio general: **prevalece la documentación oficial de la AEAT**. Cuando difiere de
Verifactu-PHP, se sigue a la AEAT y se anota en [PHP-CORRESPONDENCE.md](./PHP-CORRESPONDENCE.md).

## D1. Espacios en los valores de la huella

- **Fuente:** Especificación de huella v0.1.2: los valores deben tener «la misma información
  contenida en el campo correspondiente del fichero XML, pero eliminando los espacios al inicio y
  al final de cada valor».
- **Verifactu-PHP:** no recorta.
- **Decisión:** el cálculo recorta (`String.prototype.trim`) cada valor. Además, la validación
  rechaza espacios iniciales o finales en `NumSerieFactura` (regla `format.surrounding-spaces`), de
  modo que el XML y la huella coinciden sin depender de cómo recorte cada verificador.

## D2. Decimales de los importes

- **Fuente:** Especificación de huella v0.1.2: los valores con uno o dos decimales se consideran
  «todos igualmente válidos para la generación de la huella». El ejemplo oficial de firma
  (`spec/aeat/2026-10-12/examples/ejemploRegistro.xml`) calcula la huella sobre el literal `41.4`.
- **Decisión:** `createRegistrationRecord` normaliza importes y tipos a 2 decimales y calcula la
  huella sobre la misma cadena que va al XML. `recordFromXml` conserva los literales originales
  para reproducir huellas de XML ajeno byte a byte. Aritmética en céntimos con `bigint`.

## D3. Tolerancias y severidades

- **Fuente:** Validaciones y errores v1.2.2:
  - §15.7: `CuotaRepercutida = Base × Tipo / 100 ± 10,00 €`. Fuera de margen, rechazo (1142/1144).
  - §16 y §17: `CuotaTotal` e `ImporteTotal` fuera de ±10,00 €, «aviso de error (no generará
    rechazo)» (2006/2005). No se comprueban con claves de régimen 03, 05, 06, 08 o 09.
- **Verifactu-PHP:** exige ±0,01/0,02 € y rechaza.
- **Decisión:** se aplican los márgenes oficiales con severidad `error` o `admisible` según lo que
  haría la AEAT.

## D7. Codificación de la URL del QR

- **Fuente:** QR v0.5.0 §4 y §4.1. El ejemplo Java usa `java.net.URLEncoder.encode(param, "UTF-8")`.
- **Decisión:** `URLSearchParams` (`application/x-www-form-urlencoded`), que produce el mismo
  conjunto de caracteres: espacio → `+`, `&` → `%26`, `/` → `%2F`; `*`, `-`, `.` y `_` sin codificar.

## Reglas retiradas por la AEAT que Verifactu-PHP mantiene

- **Clave de régimen 18 y recargo de equivalencia.** PHP exige recargo con la clave 18 y lo prohíbe
  con las demás. La AEAT añadió esa validación en la v1.0.3 y la **eliminó** en la v1.0.7 (26/05/2025:
  «Eliminación … de la restricción de uso de la clave de régimen 18 para informar datos sobre el
  recargo de equivalencia») y en la v1.1.2 («Se elimina sección 15.6.9 ClaveRegimen 18 con
  validación obsoleta»). No se implementa.
- **Emisor y destinatario con el mismo NIF.** La v1.0.3 de Validaciones «elimina validación de NIFs
  iguales entre emisor y destinatario (Facturas de autoconsumo)», aunque el código 1193 del catálogo
  la siga mencionando. No se implementa.

## Ambigüedades resueltas

- **§3.1.3.1 y §3.1.3.7 (claves 14/15).** La expedición anterior a la operación, o una operación
  futura, solo se admiten «si ClaveRegimen = 14 o 15». Con desgloses mixtos, se admite si al menos
  una línea de IVA o IGIC tiene clave 14 o 15 (interpretación permisiva; la AEAT es quien decide).
- **§3.1.3.7 FechaOperacion máxima.** «No debe ser superior al año siguiente de la fecha actual»
  se interpreta como `≤ 31/12` del año siguiente.
- **Anulación como primer registro.** El XSD admite `PrimerRegistro` en una anulación y no hay regla
  de negocio que lo impida (PHP sí lo impide). No se valida; la AEAT podría devolver el admisible 2007.
- **IPSI con claves no admitidas (§15.6).** Aviso hasta el 31/12/2026 y rechazo desde el 01/01/2027:
  la severidad depende de `ValidationContext.today`.
- **NIF-IVA (nota 1).** El `ID` incluye el prefijo de país; para Grecia el prefijo es `EL` aunque el
  `CodigoPais` sea `GR`. Reglas del Brexit para `GB`/`XI` según la fecha de operación.
- **Tolerancia horaria de `FechaHoraHusoGenRegistro` (error 2004).** No está publicada. Hay terceros
  que la miden en ~240 s, pero no se valida en la librería; genera el registro en el momento real
  de su creación.

## Pendiente de contrastar en el entorno de pruebas

- Que el servicio de cotejo acepte `+` como espacio en `numserie` (D7).
- Mensajes reales de SOAP Fault y de `RegistroDuplicado` (los fixtures actuales siguen el XSD).
