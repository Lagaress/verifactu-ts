# Mantenimiento

La AEAT publica cambios en esquemas, validaciones y especificaciones varias veces al año. Todo el
material oficial está en **un único sitio**, `spec/aeat/<id>/`, y la versión activa la indica
`spec/current.json`.

## Detectar cambios

El workflow semanal `.github/workflows/spec-watch.yml` ejecuta `npm run spec:check`. Este script
descarga los ficheros de la AEAT y los compara por SHA-256 con el `manifest.json` vigente. Si hay
diferencias, abre una _issue_. Se puede ejecutar a mano en cualquier momento:

```sh
npm run spec:check
```

## Actualizar a una nueva versión

1. **Descargar una instantánea nueva**, con la fecha de hoy como identificador:
   ```sh
   node --experimental-strip-types scripts/fetch-spec.ts AAAA-MM-DD
   ```
   Si la AEAT ha publicado nuevas versiones de documentos (PDF), actualiza antes la lista
   `DOCUMENTS` del script (versión y fecha). Copia también los ejemplos oficiales a
   `spec/aeat/<id>/examples/` si han cambiado.
2. **Activarla:** edita `spec/current.json` y `SPEC_VERSION` en `src/spec/version.ts`.
3. **Regenerar el código derivado:**
   ```sh
   npm run gen        # tipos y metadatos desde los XSD + catálogo de errores
   npm run typecheck  # un cambio de XSD se traduce en errores de tipos en src/xml/records.ts
   ```
   Corrige el mapeo (`src/xml/records.ts`, `src/xml/soap.ts`, `src/client/*`) hasta que compile.
   Si aparecen campos nuevos, añádelos a los modelos de `src/models/` con su documentación.
4. **Revisar los cambios en las reglas.** Lee el control de versiones del documento «Validaciones
   y errores» y actualiza `src/validation/rules/business.ts`. Cada regla cita su sección (`§`) y su
   código de error AEAT. Añade casos en `test/unit/validation/`.
5. **Revisar el resto de especificaciones** (huella, QR, servicio web, firma) y anotar en
   `docs/SPEC-NOTES.md` cualquier ambigüedad nueva con su decisión y su cita.
6. **Comprobar:**
   ```sh
   npm run ci
   npm run test:integration   # con certificado, contra el entorno de pruebas de la AEAT
   ```
7. **Publicar** una versión _minor_ (o _major_ si cambia la API pública), detallando en
   `CHANGELOG.md` la versión de la especificación.

Las instantáneas antiguas se pueden borrar cuando ya no se usen; el historial de git las conserva.

## Seguir a Verifactu-PHP

La referencia de diseño es Verifactu-PHP v0.3.4 (commit `0fd9d89`). Para revisar qué ha cambiado
en upstream, sigue las instrucciones de [docs/PHP-CORRESPONDENCE.md](./docs/PHP-CORRESPONDENCE.md).
Si portas un cambio, actualiza el commit de referencia y la tabla de correspondencia. Si la
documentación oficial contradice a PHP, prevalece la AEAT y se documenta la desviación.

## Tamaño

`npm run size` mide lo que la librería añade al bundle de quien la usa y falla si se supera el
presupuesto. Si una funcionalidad nueva lo supera, valora llevarla a un subpath opcional antes de
subir el presupuesto.

## Publicación

La publicación se hace desde GitHub Actions con Trusted Publishing (OIDC) y provenance; ver
`.github/workflows/release.yml`. Nunca se usan tokens de npm de larga duración.
