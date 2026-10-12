import { toAeatDate, type IsoDate } from '../common/dates.ts';
import type { FiscalIdentifier } from '../models/identifiers.ts';
import type { InvoiceRecord } from '../models/records.ts';
import type { CabeceraType } from './generated/suministro-informacion.ts';
import type { RegFactuSistemaFacturacionType } from './generated/suministro-lr.ts';
import { cancellationToWire, registrationToWire } from './records.ts';
import { SF } from './generated/suministro-informacion.schema.ts';
import { SFLR } from './generated/suministro-lr.schema.ts';
import { mergeSchemas } from './schema-decode.ts';
import { writeElement } from './writer.ts';

const SUBMISSION_SCHEMA = /* @__PURE__ */ mergeSchemas(SF, SFLR);

export const SOAP_ENV_NS = 'http://schemas.xmlsoap.org/soap/envelope/';

/** Datos de la cabecera de un envío (`Cabecera`). */
export interface SubmissionHeader {
  /** Obligado a expedir las facturas (`ObligadoEmision`). */
  readonly taxpayer: FiscalIdentifier;
  /** Representante o asesor que genera los registros, si lo hay (`Representante`). */
  readonly representative?: FiscalIdentifier;
  /**
   * Remisión voluntaria (solo VERI*FACTU): fecha en que el sistema deja de remitir de forma
   * voluntaria (`FechaFinVeriFactu`) y/o indicador de incidencia (`Incidencia`).
   */
  readonly voluntaryRemission?: {
    readonly endDate?: IsoDate;
    readonly incident?: boolean;
  };
  /** Remisión por requerimiento (solo NO VERI*FACTU): referencia y si es el último envío. */
  readonly requirement?: {
    readonly reference: string;
    readonly isLast?: boolean;
  };
}

function header(h: SubmissionHeader): CabeceraType {
  const vr = h.voluntaryRemission;
  const rq = h.requirement;
  return {
    ObligadoEmision: { NombreRazon: h.taxpayer.name, NIF: h.taxpayer.nif },
    ...(h.representative && {
      Representante: { NombreRazon: h.representative.name, NIF: h.representative.nif },
    }),
    ...(vr && {
      RemisionVoluntaria: {
        ...(vr.endDate !== undefined && { FechaFinVeriFactu: toAeatDate(vr.endDate) }),
        ...(vr.incident !== undefined && { Incidencia: vr.incident ? 'S' : 'N' }),
      },
    }),
    ...(rq && {
      RemisionRequerimiento: {
        RefRequerimiento: rq.reference,
        ...(rq.isLast !== undefined && { FinRequerimiento: rq.isLast ? 'S' : 'N' }),
      },
    }),
  };
}

/** Construye el objeto XSD `RegFactuSistemaFacturacion` (cabecera + registros). */
export function submissionToWire(
  h: SubmissionHeader,
  records: readonly InvoiceRecord[],
): RegFactuSistemaFacturacionType {
  return {
    Cabecera: header(h),
    RegistroFactura: records.map((r) =>
      r.kind === 'registration'
        ? { RegistroAlta: registrationToWire(r) }
        : { RegistroAnulacion: cancellationToWire(r) },
    ),
  };
}

/**
 * Serializa el cuerpo de un envío de registros (`<sum:RegFactuSistemaFacturacion>`), validándolo
 * contra el XSD.
 *
 * @throws XmlSchemaError si no se ajusta al esquema (p. ej. más de 1000 registros).
 */
export function buildSubmissionXml(h: SubmissionHeader, records: readonly InvoiceRecord[]): string {
  return writeElement(
    SUBMISSION_SCHEMA,
    'sfLR:RegFactuSistemaFacturacion',
    submissionToWire(h, records),
  );
}

/** Envuelve un cuerpo XML en un sobre SOAP 1.1. */
export function soapEnvelope(bodyXml: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_ENV_NS}"><soapenv:Header/><soapenv:Body>${bodyXml}</soapenv:Body></soapenv:Envelope>`
  );
}
