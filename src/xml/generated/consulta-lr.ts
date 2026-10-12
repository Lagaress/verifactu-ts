// GENERADO AUTOMÁTICAMENTE por scripts/gen-wire-types.ts a partir de spec/aeat/<versión>/xsd.
// No editar a mano: ejecutar `npm run gen:wire`.
/* eslint-disable */
import type { CabeceraConsultaSf, ContraparteConsultaType, FechaExpedicionConsultaType, IDFacturaExpedidaBCType, MostrarNombreRazonEmisorType, MostrarSistemaInformaticoType, PeriodoImputacionType, SistemaInformaticoConsultaType, TextMax60Type, TextoIDFacturaType } from './suministro-informacion.ts';

/** Namespace: https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/ConsultaLR.xsd */

export interface ConsultaFactuSistemaFacturacionType {
  readonly Cabecera: CabeceraConsultaSf;
  readonly FiltroConsulta: LRFiltroRegFacturacionType;
  readonly DatosAdicionalesRespuesta?: DatosAdicionalesRespuestaType;
}

export interface LRFiltroRegFacturacionType {
  readonly PeriodoImputacion: PeriodoImputacionType;
  /** Nº Serie+Nº Factura de la Factura del Emisor. */
  readonly NumSerieFactura?: TextoIDFacturaType;
  /** Contraparte del NIF de la cabecera que realiza la consulta. Obligado si la cosulta la realiza el Destinatario de los registros de facturacion. Destinatario si la cosulta la realiza el Obligado dde los registros de facturacion. */
  readonly Contraparte?: ContraparteConsultaType;
  readonly FechaExpedicionFactura?: FechaExpedicionConsultaType;
  readonly SistemaInformatico?: SistemaInformaticoConsultaType;
  readonly RefExterna?: TextMax60Type;
  readonly ClavePaginacion?: IDFacturaExpedidaBCType;
}

export interface DatosAdicionalesRespuestaType {
  /** Indicador que especifica si se quiere obtener en la respuesta el campo NombreRazonEmisor en la información del registro se facturacion. Si el Valor es S aumenta el tiempo de respuesta en la cosulta por detinatario */
  readonly MostrarNombreRazonEmisor?: MostrarNombreRazonEmisorType;
  /** Indicador que especifica si se quiere obtener en la respuesta el bloque SistemaInformatico en la información del registro se facturacion. Si el Valor es S aumenta el tiempo de respuesta en la cosulta. Si se consulta por Destinatario el valor del campo MostrarSistemaInformatico debe ser 'N' o no estar cumplimentado */
  readonly MostrarSistemaInformatico?: MostrarSistemaInformaticoType;
}

