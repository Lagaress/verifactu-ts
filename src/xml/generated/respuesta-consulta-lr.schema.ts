// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import { decodeSchema } from '../schema-decode.ts';


/** Metadatos de RespuestaConsultaLR.xsd. */
export const SFLRRC = /* @__PURE__ */ decodeSchema("sfLRRC", {
  "RespuestaConsultaFactuSistemaFacturacionType": [["Cabecera","sf:CabeceraConsultaSf"],["PeriodoImputacion","RespuestaConsultaType_PeriodoImputacion"],["IndicadorPaginacion","IndicadorPaginacionType"],["ResultadoConsulta","ResultadoConsultaType"],["RegistroRespuestaConsultaFactuSistemaFacturacion","RegistroRespuestaConsultaRegFacturacionType",0,10000],["ClavePaginacion","sf:IDFacturaExpedidaBCType",0]],
  "EstadoRegFactuType": [["TimestampUltimaModificacion","xs:dateTime"],["EstadoRegistro","EstadoRegistroType"],["CodigoErrorRegistro","ErrorDetalleType",0],["DescripcionErrorRegistro","sf:TextMax500Type",0]],
  "RegistroRespuestaConsultaRegFacturacionType": [["IDFactura","sf:IDFacturaExpedidaType"],["DatosRegistroFacturacion","RespuestaDatosRegistroFacturacionType"],["DatosPresentacion","sf:DatosPresentacion2Type",0],["EstadoRegistro","EstadoRegFactuType"]],
  "RespuestaConsultaType_PeriodoImputacion": [["Ejercicio","sf:YearType"],["Periodo","sf:TipoPeriodoType"]],
  "RespuestaConsultaType": [["Cabecera","sf:CabeceraConsultaSf"],["PeriodoImputacion","RespuestaConsultaType_PeriodoImputacion"],["IndicadorPaginacion","IndicadorPaginacionType"],["ResultadoConsulta","ResultadoConsultaType"]],
  "RespuestaDatosRegistroFacturacionType_FacturasRectificadas": [["IDFacturaRectificada","sf:IDFacturaARType",1,1000]],
  "RespuestaDatosRegistroFacturacionType_FacturasSustituidas": [["IDFacturaSustituida","sf:IDFacturaARType",1,1000]],
  "RespuestaDatosRegistroFacturacionType_Destinatarios": [["IDDestinatario","sf:PersonaFisicaJuridicaType",1,1000]],
  "RespuestaDatosRegistroFacturacionType_Encadenamiento": [{c:[[["PrimerRegistro","sf:PrimerRegistroCadenaType"]],[["RegistroAnterior","sf:EncadenamientoFacturaAnteriorType"]]]}],
  "RespuestaDatosRegistroFacturacionType": [["NombreRazonEmisor","sf:TextMax120Type",0],["RefExterna","sf:TextMax60Type",0],["Subsanacion","sf:SubsanacionType",0],["RechazoPrevio","sf:RechazoPrevioType",0],["SinRegistroPrevio","sf:SinRegistroPrevioType",0],["GeneradoPor","sf:GeneradoPorType",0],["Generador","sf:PersonaFisicaJuridicaType",0],["TipoFactura","sf:ClaveTipoFacturaType",0],["TipoRectificativa","sf:ClaveTipoRectificativaType",0],["FacturasRectificadas","RespuestaDatosRegistroFacturacionType_FacturasRectificadas",0],["FacturasSustituidas","RespuestaDatosRegistroFacturacionType_FacturasSustituidas",0],["ImporteRectificacion","sf:DesgloseRectificacionType",0],["FechaOperacion","sf:fecha",0],["DescripcionOperacion","sf:TextMax500Type",0],["FacturaSimplificadaArt7273","sf:SimplificadaCualificadaType",0],["FacturaSinIdentifDestinatarioArt61d","sf:CompletaSinDestinatarioType",0],["Macrodato","sf:MacrodatoType",0],["EmitidaPorTerceroODestinatario","sf:TercerosODestinatarioType",0],["Tercero","sf:PersonaFisicaJuridicaType",0],["Destinatarios","RespuestaDatosRegistroFacturacionType_Destinatarios",0],["Cupon","sf:CuponType",0],["Desglose","sf:DesgloseType",0],["CuotaTotal","sf:ImporteSgn12.2Type",0],["ImporteTotal","sf:ImporteSgn12.2Type",0],["Encadenamiento","RespuestaDatosRegistroFacturacionType_Encadenamiento",0],["SistemaInformatico","sf:SistemaInformaticoType",0],["FechaHoraHusoGenRegistro","xs:dateTime",0],["NumRegistroAcuerdoFacturacion","sf:TextMax15Type",0],["IdAcuerdoSistemaInformatico","sf:TextMax16Type",0],["TipoHuella","sf:TipoHuellaType",0],["Huella","sf:TextMax64Type",0],["NifRepresentante","sf:NIFType",0],["FechaFinVeriFactu","sf:fecha",0],["Incidencia","sf:IncidenciaType",0]],
  "IndicadorPaginacionType": {e:["S","N"]},
  "ResultadoConsultaType": {e:["ConDatos","SinDatos"]},
  "ErrorDetalleType": {b:"xs:integer"},
  "EstadoRegistroType": {e:["Correcto","AceptadoConErrores","Anulado"]},
}, {"RespuestaConsultaFactuSistemaFacturacion":"RespuestaConsultaFactuSistemaFacturacionType"});
