# Correspondencia con Verifactu-PHP

Referencia: [josemmo/Verifactu-PHP](https://github.com/josemmo/Verifactu-PHP) **v0.3.4**, commit
`0fd9d89fa89f0d331434f39f9ffcd8ab8555e7d9` (22/02/2026), licencia MIT.

Para revisar cambios de upstream desde esa referencia:

```sh
git clone https://github.com/josemmo/Verifactu-PHP && cd Verifactu-PHP
git diff --stat 0fd9d89fa89f0d331434f39f9ffcd8ab8555e7d9..HEAD -- src tests
```

## Ficheros

| Verifactu-PHP                                    | verifactu-ts                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `src/Models/Model.php`                           | `src/validation/validate.ts`, `src/validation/collector.ts`                          |
| `src/Models/ComputerSystem.php`                  | `src/models/computer-system.ts`                                                      |
| `src/Models/Records/Record.php`                  | `src/models/records.ts` (`RecordBase`), `src/hash/hash.ts`                           |
| `src/Models/Records/RegistrationRecord.php`      | `src/models/records.ts`, `src/records/create.ts`, `src/validation/rules/business.ts` |
| `src/Models/Records/CancellationRecord.php`      | ídem                                                                                 |
| `src/Models/Records/BreakdownDetails.php`        | `src/models/records.ts` (`BreakdownDetails`), reglas en `business.ts`                |
| `src/Models/Records/InvoiceIdentifier.php`       | `src/models/identifiers.ts`                                                          |
| `src/Models/Records/FiscalIdentifier.php`        | `src/models/identifiers.ts`                                                          |
| `src/Models/Records/ForeignFiscalIdentifier.php` | `src/models/identifiers.ts`, reglas en `business.ts`                                 |
| `src/Models/Records/*Type.php` (enums)           | `src/models/enums.ts`                                                                |
| `export()` / `fromXml()` de los modelos          | `src/xml/records.ts`                                                                 |
| `src/Models/Responses/*`                         | `src/client/responses.ts`                                                            |
| `src/Services/AeatClient.php`                    | `src/client/aeat-client.ts`                                                          |
| `src/Services/QrGenerator.php`                   | `src/qr/url.ts`                                                                      |
| `src/Exceptions/*`                               | `src/common/errors.ts`, `src/client/errors.ts`                                       |
| `tests/Models/Records/*Test.php`                 | `test/unit/hash.test.ts`, `test/unit/validation/*`, `test/unit/xml/*`                |
| `tests/Services/QrGeneratorTest.php`             | `test/unit/qr.test.ts`                                                               |
| `tests/Models/**/*.xml`                          | `test/fixtures/xml/php/` (copiados sin cambios)                                      |

## Desviaciones deliberadas

| Tema                   | Verifactu-PHP                        | verifactu-ts                                                                                                                                                                | Motivo                                                      |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Estilo                 | Clases mutables + `validate()`       | Objetos inmutables + funciones (`createRegistrationRecord`, `validateRecord`)                                                                                               | Idiomático en TS; la huella siempre corresponde a los datos |
| Recorte en la huella   | No recorta                           | Recorta y valida                                                                                                                                                            | Especificación de huella v0.1.2 (SPEC-NOTES D1)             |
| Tolerancias            | ±0,01/0,02 €                         | ±10,00 € según la AEAT, con severidades                                                                                                                                     | Validaciones v1.2.2 §15.7, §16 y §17 (D3)                   |
| Clave 18 / recargo     | Obligatorio con 18, prohibido sin 18 | Sin restricción                                                                                                                                                             | Regla retirada por la AEAT (v1.0.7, v1.1.2)                 |
| Anulación sin anterior | Prohibida                            | Permitida                                                                                                                                                                   | El XSD lo admite; no hay regla de negocio                   |
| `RechazoPrevio`        | `?bool` (`null` = X)                 | `priorRejection?: 'N' \| 'S' \| 'X'`                                                                                                                                        | Explícito                                                   |
| Fechas                 | `DateTimeImmutable`                  | `IsoDate` (`AAAA-MM-DD`) y `DateTimeWithOffset`                                                                                                                             | Sin ambigüedad de zona horaria                              |
| Validación             | Symfony Validator                    | Reglas propias con código AEAT y referencia                                                                                                                                 | Sin dependencias; trazabilidad                              |
| Campos adicionales     | —                                    | `RefExterna`, `Tercero`, `Macrodato`, `Cupon`, `BaseImponibleACoste`, `GeneradoPor`/`Generador`, acuerdos de facturación, `IDOtro` del productor, `CuotaRecargoRectificado` | Cobertura completa del XSD                                  |
| Enums                  | Sin E7/E8 ni régimen 21              | Incluidos                                                                                                                                                                   | XSD vigente                                                 |
| Consulta               | No                                   | `AeatClient.query()`                                                                                                                                                        | Requisito del proyecto                                      |
| Certificados           | Ruta a fichero `.p12`                | `Buffer` PFX o PEM; diagnóstico de PFX antiguos                                                                                                                             | Robustez                                                    |
