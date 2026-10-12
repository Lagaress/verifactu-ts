# Seguridad

## Comunicar una vulnerabilidad

No abras una _issue_ pública. Usa el aviso privado de seguridad de GitHub
(_Security → Report a vulnerability_) en https://github.com/Lagaress/verifactu-ts.

## Medidas de la librería

- **Sin dependencias en runtime** ni scripts de instalación.
- **Lector XML propio y endurecido**: rechaza `DOCTYPE` y entidades distintas de las cinco
  predefinidas, lo que evita XXE y la expansión de entidades. Además limita la profundidad de
  anidamiento y el tamaño de la entrada.
- **Certificados en memoria**: `nodeTransport` no escribe nunca claves privadas en disco.
- **Publicación con provenance** desde GitHub Actions mediante Trusted Publishing (OIDC).

## Recomendaciones para integradores

- Guarda los certificados y sus contraseñas en un gestor de secretos, no en el repositorio.
- Usa `environment: 'test'` hasta haber validado la integración en el entorno de pruebas de la AEAT.
- Conserva el CSV y el XML de cada respuesta (`rawXml`) como prueba de la remisión.
