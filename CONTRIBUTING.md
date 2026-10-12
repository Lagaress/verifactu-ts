# Contribuir

¡Gracias por tu interés! Las _issues_ y los _pull requests_ son bienvenidos.

## Antes de empezar

- Para cambios grandes, abre antes una _issue_ para comentarlo.
- La referencia es la documentación oficial de la AEAT. Si un cambio afecta a cómo se interpreta
  la especificación, cita el documento y la sección, y anótalo en `docs/SPEC-NOTES.md`.
- Mantén la librería **sin dependencias en runtime**. `npm run size` comprueba los presupuestos
  de tamaño.

## Desarrollo

```sh
npm ci
npm run ci   # typecheck, lint, formato, generados al día, tests, paquete y tamaño
```

- Cada regla de validación debe llevar un test positivo y uno negativo, con su código AEAT.
- El XML que genere la librería debe validar contra los XSD de `spec/` (ver `test/xsd/xsd.ts`).
- Los ficheros de `src/xml/generated/` y `src/spec/generated/` se regeneran con `npm run gen`.
  No se editan a mano.
- Mensajes de error y documentación en español.

## Actualizar la especificación

Sigue [MAINTAINING.md](./MAINTAINING.md).
