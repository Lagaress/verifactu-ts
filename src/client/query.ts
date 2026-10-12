import { toAeatDate, type IsoDate } from '../common/dates.ts';
import { InvalidArgumentError } from '../common/errors.ts';
import type { FiscalIdentifier, InvoiceIdentifier, Party } from '../models/identifiers.ts';
import { SPEC_VERSION } from '../spec/version.ts';
import type { ConsultaFactuSistemaFacturacionType } from '../xml/generated/consulta-lr.ts';
import { SFLRC } from '../xml/generated/consulta-lr.schema.ts';
import type { TipoPeriodoType } from '../xml/generated/suministro-informacion.ts';
import { SF } from '../xml/generated/suministro-informacion.schema.ts';
import { mergeSchemas } from '../xml/schema-decode.ts';
import { writeElement } from '../xml/writer.ts';

const QUERY_SCHEMA = /* @__PURE__ */ mergeSchemas(SF, SFLRC);

/** Filtro de consulta de registros (`FiltroConsulta`). */
export interface QueryFilter {
  /** Ejercicio (año) del periodo de imputación. */
  readonly year: number;
  /** Mes del periodo de imputación (1–12). */
  readonly month: number;
  /** Número y serie de la factura. */
  readonly invoiceNumber?: string;
  /** Contraparte (destinatario si se consulta como emisor, y viceversa). */
  readonly counterparty?: Party;
  /** Fecha de expedición exacta o rango. */
  readonly issueDate?: IsoDate | { readonly from?: IsoDate; readonly to?: IsoDate };
  /** Referencia externa (`RefExterna`). */
  readonly externalReference?: string;
  /** Devolver el nombre del emisor en cada registro. */
  readonly showIssuerName?: boolean;
  /** Devolver el sistema informático de cada registro (aumenta el tiempo de respuesta). */
  readonly showSystem?: boolean;
}

export interface QueryContext {
  readonly taxpayer: FiscalIdentifier;
  /** Consultar como destinatario (facturas recibidas) en lugar de como emisor. */
  readonly asRecipient?: boolean;
  /** Se consulta a través de un representante (`IndicadorRepresentante = S`). */
  readonly viaRepresentative?: boolean;
}

/** Construye el cuerpo de una consulta (`<con:ConsultaFactuSistemaFacturacion>`). */
export function buildQueryXml(
  filter: QueryFilter,
  context: QueryContext,
  pageKey?: InvoiceIdentifier,
): string {
  if (!Number.isInteger(filter.year) || filter.year < 1000 || filter.year > 9999) {
    throw new InvalidArgumentError(`Ejercicio no válido: ${filter.year}`);
  }
  if (!Number.isInteger(filter.month) || filter.month < 1 || filter.month > 12) {
    throw new InvalidArgumentError(`Mes no válido (1–12): ${filter.month}`);
  }
  if (context.asRecipient && filter.showSystem) {
    throw new InvalidArgumentError(
      'Al consultar como destinatario no se puede pedir el sistema informático.',
    );
  }
  const party = { NombreRazon: context.taxpayer.name, NIF: context.taxpayer.nif };
  const cp = filter.counterparty;
  const date = filter.issueDate;
  const wire: ConsultaFactuSistemaFacturacionType = {
    Cabecera: {
      IDVersion: SPEC_VERSION.idVersion,
      ...(context.asRecipient ? { Destinatario: party } : { ObligadoEmision: party }),
      ...(context.viaRepresentative && { IndicadorRepresentante: 'S' as const }),
    },
    FiltroConsulta: {
      PeriodoImputacion: {
        Ejercicio: String(filter.year),
        Periodo: String(filter.month).padStart(2, '0') as TipoPeriodoType,
      },
      ...(filter.invoiceNumber !== undefined && { NumSerieFactura: filter.invoiceNumber }),
      ...(cp && {
        Contraparte:
          'nif' in cp
            ? { NombreRazon: cp.name, NIF: cp.nif }
            : {
                NombreRazon: cp.name,
                IDOtro: {
                  ...(cp.country && { CodigoPais: cp.country }),
                  IDType: cp.type,
                  ID: cp.value,
                },
              },
      }),
      ...(date !== undefined && {
        FechaExpedicionFactura:
          typeof date === 'string'
            ? { FechaExpedicionFactura: toAeatDate(date) }
            : {
                RangoFechaExpedicion: {
                  ...(date.from !== undefined && { Desde: toAeatDate(date.from) }),
                  ...(date.to !== undefined && { Hasta: toAeatDate(date.to) }),
                },
              },
      }),
      ...(filter.externalReference !== undefined && { RefExterna: filter.externalReference }),
      ...(pageKey && {
        ClavePaginacion: {
          IDEmisorFactura: pageKey.issuerId,
          NumSerieFactura: pageKey.invoiceNumber,
          FechaExpedicionFactura: toAeatDate(pageKey.issueDate),
        },
      }),
    },
    ...((filter.showIssuerName !== undefined || filter.showSystem !== undefined) && {
      DatosAdicionalesRespuesta: {
        ...(filter.showIssuerName !== undefined && {
          MostrarNombreRazonEmisor: filter.showIssuerName ? 'S' : 'N',
        }),
        ...(filter.showSystem !== undefined && {
          MostrarSistemaInformatico: filter.showSystem ? 'S' : 'N',
        }),
      },
    }),
  };
  return writeElement(QUERY_SCHEMA, 'sfLRC:ConsultaFactuSistemaFacturacion', wire);
}
