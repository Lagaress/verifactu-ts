// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import type { IDFacturaExpedidaType, OperacionType, TextMax1500Type, TextMax60Type } from './suministro-informacion.ts';

/** Namespace: https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaValRegistNoVeriFactu.xsd */

export type RespuestaValContenidoFactuSistemaFacturacionType = ({
    /** Error a nivel de formato XML */
    readonly DescripcionErrorFormatoXML: TextMax1500Type;
    readonly RespuestaValidacion?: never;
  } | {
    /** Resultado de la validación si el formato del XML es correcto */
    readonly RespuestaValidacion: RespuestaRegType;
    readonly DescripcionErrorFormatoXML?: never;
  });

/** Respuesta a un envío */
export interface RespuestaRegType {
  /** ID Factura Expedida */
  readonly IDFactura: IDFacturaExpedidaType;
  readonly Operacion: OperacionType;
  readonly RefExterna?: TextMax60Type;
  /** Estado del registro. Correcto o Incorrecto */
  readonly EstadoRegistro: EstadoRegistroType;
  /** Código del error de registro, en su caso. */
  readonly CodigoErrorRegistro?: ErrorDetalleType;
  /** Descripción detallada del error de registro, en su caso. */
  readonly DescripcionErrorRegistro?: TextMax1500Type;
}

export type EstadoEnvioType =
  /** Correcto */
  | "Correcto"
  /** Parcialmente correcto. Ver detalle de errores */
  | "ParcialmenteCorrecto"
  /** Incorrecto */
  | "Incorrecto";
export const EstadoEnvioType_VALUES = ["Correcto", "ParcialmenteCorrecto", "Incorrecto"] as const;

export type EstadoRegistroType =
  /** Correcto */
  | "Correcto"
  /** Aceptado con Errores. Ver detalle del error */
  | "AceptadoConErrores"
  /** Incorrecto */
  | "Incorrecto";
export const EstadoRegistroType_VALUES = ["Correcto", "AceptadoConErrores", "Incorrecto"] as const;

export type ErrorDetalleType = string;

