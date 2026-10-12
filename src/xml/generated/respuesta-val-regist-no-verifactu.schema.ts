// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import { decodeSchema } from '../schema-decode.ts';


/** Metadatos de RespuestaValRegistNoVeriFactu.xsd. */
export const SFVNV = /* @__PURE__ */ decodeSchema("sfVNV", {
  "RespuestaValContenidoFactuSistemaFacturacionType": [{c:[[["DescripcionErrorFormatoXML","sf:TextMax1500Type"]],[["RespuestaValidacion","RespuestaRegType"]]]}],
  "RespuestaRegType": [["IDFactura","sf:IDFacturaExpedidaType"],["Operacion","sf:OperacionType"],["RefExterna","sf:TextMax60Type",0],["EstadoRegistro","EstadoRegistroType"],["CodigoErrorRegistro","ErrorDetalleType",0],["DescripcionErrorRegistro","sf:TextMax1500Type",0]],
  "EstadoEnvioType": {e:["Correcto","ParcialmenteCorrecto","Incorrecto"]},
  "EstadoRegistroType": {e:["Correcto","AceptadoConErrores","Incorrecto"]},
  "ErrorDetalleType": {b:"xs:integer"},
}, {"RespuestaValContenidoFactuSistemaFacturacion":"RespuestaValContenidoFactuSistemaFacturacionType"});
