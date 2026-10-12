// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import { decodeSchema } from '../schema-decode.ts';


/** Metadatos de ConsultaLR.xsd. */
export const SFLRC = /* @__PURE__ */ decodeSchema("sfLRC", {
  "ConsultaFactuSistemaFacturacionType": [["Cabecera","sf:CabeceraConsultaSf"],["FiltroConsulta","LRFiltroRegFacturacionType"],["DatosAdicionalesRespuesta","DatosAdicionalesRespuestaType",0]],
  "LRFiltroRegFacturacionType": [["PeriodoImputacion","sf:PeriodoImputacionType"],["NumSerieFactura","sf:TextoIDFacturaType",0],["Contraparte","sf:ContraparteConsultaType",0],["FechaExpedicionFactura","sf:FechaExpedicionConsultaType",0],["SistemaInformatico","sf:SistemaInformaticoConsultaType",0],["RefExterna","sf:TextMax60Type",0],["ClavePaginacion","sf:IDFacturaExpedidaBCType",0]],
  "DatosAdicionalesRespuestaType": [["MostrarNombreRazonEmisor","sf:MostrarNombreRazonEmisorType",0],["MostrarSistemaInformatico","sf:MostrarSistemaInformaticoType",0]],
}, {"ConsultaFactuSistemaFacturacion":"ConsultaFactuSistemaFacturacionType"});
