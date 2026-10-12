// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import type { CabeceraType, RegistroFacturacionAltaType, RegistroFacturacionAnulacionType } from './suministro-informacion.ts';

/** Namespace: https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd */

export interface RegFactuSistemaFacturacionType {
  readonly Cabecera: CabeceraType;
  readonly RegistroFactura: readonly RegistroFacturaType[];
}

/** Datos correspondientes a los registros de facturacion */
export type RegistroFacturaType = ({
    readonly RegistroAlta: RegistroFacturacionAltaType;
    readonly RegistroAnulacion?: never;
  } | {
    readonly RegistroAnulacion: RegistroFacturacionAnulacionType;
    readonly RegistroAlta?: never;
  });

