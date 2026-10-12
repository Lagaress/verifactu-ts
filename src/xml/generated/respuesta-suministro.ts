// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import type { CabeceraType, DatosPresentacionType, IDFacturaExpedidaType, OperacionType, RegistroDuplicadoType, TextMax1500Type, TextMax60Type, Tipo6Type } from './suministro-informacion.ts';

/** Namespace: https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaSuministro.xsd */

export interface RespuestaBaseType {
  /** CSV asociado al envío generado por AEAT. Solo se genera si no hay rechazo del envio */
  readonly CSV?: string;
  /** Se devuelven datos de la presentacion realizada. Solo se genera si no hay rechazo del envio */
  readonly DatosPresentacion?: DatosPresentacionType;
  /** Se devuelve la cabecera que se incluyó en el envío. */
  readonly Cabecera: CabeceraType;
  readonly TiempoEsperaEnvio: Tipo6Type;
  /** Estado del envío en conjunto. Si los datos de cabecera y todos los registros son correctos,el estado es correcto. En caso de estructura y cabecera correctos donde todos los registros son incorrectos, el estado es incorrecto En caso de estructura y cabecera correctos con al menos un registro incorrecto, el estado global es parcialmente correcto. */
  readonly EstadoEnvio: EstadoEnvioType;
}

/** Respuesta a un envío de registro de facturacion */
export interface RespuestaRegFactuSistemaFacturacionType {
  /** CSV asociado al envío generado por AEAT. Solo se genera si no hay rechazo del envio */
  readonly CSV?: string;
  /** Se devuelven datos de la presentacion realizada. Solo se genera si no hay rechazo del envio */
  readonly DatosPresentacion?: DatosPresentacionType;
  /** Se devuelve la cabecera que se incluyó en el envío. */
  readonly Cabecera: CabeceraType;
  readonly TiempoEsperaEnvio: Tipo6Type;
  /** Estado del envío en conjunto. Si los datos de cabecera y todos los registros son correctos,el estado es correcto. En caso de estructura y cabecera correctos donde todos los registros son incorrectos, el estado es incorrecto En caso de estructura y cabecera correctos con al menos un registro incorrecto, el estado global es parcialmente correcto. */
  readonly EstadoEnvio: EstadoEnvioType;
  /** Estado detallado de cada línea del suministro. */
  readonly RespuestaLinea?: readonly RespuestaExpedidaType[];
}

/** Respuesta a un envío */
export interface RespuestaExpedidaType {
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
  /** Solo en el caso de que se rechace el registro por duplicado se devuelve este nodo con la informacion registrada en el sistema para este registro */
  readonly RegistroDuplicado?: RegistroDuplicadoType;
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

