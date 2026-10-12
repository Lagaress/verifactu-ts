// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import type { CabeceraConsultaSf, ClaveTipoFacturaType, ClaveTipoRectificativaType, CompletaSinDestinatarioType, CuponType, DatosPresentacion2Type, DesgloseRectificacionType, DesgloseType, EncadenamientoFacturaAnteriorType, GeneradoPorType, IDFacturaARType, IDFacturaExpedidaBCType, IDFacturaExpedidaType, ImporteSgn12_2Type, IncidenciaType, MacrodatoType, NIFType, PersonaFisicaJuridicaType, PrimerRegistroCadenaType, RechazoPrevioType, SimplificadaCualificadaType, SinRegistroPrevioType, SistemaInformaticoType, SubsanacionType, TercerosODestinatarioType, TextMax120Type, TextMax15Type, TextMax16Type, TextMax500Type, TextMax60Type, TextMax64Type, TipoHuellaType, TipoPeriodoType, YearType, fecha } from './suministro-informacion.ts';

/** Namespace: https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/RespuestaConsultaLR.xsd */

export interface RespuestaConsultaFactuSistemaFacturacionType {
  readonly Cabecera: CabeceraConsultaSf;
  readonly PeriodoImputacion: RespuestaConsultaType_PeriodoImputacion;
  readonly IndicadorPaginacion: IndicadorPaginacionType;
  readonly ResultadoConsulta: ResultadoConsultaType;
  readonly RegistroRespuestaConsultaFactuSistemaFacturacion?: readonly RegistroRespuestaConsultaRegFacturacionType[];
  readonly ClavePaginacion?: IDFacturaExpedidaBCType;
}

export interface EstadoRegFactuType {
  readonly TimestampUltimaModificacion: string;
  /** Estado del registro almacenado en el sistema. Los estados posibles son: Correcta, AceptadaConErrores y Anulada */
  readonly EstadoRegistro: EstadoRegistroType;
  /** Código del error de registro, en su caso. */
  readonly CodigoErrorRegistro?: ErrorDetalleType;
  /** Descripción detallada del error de registro, en su caso. */
  readonly DescripcionErrorRegistro?: TextMax500Type;
}

export interface RegistroRespuestaConsultaRegFacturacionType {
  readonly IDFactura: IDFacturaExpedidaType;
  readonly DatosRegistroFacturacion: RespuestaDatosRegistroFacturacionType;
  readonly DatosPresentacion?: DatosPresentacion2Type;
  readonly EstadoRegistro: EstadoRegFactuType;
}

/** Período al que corresponden los apuntes. todos los apuntes deben corresponder al mismo período impositivo */
export interface RespuestaConsultaType_PeriodoImputacion {
  readonly Ejercicio: YearType;
  readonly Periodo: TipoPeriodoType;
}

export interface RespuestaConsultaType {
  readonly Cabecera: CabeceraConsultaSf;
  readonly PeriodoImputacion: RespuestaConsultaType_PeriodoImputacion;
  readonly IndicadorPaginacion: IndicadorPaginacionType;
  readonly ResultadoConsulta: ResultadoConsultaType;
}

/** El ID de las facturas rectificadas, únicamente se rellena en el caso de rectificación de facturas */
export interface RespuestaDatosRegistroFacturacionType_FacturasRectificadas {
  readonly IDFacturaRectificada: readonly IDFacturaARType[];
}

/** El ID de las facturas sustituidas, únicamente se rellena en el caso de facturas sustituidas */
export interface RespuestaDatosRegistroFacturacionType_FacturasSustituidas {
  readonly IDFacturaSustituida: readonly IDFacturaARType[];
}

/** Contraparte de la operación. Cliente */
export interface RespuestaDatosRegistroFacturacionType_Destinatarios {
  readonly IDDestinatario: readonly PersonaFisicaJuridicaType[];
}

export type RespuestaDatosRegistroFacturacionType_Encadenamiento = ({
    readonly PrimerRegistro: PrimerRegistroCadenaType;
    readonly RegistroAnterior?: never;
  } | {
    readonly RegistroAnterior: EncadenamientoFacturaAnteriorType;
    readonly PrimerRegistro?: never;
  });

/** Apunte correspondiente al libro de facturas expedidas. */
export interface RespuestaDatosRegistroFacturacionType {
  /** Solo se informa el campo NombreRazonEmisor si se realiza la consulta con valor S en el campo MostrarNombreRazonEmisor */
  readonly NombreRazonEmisor?: TextMax120Type;
  readonly RefExterna?: TextMax60Type;
  readonly Subsanacion?: SubsanacionType;
  readonly RechazoPrevio?: RechazoPrevioType;
  readonly SinRegistroPrevio?: SinRegistroPrevioType;
  readonly GeneradoPor?: GeneradoPorType;
  readonly Generador?: PersonaFisicaJuridicaType;
  /** Clave del tipo de factura */
  readonly TipoFactura?: ClaveTipoFacturaType;
  /** Identifica si el tipo de factura rectificativa es por sustitución o por diferencia */
  readonly TipoRectificativa?: ClaveTipoRectificativaType;
  readonly FacturasRectificadas?: RespuestaDatosRegistroFacturacionType_FacturasRectificadas;
  readonly FacturasSustituidas?: RespuestaDatosRegistroFacturacionType_FacturasSustituidas;
  readonly ImporteRectificacion?: DesgloseRectificacionType;
  readonly FechaOperacion?: fecha;
  readonly DescripcionOperacion?: TextMax500Type;
  readonly FacturaSimplificadaArt7273?: SimplificadaCualificadaType;
  readonly FacturaSinIdentifDestinatarioArt61d?: CompletaSinDestinatarioType;
  readonly Macrodato?: MacrodatoType;
  readonly EmitidaPorTerceroODestinatario?: TercerosODestinatarioType;
  /** Tercero que expida la factura y/o genera el registro de alta. */
  readonly Tercero?: PersonaFisicaJuridicaType;
  readonly Destinatarios?: RespuestaDatosRegistroFacturacionType_Destinatarios;
  readonly Cupon?: CuponType;
  readonly Desglose?: DesgloseType;
  readonly CuotaTotal?: ImporteSgn12_2Type;
  readonly ImporteTotal?: ImporteSgn12_2Type;
  readonly Encadenamiento?: RespuestaDatosRegistroFacturacionType_Encadenamiento;
  readonly SistemaInformatico?: SistemaInformaticoType;
  readonly FechaHoraHusoGenRegistro?: string;
  readonly NumRegistroAcuerdoFacturacion?: TextMax15Type;
  readonly IdAcuerdoSistemaInformatico?: TextMax16Type;
  readonly TipoHuella?: TipoHuellaType;
  readonly Huella?: TextMax64Type;
  readonly NifRepresentante?: NIFType;
  readonly FechaFinVeriFactu?: fecha;
  readonly Incidencia?: IncidenciaType;
}

export type IndicadorPaginacionType =
  | "S"
  | "N";
export const IndicadorPaginacionType_VALUES = ["S", "N"] as const;

export type ResultadoConsultaType =
  | "ConDatos"
  | "SinDatos";
export const ResultadoConsultaType_VALUES = ["ConDatos", "SinDatos"] as const;

export type ErrorDetalleType = string;

export type EstadoRegistroType =
  /** El registro se almacenado sin errores */
  | "Correcto"
  /** El registro se almacenado tiene algunos errores. Ver detalle del error */
  | "AceptadoConErrores"
  /** El registro almacenado ha sido anulado */
  | "Anulado";
export const EstadoRegistroType_VALUES = ["Correcto", "AceptadoConErrores", "Anulado"] as const;

