// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import { decodeSchema } from '../schema-decode.ts';


/** Metadatos de SuministroLR.xsd. */
export const SFLR = /* @__PURE__ */ decodeSchema("sfLR", {
  "RegFactuSistemaFacturacionType": [["Cabecera","sf:CabeceraType"],["RegistroFactura","RegistroFacturaType",1,1000]],
  "RegistroFacturaType": [{c:[[["RegistroAlta","sf:RegistroFacturacionAltaType",1,1,"sf"]],[["RegistroAnulacion","sf:RegistroFacturacionAnulacionType",1,1,"sf"]]]}],
}, {"RegFactuSistemaFacturacion":"RegFactuSistemaFacturacionType"});
