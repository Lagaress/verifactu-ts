# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según
[SemVer](https://semver.org/lang/es/). Cada versión indica la especificación de la AEAT soportada.

## [Sin publicar]

### Añadido

- Primera versión. Especificación AEAT: instantánea `2026-10-12` (Validaciones v1.2.2, servicio
  web v1.0.3, huella v0.1.2, QR v0.5.0).
- Registros de alta y anulación, huella SHA-256 y encadenamiento (`verifyChain`).
- Validación de formato y de las reglas de negocio de la AEAT con severidad `error`/`admisible`.
- XML generado y leído a partir de los XSD oficiales.
- URL del QR de cotejo y QR en SVG (`verifactu-ts/qr/render`).
- Cliente SOAP (`verifactu-ts/client`): envío, consulta paginada, errores tipados.
- Transportes `node:https` (`verifactu-ts/transport/node`) y `fetch` (Deno, Bun, undici).
- AEAT simulada para tests (`verifactu-ts/testing`).
- Catálogo de errores de la AEAT (`verifactu-ts/errors`).
- Experimental: firma XAdES-EPES de registros y registros de evento (`verifactu-ts/no-verifactu`).
