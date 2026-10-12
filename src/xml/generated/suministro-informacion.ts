// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import type { RawXml } from '../raw-xml.ts';

/** Namespace: https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd */

export interface CabeceraType_RemisionVoluntaria {
  readonly FechaFinVeriFactu?: fecha;
  readonly Incidencia?: IncidenciaType;
}

export interface CabeceraType_RemisionRequerimiento {
  readonly RefRequerimiento: TextMax18Type;
  readonly FinRequerimiento?: FinRequerimientoType;
}

/** Datos de cabecera */
export interface CabeceraType {
  /** Obligado a expedir la factura. */
  readonly ObligadoEmision: PersonaFisicaJuridicaESType;
  /** Representante del obligado tributario. A rellenar solo en caso de que los registros de facturación remitdos hayan sido generados por un representante/asesor del obligado tributario. */
  readonly Representante?: PersonaFisicaJuridicaESType;
  readonly RemisionVoluntaria?: CabeceraType_RemisionVoluntaria;
  readonly RemisionRequerimiento?: CabeceraType_RemisionRequerimiento;
}

export interface DatosPresentacionType {
  readonly NIFPresentador: NIFType;
  readonly TimestampPresentacion: string;
}

export interface DatosPresentacion2Type {
  readonly NIFPresentador: NIFType;
  readonly TimestampPresentacion: string;
  readonly IdPeticion: TextMax20Type;
}

export interface PeriodoImputacionType {
  readonly Ejercicio: YearType;
  readonly Periodo: TipoPeriodoType;
}

/** Datos de identificación de factura expedida para operaciones de consulta */
export interface IDFacturaExpedidaBCType {
  readonly IDEmisorFactura: NIFType;
  /** Nº Serie+Nº Factura de la Factura del Emisor. */
  readonly NumSerieFactura: TextoIDFacturaType;
  /** Fecha de emisión de la factura */
  readonly FechaExpedicionFactura: fecha;
}

/** Datos de identificación de factura que se anula para operaciones de baja */
export interface IDFacturaExpedidaBajaType {
  /** NIF del obligado */
  readonly IDEmisorFacturaAnulada: NIFType;
  /** Nº Serie+Nº Factura de la Factura que se anula. */
  readonly NumSerieFacturaAnulada: TextoIDFacturaType;
  /** Fecha de emisión de la factura que se anula */
  readonly FechaExpedicionFacturaAnulada: fecha;
}

/** El ID de las facturas rectificadas, únicamente se rellena en el caso de rectificación de facturas */
export interface RegistroFacturacionAltaType_FacturasRectificadas {
  readonly IDFacturaRectificada: readonly IDFacturaARType[];
}

/** El ID de las facturas sustituidas, únicamente se rellena en el caso de facturas sustituidas */
export interface RegistroFacturacionAltaType_FacturasSustituidas {
  readonly IDFacturaSustituida: readonly IDFacturaARType[];
}

/** Contraparte de la operación. Cliente */
export interface RegistroFacturacionAltaType_Destinatarios {
  readonly IDDestinatario: readonly PersonaFisicaJuridicaType[];
}

export type RegistroFacturacionAltaType_Encadenamiento = ({
    readonly PrimerRegistro: PrimerRegistroCadenaType;
    readonly RegistroAnterior?: never;
  } | {
    readonly RegistroAnterior: EncadenamientoFacturaAnteriorType;
    readonly PrimerRegistro?: never;
  });

/** Datos correspondientes al registro de facturacion de alta */
export interface RegistroFacturacionAltaType {
  readonly IDVersion: VersionType;
  readonly IDFactura: IDFacturaExpedidaType;
  readonly RefExterna?: TextMax60Type;
  readonly NombreRazonEmisor: TextMax120Type;
  readonly Subsanacion?: SubsanacionType;
  readonly RechazoPrevio?: RechazoPrevioType;
  /** Clave del tipo de factura */
  readonly TipoFactura: ClaveTipoFacturaType;
  /** Identifica si el tipo de factura rectificativa es por sustitución o por diferencia */
  readonly TipoRectificativa?: ClaveTipoRectificativaType;
  readonly FacturasRectificadas?: RegistroFacturacionAltaType_FacturasRectificadas;
  readonly FacturasSustituidas?: RegistroFacturacionAltaType_FacturasSustituidas;
  readonly ImporteRectificacion?: DesgloseRectificacionType;
  readonly FechaOperacion?: fecha;
  readonly DescripcionOperacion: TextMax500Type;
  readonly FacturaSimplificadaArt7273?: SimplificadaCualificadaType;
  readonly FacturaSinIdentifDestinatarioArt61d?: CompletaSinDestinatarioType;
  readonly Macrodato?: MacrodatoType;
  readonly EmitidaPorTerceroODestinatario?: TercerosODestinatarioType;
  /** Tercero que expida la factura y/o genera el registro de alta. */
  readonly Tercero?: PersonaFisicaJuridicaType;
  readonly Destinatarios?: RegistroFacturacionAltaType_Destinatarios;
  readonly Cupon?: CuponType;
  readonly Desglose: DesgloseType;
  readonly CuotaTotal: ImporteSgn12_2Type;
  readonly ImporteTotal: ImporteSgn12_2Type;
  readonly Encadenamiento: RegistroFacturacionAltaType_Encadenamiento;
  readonly SistemaInformatico: SistemaInformaticoType;
  readonly FechaHoraHusoGenRegistro: string;
  readonly NumRegistroAcuerdoFacturacion?: TextMax15Type;
  readonly IdAcuerdoSistemaInformatico?: TextMax16Type;
  readonly TipoHuella: TipoHuellaType;
  readonly Huella: TextMax64Type;
  readonly Signature?: RawXml;
}

export type RegistroFacturacionAnulacionType_Encadenamiento = ({
    readonly PrimerRegistro: PrimerRegistroCadenaType;
    readonly RegistroAnterior?: never;
  } | {
    readonly RegistroAnterior: EncadenamientoFacturaAnteriorType;
    readonly PrimerRegistro?: never;
  });

/** Datos correspondientes al registro de facturacion de anulacion */
export interface RegistroFacturacionAnulacionType {
  readonly IDVersion: VersionType;
  readonly IDFactura: IDFacturaExpedidaBajaType;
  readonly RefExterna?: TextMax60Type;
  readonly SinRegistroPrevio?: SinRegistroPrevioType;
  readonly RechazoPrevio?: RechazoPrevioAnulacionType;
  readonly GeneradoPor?: GeneradoPorType;
  readonly Generador?: PersonaFisicaJuridicaType;
  readonly Encadenamiento: RegistroFacturacionAnulacionType_Encadenamiento;
  readonly SistemaInformatico: SistemaInformaticoType;
  readonly FechaHoraHusoGenRegistro: string;
  readonly TipoHuella: TipoHuellaType;
  readonly Huella: TextMax64Type;
  readonly Signature?: RawXml;
}

/** Datos de encadenamiento */
export interface EncadenamientoFacturaAnteriorType {
  /** NIF del obligado a expedir la factura a que se refiere el registro de facturación anterior */
  readonly IDEmisorFactura: NIFType;
  readonly NumSerieFactura: TextMax60Type;
  readonly FechaExpedicionFactura: fecha;
  readonly Huella: TextMax64Type;
}

export type SistemaInformaticoType = {
  readonly NombreRazon: TextMax120Type;
  readonly NombreSistemaInformatico: TextMax30Type;
  readonly IdSistemaInformatico: TextMax2Type;
  readonly Version: TextMax50Type;
  readonly NumeroInstalacion: TextMax100Type;
  readonly TipoUsoPosibleSoloVerifactu: SiNoType;
  readonly TipoUsoPosibleMultiOT: SiNoType;
  readonly IndicadorMultiplesOT: SiNoType;
} & ({
    readonly NIF: NIFType;
    readonly IDOtro?: never;
  } | {
    readonly IDOtro: IDOtroType;
    readonly NIF?: never;
  });

export type SistemaInformaticoConsultaType = {
  readonly NombreRazon: TextMax120Type;
  readonly NombreSistemaInformatico?: TextMax30Type;
  readonly IdSistemaInformatico: TextMax2Type;
  readonly Version?: TextMax50Type;
  readonly NumeroInstalacion: TextMax100Type;
  readonly TipoUsoPosibleSoloVerifactu?: SiNoType;
  readonly TipoUsoPosibleMultiOT?: SiNoType;
  readonly IndicadorMultiplesOT?: SiNoType;
} & ({
    readonly NIF: NIFType;
    readonly IDOtro?: never;
  } | {
    readonly IDOtro: IDOtroType;
    readonly NIF?: never;
  });

/** Datos de identificación de factura */
export interface IDFacturaExpedidaType {
  /** NIF del obligado */
  readonly IDEmisorFactura: NIFType;
  /** Nº Serie+Nº Factura de la Factura del Emisor */
  readonly NumSerieFactura: TextoIDFacturaType;
  /** Fecha de emisión de la factura */
  readonly FechaExpedicionFactura: fecha;
}

/** Datos de identificación de factura sustituida o rectificada. El NIF se cogerá del NIF indicado en el bloque IDFactura */
export interface IDFacturaARType {
  /** NIF del obligado */
  readonly IDEmisorFactura: NIFType;
  /** Nº Serie+Nº Factura de la factura */
  readonly NumSerieFactura: TextoIDFacturaType;
  /** Fecha de emisión de la factura sustituida o rectificada */
  readonly FechaExpedicionFactura: fecha;
}

export type DetalleType = {
  readonly Impuesto?: ImpuestoType;
  readonly ClaveRegimen?: IdOperacionesTrascendenciaTributariaType;
  readonly TipoImpositivo?: Tipo2_2Type;
  readonly BaseImponibleOimporteNoSujeto: ImporteSgn12_2Type;
  readonly BaseImponibleACoste?: ImporteSgn12_2Type;
  readonly CuotaRepercutida?: ImporteSgn12_2Type;
  readonly TipoRecargoEquivalencia?: Tipo2_2Type;
  readonly CuotaRecargoEquivalencia?: ImporteSgn12_2Type;
} & ({
    readonly CalificacionOperacion: CalificacionOperacionType;
    readonly OperacionExenta?: never;
  } | {
    readonly OperacionExenta: OperacionExentaType;
    readonly CalificacionOperacion?: never;
  });

/** Desglose de Base y Cuota sustituida en las Facturas Rectificativas sustitutivas */
export interface DesgloseRectificacionType {
  readonly BaseRectificada: ImporteSgn12_2Type;
  readonly CuotaRectificada: ImporteSgn12_2Type;
  readonly CuotaRecargoRectificado?: ImporteSgn12_2Type;
}

/** Datos de una persona física o jurídica Española con un NIF asociado */
export interface PersonaFisicaJuridicaESType {
  readonly NombreRazon: TextMax120Type;
  readonly NIF: NIFType;
}

/** Datos de una persona física o jurídica Española o Extranjera */
export type PersonaFisicaJuridicaType = {
  readonly NombreRazon: TextMax120Type;
} & ({
    readonly NIF: NIFType;
    readonly IDOtro?: never;
  } | {
    readonly IDOtro: IDOtroType;
    readonly NIF?: never;
  });

/** Identificador de persona Física o jurídica distinto del NIF (Código pais, Tipo de Identificador, y hasta 15 caractéres) No se permite CodigoPais=ES e IDType=01-NIFContraparte para ese caso, debe utilizarse NIF en lugar de IDOtro. */
export interface IDOtroType {
  readonly CodigoPais?: CountryType2;
  readonly IDType: PersonaFisicaJuridicaIDTypeType;
  readonly ID: TextMax20Type;
}

/** Rango de fechas de expedicion */
export interface RangoFechaExpedicionType {
  readonly Desde?: fecha;
  readonly Hasta?: fecha;
}

export type FechaExpedicionConsultaType = ({
    readonly FechaExpedicionFactura?: fecha;
    readonly RangoFechaExpedicion?: never;
  } | {
    readonly RangoFechaExpedicion?: RangoFechaExpedicionType;
    readonly FechaExpedicionFactura?: never;
  });

export interface RegistroDuplicadoType {
  /** IdPeticion asociado a la factura registrada previamente en el sistema. Solo se suministra si la factura enviada es rechazada por estar duplicada */
  readonly IdPeticionRegistroDuplicado: TextMax20Type;
  /** Estado del registro duplicado almacenado en el sistema. Los estados posibles son: Correcta, AceptadaConErrores y Anulada. Solo se suministra si la factura enviada es rechazada por estar duplicada */
  readonly EstadoRegistroDuplicado: EstadoRegistroSFType;
  /** Código del error de registro duplicado almacenado en el sistema, en su caso. */
  readonly CodigoErrorRegistro?: ErrorDetalleType;
  /** Descripción detallada del error de registro duplicado almacenado en el sistema, en su caso. */
  readonly DescripcionErrorRegistro?: TextMax500Type;
}

export type VersionType =
  | "1.0";
export const VersionType_VALUES = ["1.0"] as const;

/** Año en formato YYYY */
export type YearType = string;

/** Período de la factura */
export type TipoPeriodoType =
  /** Enero */
  | "01"
  /** Febrero */
  | "02"
  /** Marzo */
  | "03"
  /** Abril */
  | "04"
  /** Mayo */
  | "05"
  /** Junio */
  | "06"
  /** Julio */
  | "07"
  /** Agosto */
  | "08"
  /** Septiembre */
  | "09"
  /** Octubre */
  | "10"
  /** Noviembre */
  | "11"
  /** Diciembre */
  | "12";
export const TipoPeriodoType_VALUES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

export type TextoIDenvioType = string;

export type TextoIDFacturaType = string;

export type Tipo10Type = string;

export type ImporteSgn12_2Type = string;

export type ImporteSgn14_2Type = string;

export type Tipo2_2Type = string;

export type Tipo3Type = string;

export type Tipo6Type = string;

export type TextMax1500Type = string;

export type TextMax500Type = string;

export type TextMax250Type = string;

export type TextMax150Type = string;

export type TextMax120Type = string;

export type TextMax100Type = string;

export type TextMax70Type = string;

export type TextMax65Type = string;

export type TextMax60Type = string;

export type TextMax64Type = string;

export type TextMax40Type = string;

export type TextMax34Type = string;

export type TextMax20Type = string;

export type TextMax18Type = string;

export type TextMax15Type = string;

export type TextMax16Type = string;

export type TextMax25Type = string;

export type TextMax30Type = string;

export type ReferenciaCatastralType = string;

export type TextMax2Type = string;

export type TextMax50Type = string;

/** NIF */
export type NIFType = string;

export type fecha = string;

export type Timestamp = string;

export type OperacionExentaType =
  | "E1"
  | "E2"
  | "E3"
  | "E4"
  | "E5"
  | "E6"
  | "E7"
  | "E8";
export const OperacionExentaType_VALUES = ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"] as const;

export type ClaveTipoFacturaType =
  /** FACTURA (ART. 6, 7.2 Y 7.3 DEL RD 1619/2012) */
  | "F1"
  /** FACTURA SIMPLIFICADA Y FACTURAS SIN IDENTIFICACIÓN DEL DESTINATARIO ART. 6.1.D) RD 1619/2012 */
  | "F2"
  /** FACTURA RECTIFICATIVA (Art 80.1 y 80.2 y error fundado en derecho) */
  | "R1"
  /** FACTURA RECTIFICATIVA (Art. 80.3) */
  | "R2"
  /** FACTURA RECTIFICATIVA (Art. 80.4) */
  | "R3"
  /** FACTURA RECTIFICATIVA (Resto) */
  | "R4"
  /** FACTURA RECTIFICATIVA EN FACTURAS SIMPLIFICADAS */
  | "R5"
  /** FACTURA EMITIDA EN SUSTITUCIÓN DE FACTURAS SIMPLIFICADAS FACTURADAS Y DECLARADAS */
  | "F3";
export const ClaveTipoFacturaType_VALUES = ["F1", "F2", "R1", "R2", "R3", "R4", "R5", "F3"] as const;

export type RechazoPrevioType =
  /** No ha habido rechazo previo por la AEAT. */
  | "N"
  /** Ha habido rechazo previo por la AEAT. */
  | "S"
  /** Independientemente de si ha habido o no algún rechazo previo por la AEAT, el registro de facturación no existe en la AEAT (registro existente en ese SIF o en algún SIF del obligado tributario y que no se remitió a la AEAT, por ejemplo, al acogerse a Veri*factu desde no Veri*factu). No deberían existir operaciones de alta (N,X), por lo que no se admiten. */
  | "X";
export const RechazoPrevioType_VALUES = ["N", "S", "X"] as const;

export type RechazoPrevioAnulacionType =
  | "S"
  | "N";
export const RechazoPrevioAnulacionType_VALUES = ["S", "N"] as const;

export type SinRegistroPrevioType =
  | "S"
  | "N";
export const SinRegistroPrevioType_VALUES = ["S", "N"] as const;

export type PrimerRegistroCadenaType =
  | "S";
export const PrimerRegistroCadenaType_VALUES = ["S"] as const;

export type SubsanacionType =
  | "S"
  | "N";
export const SubsanacionType_VALUES = ["S", "N"] as const;

export type ClaveTipoRectificativaType =
  /** SUSTITUTIVA */
  | "S"
  /** INCREMENTAL */
  | "I";
export const ClaveTipoRectificativaType_VALUES = ["S", "I"] as const;

export type TercerosODestinatarioType =
  /** Destinatario */
  | "D"
  /** Tercero */
  | "T";
export const TercerosODestinatarioType_VALUES = ["D", "T"] as const;

export type SimplificadaCualificadaType =
  | "S"
  | "N";
export const SimplificadaCualificadaType_VALUES = ["S", "N"] as const;

export type CompletaSinDestinatarioType =
  | "S"
  | "N";
export const CompletaSinDestinatarioType_VALUES = ["S", "N"] as const;

export type MacrodatoType =
  | "S"
  | "N";
export const MacrodatoType_VALUES = ["S", "N"] as const;

export type IncidenciaType =
  | "S"
  | "N";
export const IncidenciaType_VALUES = ["S", "N"] as const;

export type FinRequerimientoType =
  | "S"
  | "N";
export const FinRequerimientoType_VALUES = ["S", "N"] as const;

export type MostrarSistemaInformaticoType =
  | "S"
  | "N";
export const MostrarSistemaInformaticoType_VALUES = ["S", "N"] as const;

export type MostrarNombreRazonEmisorType =
  | "S"
  | "N";
export const MostrarNombreRazonEmisorType_VALUES = ["S", "N"] as const;

export type GeneradoPorType =
  /** Expedidor (obligado a Expedir la factura anulada). */
  | "E"
  /** Destinatario */
  | "D"
  /** Tercero */
  | "T";
export const GeneradoPorType_VALUES = ["E", "D", "T"] as const;

export type PersonaFisicaJuridicaIDTypeType =
  /** NIF-IVA */
  | "02"
  /** Pasaporte */
  | "03"
  /** IDEnPaisResidencia */
  | "04"
  /** Certificado Residencia */
  | "05"
  /** Otro documento Probatorio */
  | "06"
  /** No Censado */
  | "07";
export const PersonaFisicaJuridicaIDTypeType_VALUES = ["02", "03", "04", "05", "06", "07"] as const;

export type TipoHuellaType =
  /** SHA-256 */
  | "01";
export const TipoHuellaType_VALUES = ["01"] as const;

export type IdOperacionesTrascendenciaTributariaType =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "14"
  | "15"
  | "17"
  | "18"
  | "19"
  | "20"
  | "21";
export const IdOperacionesTrascendenciaTributariaType_VALUES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "14", "15", "17", "18", "19", "20", "21"] as const;

export type CountryType2 =
  | "AF"
  | "AL"
  | "DE"
  | "AD"
  | "AO"
  | "AI"
  | "AQ"
  | "AG"
  | "SA"
  | "DZ"
  | "AR"
  | "AM"
  | "AW"
  | "AU"
  | "AT"
  | "AZ"
  | "BS"
  | "BH"
  | "BD"
  | "BB"
  | "BE"
  | "BZ"
  | "BJ"
  | "BM"
  | "BY"
  | "BO"
  | "BA"
  | "BW"
  | "BV"
  | "BR"
  | "BN"
  | "BG"
  | "BF"
  | "BI"
  | "BT"
  | "CV"
  | "KY"
  | "KH"
  | "CM"
  | "CA"
  | "CF"
  | "CC"
  | "CO"
  | "KM"
  | "CG"
  | "CD"
  | "CK"
  | "KP"
  | "KR"
  | "CI"
  | "CR"
  | "HR"
  | "CU"
  | "TD"
  | "CZ"
  | "CL"
  | "CN"
  | "CY"
  | "CW"
  | "DK"
  | "DM"
  | "DO"
  | "EC"
  | "EG"
  | "AE"
  | "ER"
  | "SK"
  | "SI"
  | "ES"
  | "US"
  | "EE"
  | "ET"
  | "FO"
  | "PH"
  | "FI"
  | "FJ"
  | "FR"
  | "GA"
  | "GM"
  | "GE"
  | "GS"
  | "GH"
  | "GI"
  | "GD"
  | "GR"
  | "GL"
  | "GU"
  | "GT"
  | "GG"
  | "GN"
  | "GQ"
  | "GW"
  | "GY"
  | "HT"
  | "HM"
  | "HN"
  | "HK"
  | "HU"
  | "IN"
  | "ID"
  | "IR"
  | "IQ"
  | "IE"
  | "IM"
  | "IS"
  | "IL"
  | "IT"
  | "JM"
  | "JP"
  | "JE"
  | "JO"
  | "KZ"
  | "KE"
  | "KG"
  | "KI"
  | "KW"
  | "LA"
  | "LS"
  | "LV"
  | "LB"
  | "LR"
  | "LY"
  | "LI"
  | "LT"
  | "LU"
  | "XG"
  | "MO"
  | "MK"
  | "MG"
  | "MY"
  | "MW"
  | "MV"
  | "ML"
  | "MT"
  | "FK"
  | "MP"
  | "MA"
  | "MH"
  | "MU"
  | "MR"
  | "YT"
  | "UM"
  | "MX"
  | "FM"
  | "MD"
  | "MC"
  | "MN"
  | "ME"
  | "MS"
  | "MZ"
  | "MM"
  | "NA"
  | "NR"
  | "CX"
  | "NP"
  | "NI"
  | "NE"
  | "NG"
  | "NU"
  | "NF"
  | "NO"
  | "NC"
  | "NZ"
  | "IO"
  | "OM"
  | "NL"
  | "BQ"
  | "PK"
  | "PW"
  | "PA"
  | "PG"
  | "PY"
  | "PE"
  | "PN"
  | "PF"
  | "PL"
  | "PT"
  | "PR"
  | "QA"
  | "GB"
  | "RW"
  | "RO"
  | "RU"
  | "RE"
  | "SB"
  | "SV"
  | "WS"
  | "AS"
  | "KN"
  | "SM"
  | "SX"
  | "PM"
  | "VC"
  | "SH"
  | "LC"
  | "ST"
  | "SN"
  | "RS"
  | "SC"
  | "SL"
  | "SG"
  | "SY"
  | "SO"
  | "LK"
  | "SZ"
  | "ZA"
  | "SD"
  | "SS"
  | "SE"
  | "CH"
  | "SR"
  | "TH"
  | "TW"
  | "TZ"
  | "TJ"
  | "PS"
  | "TF"
  | "TL"
  | "TG"
  | "TK"
  | "TO"
  | "TT"
  | "TN"
  | "TC"
  | "TM"
  | "TR"
  | "TV"
  | "UA"
  | "UG"
  | "UY"
  | "UZ"
  | "VU"
  | "VA"
  | "VE"
  | "VN"
  | "VG"
  | "VI"
  | "WF"
  | "YE"
  | "DJ"
  | "ZM"
  | "ZW"
  | "QU"
  | "XB"
  | "XU"
  | "XN";
export const CountryType2_VALUES = ["AF", "AL", "DE", "AD", "AO", "AI", "AQ", "AG", "SA", "DZ", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BE", "BZ", "BJ", "BM", "BY", "BO", "BA", "BW", "BV", "BR", "BN", "BG", "BF", "BI", "BT", "CV", "KY", "KH", "CM", "CA", "CF", "CC", "CO", "KM", "CG", "CD", "CK", "KP", "KR", "CI", "CR", "HR", "CU", "TD", "CZ", "CL", "CN", "CY", "CW", "DK", "DM", "DO", "EC", "EG", "AE", "ER", "SK", "SI", "ES", "US", "EE", "ET", "FO", "PH", "FI", "FJ", "FR", "GA", "GM", "GE", "GS", "GH", "GI", "GD", "GR", "GL", "GU", "GT", "GG", "GN", "GQ", "GW", "GY", "HT", "HM", "HN", "HK", "HU", "IN", "ID", "IR", "IQ", "IE", "IM", "IS", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KG", "KI", "KW", "LA", "LS", "LV", "LB", "LR", "LY", "LI", "LT", "LU", "XG", "MO", "MK", "MG", "MY", "MW", "MV", "ML", "MT", "FK", "MP", "MA", "MH", "MU", "MR", "YT", "UM", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MZ", "MM", "NA", "NR", "CX", "NP", "NI", "NE", "NG", "NU", "NF", "NO", "NC", "NZ", "IO", "OM", "NL", "BQ", "PK", "PW", "PA", "PG", "PY", "PE", "PN", "PF", "PL", "PT", "PR", "QA", "GB", "RW", "RO", "RU", "RE", "SB", "SV", "WS", "AS", "KN", "SM", "SX", "PM", "VC", "SH", "LC", "ST", "SN", "RS", "SC", "SL", "SG", "SY", "SO", "LK", "SZ", "ZA", "SD", "SS", "SE", "CH", "SR", "TH", "TW", "TZ", "TJ", "PS", "TF", "TL", "TG", "TK", "TO", "TT", "TN", "TC", "TM", "TR", "TV", "UA", "UG", "UY", "UZ", "VU", "VA", "VE", "VN", "VG", "VI", "WF", "YE", "DJ", "ZM", "ZW", "QU", "XB", "XU", "XN"] as const;

export type EstadoRegistroSFType =
  /** El registro se ha almacenado sin errores */
  | "Correcta"
  /** El registro que se ha almacenado tiene algunos errores. Ver detalle del error */
  | "AceptadaConErrores"
  /** El registro almacenado ha sido anulado */
  | "Anulada";
export const EstadoRegistroSFType_VALUES = ["Correcta", "AceptadaConErrores", "Anulada"] as const;

export type ErrorDetalleType = string;

export type CalificacionOperacionType =
  /** OPERACIÓN SUJETA Y NO EXENTA - SIN INVERSIÓN DEL SUJETO PASIVO. */
  | "S1"
  /** OPERACIÓN SUJETA Y NO EXENTA - CON INVERSIÓN DEL SUJETO PASIVO */
  | "S2"
  /** OPERACIÓN NO SUJETA ARTÍCULO 7, 14, OTROS. */
  | "N1"
  /** OPERACIÓN NO SUJETA POR REGLAS DE LOCALIZACIÓN */
  | "N2";
export const CalificacionOperacionType_VALUES = ["S1", "S2", "N1", "N2"] as const;

export interface DesgloseType {
  readonly DetalleDesglose: readonly DetalleType[];
}

export type SiNoType =
  | "S"
  | "N";
export const SiNoType_VALUES = ["S", "N"] as const;

/** Datos de una persona física o jurídica Española o Extranjera */
export type ContraparteConsultaType = {
  readonly NombreRazon: TextMax120Type;
} & ({
    readonly NIF: NIFType;
    readonly IDOtro?: never;
  } | {
    readonly IDOtro: IDOtroType;
    readonly NIF?: never;
  });

/** Cabecera de la Cobnsulta */
export type CabeceraConsultaSf = {
  readonly IDVersion: VersionType;
  /** Flag opcional que tendrá valor S si quien realiza la cosulta es el representante/asesor del obligado tributario. Permite, a quien realiza la cosulta, obtener los registros de facturación en los que figura como representante. Este flag solo se puede cumplimentar cuando esté informado el obligado tributario en la consulta */
  readonly IndicadorRepresentante?: IndicadorRepresentanteType;
} & ({
    /** Obligado a la emision de los registros de facturacion */
    readonly ObligadoEmision?: ObligadoEmisionConsultaType;
    readonly Destinatario?: never;
  } | {
    /** Destinatario (a veces también denominado contraparte, es decir, el cliente) de la operación */
    readonly Destinatario?: PersonaFisicaJuridicaESType;
    readonly ObligadoEmision?: never;
  });

/** Datos de una persona física o jurídica Española con un NIF asociado */
export interface ObligadoEmisionConsultaType {
  readonly NombreRazon: TextMax120Type;
  readonly NIF: NIFType;
}

export interface ObligadoGeneracionType {
  readonly NombreRazon: TextMax120Type;
  readonly NIF: NIFType;
}

export type Numerico4Type = string;

export type CuponType =
  | "S"
  | "N";
export const CuponType_VALUES = ["S", "N"] as const;

export type IndicadorRepresentanteType =
  | "S";
export const IndicadorRepresentanteType_VALUES = ["S"] as const;

export type ImpuestoType =
  /** Impuesto sobre el Valor Añadido (IVA) */
  | "01"
  /** Impuesto sobre la Producción, los Servicios y la Importación (IPSI) de Ceuta y Melilla */
  | "02"
  /** Impuesto General Indirecto Canario (IGIC) */
  | "03"
  /** Otros */
  | "05";
export const ImpuestoType_VALUES = ["01", "02", "03", "05"] as const;

export interface OperacionType {
  readonly TipoOperacion: TipoOperacionType;
  readonly Subsanacion?: SubsanacionType;
  readonly RechazoPrevio?: RechazoPrevioType;
  readonly SinRegistroPrevio?: SinRegistroPrevioType;
}

export type TipoOperacionType =
  /** La operación realizada ha sido un alta */
  | "Alta"
  /** La operación realizada ha sido una anulación */
  | "Anulacion";
export const TipoOperacionType_VALUES = ["Alta", "Anulacion"] as const;

