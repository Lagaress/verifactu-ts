// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import type { RawXml } from '../raw-xml.ts';

/** Namespace: https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/EventosSIF.xsd */

export interface RegistroEventoType {
  readonly IDVersion: VersionType;
  readonly Evento: EventoType;
}

export interface EventoType {
  readonly SistemaInformatico: SistemaInformaticoType;
  /** Obligado a expedir la factura. */
  readonly ObligadoEmision: PersonaFisicaJuridicaESType;
  readonly EmitidaPorTerceroODestinatario?: TercerosODestinatarioType;
  readonly TerceroODestinatario?: PersonaFisicaJuridicaType;
  /** Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601) */
  readonly FechaHoraHusoGenEvento: string;
  readonly TipoEvento: TipoEventoType;
  readonly DatosPropiosEvento?: DatosPropiosEventoType;
  readonly OtrosDatosEvento?: TextMax100Type;
  readonly Encadenamiento: EncadenamientoType;
  readonly TipoHuella: TipoHuellaType;
  readonly HuellaEvento: TextMax64Type;
  readonly Signature: RawXml;
}

export type SistemaInformaticoType = {
  readonly NombreRazon: TextMax120Type;
  readonly NombreSistemaInformatico?: TextMax30Type;
  readonly IdSistemaInformatico: TextMax2Type;
  readonly Version: TextMax50Type;
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

export type DatosPropiosEventoType = ({
    readonly LanzamientoProcesoDeteccionAnomaliasRegFacturacion: LanzamientoProcesoDeteccionAnomaliasRegFacturacionType;
    readonly DeteccionAnomaliasRegFacturacion?: never;
    readonly LanzamientoProcesoDeteccionAnomaliasRegEvento?: never;
    readonly DeteccionAnomaliasRegEvento?: never;
    readonly ExportacionRegFacturacionPeriodo?: never;
    readonly ExportacionRegEventoPeriodo?: never;
    readonly ResumenEventos?: never;
  } | {
    readonly DeteccionAnomaliasRegFacturacion: DeteccionAnomaliasRegFacturacionType;
    readonly LanzamientoProcesoDeteccionAnomaliasRegFacturacion?: never;
    readonly LanzamientoProcesoDeteccionAnomaliasRegEvento?: never;
    readonly DeteccionAnomaliasRegEvento?: never;
    readonly ExportacionRegFacturacionPeriodo?: never;
    readonly ExportacionRegEventoPeriodo?: never;
    readonly ResumenEventos?: never;
  } | {
    readonly LanzamientoProcesoDeteccionAnomaliasRegEvento: LanzamientoProcesoDeteccionAnomaliasRegEventoType;
    readonly LanzamientoProcesoDeteccionAnomaliasRegFacturacion?: never;
    readonly DeteccionAnomaliasRegFacturacion?: never;
    readonly DeteccionAnomaliasRegEvento?: never;
    readonly ExportacionRegFacturacionPeriodo?: never;
    readonly ExportacionRegEventoPeriodo?: never;
    readonly ResumenEventos?: never;
  } | {
    readonly DeteccionAnomaliasRegEvento: DeteccionAnomaliasRegEventoType;
    readonly LanzamientoProcesoDeteccionAnomaliasRegFacturacion?: never;
    readonly DeteccionAnomaliasRegFacturacion?: never;
    readonly LanzamientoProcesoDeteccionAnomaliasRegEvento?: never;
    readonly ExportacionRegFacturacionPeriodo?: never;
    readonly ExportacionRegEventoPeriodo?: never;
    readonly ResumenEventos?: never;
  } | {
    readonly ExportacionRegFacturacionPeriodo: ExportacionRegFacturacionPeriodoType;
    readonly LanzamientoProcesoDeteccionAnomaliasRegFacturacion?: never;
    readonly DeteccionAnomaliasRegFacturacion?: never;
    readonly LanzamientoProcesoDeteccionAnomaliasRegEvento?: never;
    readonly DeteccionAnomaliasRegEvento?: never;
    readonly ExportacionRegEventoPeriodo?: never;
    readonly ResumenEventos?: never;
  } | {
    readonly ExportacionRegEventoPeriodo: ExportacionRegEventoPeriodoType;
    readonly LanzamientoProcesoDeteccionAnomaliasRegFacturacion?: never;
    readonly DeteccionAnomaliasRegFacturacion?: never;
    readonly LanzamientoProcesoDeteccionAnomaliasRegEvento?: never;
    readonly DeteccionAnomaliasRegEvento?: never;
    readonly ExportacionRegFacturacionPeriodo?: never;
    readonly ResumenEventos?: never;
  } | {
    readonly ResumenEventos: ResumenEventosType;
    readonly LanzamientoProcesoDeteccionAnomaliasRegFacturacion?: never;
    readonly DeteccionAnomaliasRegFacturacion?: never;
    readonly LanzamientoProcesoDeteccionAnomaliasRegEvento?: never;
    readonly DeteccionAnomaliasRegEvento?: never;
    readonly ExportacionRegFacturacionPeriodo?: never;
    readonly ExportacionRegEventoPeriodo?: never;
  });

export type EncadenamientoType = ({
    readonly PrimerEvento: TextMax1Type;
    readonly EventoAnterior?: never;
  } | {
    readonly EventoAnterior: RegEventoAntType;
    readonly PrimerEvento?: never;
  });

export interface LanzamientoProcesoDeteccionAnomaliasRegFacturacionType {
  readonly RealizadoProcesoSobreIntegridadHuellasRegFacturacion: SiNoType;
  readonly NumeroDeRegistrosFacturacionProcesadosSobreIntegridadHuellas?: DigitosMax7Type;
  readonly RealizadoProcesoSobreIntegridadFirmasRegFacturacion: SiNoType;
  readonly NumeroDeRegistrosFacturacionProcesadosSobreIntegridadFirmas?: DigitosMax7Type;
  readonly RealizadoProcesoSobreTrazabilidadCadenaRegFacturacion: SiNoType;
  readonly NumeroDeRegistrosFacturacionProcesadosSobreTrazabilidadCadena?: DigitosMax7Type;
  readonly RealizadoProcesoSobreTrazabilidadFechasRegFacturacion: SiNoType;
  readonly NumeroDeRegistrosFacturacionProcesadosSobreTrazabilidadFechas?: DigitosMax7Type;
}

export interface DeteccionAnomaliasRegFacturacionType {
  readonly TipoAnomalia: TipoAnomaliaType;
  readonly OtrosDatosAnomalia?: TextMax100Type;
  readonly RegistroFacturacionAnomalo?: IDFacturaExpedidaType;
}

export interface LanzamientoProcesoDeteccionAnomaliasRegEventoType {
  readonly RealizadoProcesoSobreIntegridadHuellasRegEvento: SiNoType;
  readonly NumeroDeRegistrosEventoProcesadosSobreIntegridadHuellas?: DigitosMax5Type;
  readonly RealizadoProcesoSobreIntegridadFirmasRegEvento: SiNoType;
  readonly NumeroDeRegistrosEventoProcesadosSobreIntegridadFirmas?: DigitosMax5Type;
  readonly RealizadoProcesoSobreTrazabilidadCadenaRegEvento: SiNoType;
  readonly NumeroDeRegistrosEventoProcesadosSobreTrazabilidadCadena?: DigitosMax5Type;
  readonly RealizadoProcesoSobreTrazabilidadFechasRegEvento: SiNoType;
  readonly NumeroDeRegistrosEventoProcesadosSobreTrazabilidadFechas?: DigitosMax5Type;
}

export interface DeteccionAnomaliasRegEventoType {
  readonly TipoAnomalia: TipoAnomaliaType;
  readonly OtrosDatosAnomalia?: TextMax100Type;
  readonly RegEventoAnomalo?: RegEventoType;
}

export interface ExportacionRegFacturacionPeriodoType {
  /** Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601) */
  readonly FechaHoraHusoInicioPeriodoExport: string;
  /** Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601) */
  readonly FechaHoraHusoFinPeriodoExport: string;
  readonly RegistroFacturacionInicialPeriodo: IDFacturaExpedidaHuellaType;
  readonly RegistroFacturacionFinalPeriodo: IDFacturaExpedidaHuellaType;
  readonly NumeroDeRegistrosFacturacionAltaExportados: DigitosMax9Type;
  readonly SumaCuotaTotalAlta: ImporteSgn12_2Type;
  readonly SumaImporteTotalAlta: ImporteSgn12_2Type;
  readonly NumeroDeRegistrosFacturacionAnulacionExportados: DigitosMax9Type;
  readonly RegistrosFacturacionExportadosDejanDeConservarse: SiNoType;
}

export interface ExportacionRegEventoPeriodoType {
  /** Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601) */
  readonly FechaHoraHusoInicioPeriodoExport: string;
  /** Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601) */
  readonly FechaHoraHusoFinPeriodoExport: string;
  readonly RegistroEventoInicialPeriodo: RegEventoType;
  readonly RegistroEventoFinalPeriodo: RegEventoType;
  readonly NumeroDeRegEventoExportados: DigitosMax7Type;
  readonly RegEventoExportadosDejanDeConservarse: SiNoType;
}

export interface ResumenEventosType {
  readonly TipoEvento: readonly TipoEventoAgrType[];
  readonly RegistroFacturacionInicialPeriodo?: IDFacturaExpedidaHuellaType;
  readonly RegistroFacturacionFinalPeriodo?: IDFacturaExpedidaHuellaType;
  readonly NumeroDeRegistrosFacturacionAltaGenerados: DigitosMax6Type;
  readonly SumaCuotaTotalAlta: ImporteSgn12_2Type;
  readonly SumaImporteTotalAlta: ImporteSgn12_2Type;
  readonly NumeroDeRegistrosFacturacionAnulacionGenerados: DigitosMax6Type;
}

export interface RegEventoType {
  readonly TipoEvento: TipoEventoType;
  /** Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601) */
  readonly FechaHoraHusoEvento: string;
  readonly HuellaEvento: TextMax64Type;
}

export interface RegEventoAntType {
  readonly TipoEvento: TipoEventoType;
  /** Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601) */
  readonly FechaHoraHusoGenEvento: string;
  readonly HuellaEvento: TextMax64Type;
}

export interface TipoEventoAgrType {
  readonly TipoEvento: TipoEventoType;
  readonly NumeroDeEventos: DigitosMax4Type;
}

/** Datos de una persona física o jurídica Española con un NIF asociado */
export interface PersonaFisicaJuridicaESType {
  readonly NombreRazon: TextMax120Type;
  readonly NIF: NIFType;
}

/** NIF */
export type NIFType = string;

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

export type TercerosODestinatarioType =
  /** Destinatario */
  | "D"
  /** Tercero */
  | "T";
export const TercerosODestinatarioType_VALUES = ["D", "T"] as const;

export type SiNoType =
  | "S"
  | "N";
export const SiNoType_VALUES = ["S", "N"] as const;

export type VersionType =
  | "1.0";
export const VersionType_VALUES = ["1.0"] as const;

export type TextMax120Type = string;

export type TextMax100Type = string;

export type TextMax64Type = string;

export type TextMax60Type = string;

export type TextMax50Type = string;

export type TextMax30Type = string;

export type TextMax20Type = string;

export type TextMax2Type = string;

export type TextMax1Type = string;

export type DigitosMax9Type = string;

export type DigitosMax7Type = string;

export type DigitosMax6Type = string;

export type DigitosMax5Type = string;

export type DigitosMax4Type = string;

export type fecha = string;

export type ImporteSgn12_2Type = string;

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

export type TipoEventoType =
  /** Inicio del funcionamiento del sistema informático como «NO VERI*FACTU». */
  | "01"
  /** Fin del funcionamiento del sistema informático como «NO VERI*FACTU». */
  | "02"
  /** Lanzamiento del proceso de detección de anomalías en los registros de facturación. */
  | "03"
  /** Detección de anomalías en la integridad, inalterabilidad y trazabilidad de registros de facturación. */
  | "04"
  /** Lanzamiento del proceso de detección de anomalías en los registros de evento. */
  | "05"
  /** Detección de anomalías en la integridad, inalterabilidad y trazabilidad de registros de evento. */
  | "06"
  /** Restauración de copia de seguridad, cuando ésta se gestione desde el propio sistema informático de facturación. */
  | "07"
  /** Exportación de registros de facturación generados en un periodo. */
  | "08"
  /** Exportación de registros de evento generados en un periodo. */
  | "09"
  /** Registro resumen de eventos */
  | "10"
  /** Otros tipos de eventos a registrar voluntariamente por la persona o entidad productora del sistema informático. */
  | "90";
export const TipoEventoType_VALUES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "90"] as const;

export type TipoAnomaliaType =
  /** Integridad-huella */
  | "01"
  /** Integridad-firma */
  | "02"
  /** Integridad - Otros */
  | "03"
  /** Trazabilidad-cadena-registro - Reg. no primero pero con reg. anterior no anotado o inexistente */
  | "04"
  /** Trazabilidad-cadena-registro - Reg. no último pero con reg. posterior no anotado o inexistente */
  | "05"
  /** Trazabilidad-cadena-registro - Otros */
  | "06"
  /** Trazabilidad-cadena-huella - Huella del reg. no se corresponde con la 'huella del reg. anterior' almacenada en el registro posterior */
  | "07"
  /** Trazabilidad-cadena-huella - Campo 'huella del reg. anterior' no se corresponde con la huella del reg. anterior */
  | "08"
  /** Trazabilidad-cadena-huella - Otros */
  | "09"
  /** Trazabilidad-cadena - Otros */
  | "10"
  /** Trazabilidad-fechas - Fecha-hora anterior a la fecha del reg. anterior */
  | "11"
  /** Trazabilidad-fechas - Fecha-hora posterior a la fecha del reg. posterior */
  | "12"
  /** Trazabilidad-fechas - Reg. con fecha-hora de generación posterior a la fecha-hora actual del sistema */
  | "13"
  /** Trazabilidad-fechas - Otros */
  | "14"
  /** Trazabilidad - Otros */
  | "15"
  /** Otros */
  | "90";
export const TipoAnomaliaType_VALUES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "90"] as const;

/** Datos de identificación de factura expedida para operaciones de consulta */
export interface IDFacturaExpedidaType {
  readonly IDEmisorFactura: NIFType;
  readonly NumSerieFactura: TextMax60Type;
  readonly FechaExpedicionFactura: fecha;
}

/** Datos de encadenamiento */
export interface IDFacturaExpedidaHuellaType {
  readonly IDEmisorFactura: NIFType;
  readonly NumSerieFactura: TextMax60Type;
  readonly FechaExpedicionFactura: fecha;
  readonly Huella: TextMax64Type;
}

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
export const CountryType2_VALUES = ["AF", "AL", "DE", "AD", "AO", "AI", "AQ", "AG", "SA", "DZ", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BE", "BZ", "BJ", "BM", "BY", "BO", "BA", "BW", "BV", "BR", "BN", "BG", "BF", "BI", "BT", "CV", "KY", "KH", "CM", "CA", "CF", "CC", "CO", "KM", "CG", "CD", "CK", "KP", "KR", "CI", "CR", "HR", "CU", "TD", "CZ", "CL", "CN", "CY", "CW", "DK", "DM", "DO", "EC", "EG", "AE", "ER", "SK", "SI", "ES", "US", "EE", "ET", "FO", "PH", "FI", "FJ", "FR", "GA", "GM", "GE", "GS", "GH", "GI", "GD", "GR", "GL", "GU", "GT", "GG", "GN", "GQ", "GW", "GY", "HT", "HM", "HN", "HK", "HU", "IN", "ID", "IR", "IQ", "IE", "IM", "IS", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KG", "KI", "KW", "LA", "LS", "LV", "LB", "LR", "LY", "LI", "LT", "LU", "XG", "MO", "MK", "MG", "MY", "MW", "MV", "ML", "MT", "FK", "MP", "MA", "MH", "MU", "MR", "YT", "UM", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MZ", "MM", "NA", "NR", "CX", "NP", "NI", "NE", "NG", "NU", "NF", "NO", "NC", "NZ", "IO", "OM", "NL", "BQ", "PK", "PW", "PA", "PG", "PY", "PE", "PN", "PF", "PL", "PT", "PR", "QA", "GB", "RW", "RO", "RU", "SB", "SV", "WS", "AS", "KN", "SM", "SX", "PM", "VC", "SH", "LC", "ST", "SN", "RS", "SC", "SL", "SG", "SY", "SO", "LK", "SZ", "ZA", "SD", "SS", "SE", "CH", "SR", "TH", "TW", "TZ", "TJ", "PS", "TF", "TL", "TG", "TK", "TO", "TT", "TN", "TC", "TM", "TR", "TV", "UA", "UG", "UY", "UZ", "VU", "VA", "VE", "VN", "VG", "VI", "WF", "YE", "DJ", "ZM", "ZW", "QU", "XB", "XU", "XN"] as const;

