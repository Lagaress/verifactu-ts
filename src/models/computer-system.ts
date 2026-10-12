import type { ForeignIdType } from './enums.ts';

/**
 * Sistema informático de facturación que genera los registros (`SistemaInformatico`).
 *
 * Port de ComputerSystem.php (josemmo/Verifactu-PHP, MIT). Amplía PHP permitiendo identificar al
 * productor con `IDOtro` (productores sin NIF español), como admite el XSD: hay que informar
 * exactamente uno de `vendorNif` o `vendorForeignId`.
 */
export interface ComputerSystem {
  /** Nombre o razón social del productor (`NombreRazon`), hasta 120 caracteres. */
  readonly vendorName: string;
  /** NIF del productor del sistema. */
  readonly vendorNif?: string;
  /** Identificación del productor sin NIF español (`IDOtro`). */
  readonly vendorForeignId?: {
    readonly country?: string;
    readonly type: ForeignIdType;
    readonly value: string;
  };
  /** Nombre del sistema informático (`NombreSistemaInformatico`), hasta 30 caracteres. */
  readonly name: string;
  /** Código identificador del sistema asignado por el productor (`IdSistemaInformatico`), hasta 2 caracteres. */
  readonly id: string;
  /** Versión del sistema (`Version`), hasta 50 caracteres. */
  readonly version: string;
  /** Número de instalación (`NumeroInstalacion`), hasta 100 caracteres. */
  readonly installationNumber: string;
  /** El sistema solo puede funcionar como VERI*FACTU (`TipoUsoPosibleSoloVerifactu`). */
  readonly onlySupportsVerifactu: boolean;
  /** El sistema permite llevar varios obligados tributarios (`TipoUsoPosibleMultiOT`). */
  readonly supportsMultipleTaxpayers: boolean;
  /** La instalación se usa para varios obligados tributarios (`IndicadorMultiplesOT`). */
  readonly hasMultipleTaxpayers: boolean;
}
