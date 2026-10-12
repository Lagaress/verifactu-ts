// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import { decodeSchema } from '../schema-decode.ts';


/** Metadatos de RespuestaSuministro.xsd. */
export const SFR = /* @__PURE__ */ decodeSchema("sfR", {
  "RespuestaBaseType": [["CSV","xs:string",0],["DatosPresentacion","sf:DatosPresentacionType",0],["Cabecera","sf:CabeceraType"],["TiempoEsperaEnvio","sf:Tipo6Type"],["EstadoEnvio","EstadoEnvioType"]],
  "RespuestaRegFactuSistemaFacturacionType": [["CSV","xs:string",0],["DatosPresentacion","sf:DatosPresentacionType",0],["Cabecera","sf:CabeceraType"],["TiempoEsperaEnvio","sf:Tipo6Type"],["EstadoEnvio","EstadoEnvioType"],["RespuestaLinea","RespuestaExpedidaType",0,1000]],
  "RespuestaExpedidaType": [["IDFactura","sf:IDFacturaExpedidaType"],["Operacion","sf:OperacionType"],["RefExterna","sf:TextMax60Type",0],["EstadoRegistro","EstadoRegistroType"],["CodigoErrorRegistro","ErrorDetalleType",0],["DescripcionErrorRegistro","sf:TextMax1500Type",0],["RegistroDuplicado","sf:RegistroDuplicadoType",0]],
  "EstadoEnvioType": {e:["Correcto","ParcialmenteCorrecto","Incorrecto"]},
  "EstadoRegistroType": {e:["Correcto","AceptadoConErrores","Incorrecto"]},
  "ErrorDetalleType": {b:"xs:integer"},
}, {"RespuestaRegFactuSistemaFacturacion":"RespuestaRegFactuSistemaFacturacionType"});
