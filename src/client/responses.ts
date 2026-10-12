import { fromAeatDate } from '../common/dates.ts';
import { XmlParseError, XmlSchemaError } from '../common/errors.ts';
import type { InvoiceIdentifier } from '../models/identifiers.ts';
import { aeatErrorKind, type AeatErrorKind } from '../spec/errors.ts';
import { NAMESPACES } from '../xml/generated/namespaces.ts';
import type {
  RespuestaConsultaFactuSistemaFacturacionType,
  RespuestaDatosRegistroFacturacionType,
} from '../xml/generated/respuesta-consulta-lr.ts';
import { SFLRRC } from '../xml/generated/respuesta-consulta-lr.schema.ts';
import type { RespuestaRegFactuSistemaFacturacionType } from '../xml/generated/respuesta-suministro.ts';
import { SFR } from '../xml/generated/respuesta-suministro.schema.ts';
import type { IDFacturaExpedidaType } from '../xml/generated/suministro-informacion.ts';
import { SF } from '../xml/generated/suministro-informacion.schema.ts';
import { SFLR } from '../xml/generated/suministro-lr.schema.ts';
import { childElement, parseXml, readWire, type XmlElement } from '../xml/reader.ts';
import { mergeSchemas } from '../xml/schema-decode.ts';
import { elementType } from '../xml/schema-walk.ts';
import { SOAP_ENV_NS } from '../xml/soap.ts';
import { SoapFaultError, TransportError, UnexpectedResponseError } from './errors.ts';

const SUBMISSION_RESPONSE_SCHEMA = /* @__PURE__ */ mergeSchemas(SF, SFLR, SFR);
const QUERY_RESPONSE_SCHEMA = /* @__PURE__ */ mergeSchemas(SF, SFLRRC);

/** Error de la AEAT asociado a un registro. */
export interface RecordError {
  readonly code: number;
  /** Descripción que devuelve la AEAT. */
  readonly description: string;
  /** Clase del error según el catálogo, si el código es conocido. */
  readonly kind: AeatErrorKind | undefined;
}

/** Resultado de un registro dentro de un envío (`RespuestaLinea`). */
export interface SubmissionItem {
  readonly invoiceId: InvoiceIdentifier;
  readonly recordType: 'registration' | 'cancellation';
  readonly isCorrection: boolean;
  readonly externalReference?: string;
  readonly status: 'Correcto' | 'AceptadoConErrores' | 'Incorrecto';
  readonly error?: RecordError;
  /** Si se rechaza por duplicado: datos del registro que ya existe en la AEAT. */
  readonly duplicate?: {
    readonly requestId: string;
    readonly status: 'Correcta' | 'AceptadaConErrores' | 'Anulada';
    readonly error?: RecordError;
  };
}

/** Respuesta a un envío de registros (`RespuestaRegFactuSistemaFacturacion`). */
export interface SubmissionResponse {
  /** Estado global: todos correctos, alguno con errores o rechazados, o todos rechazados. */
  readonly status: 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto';
  /**
   * Código seguro de verificación del envío. **Hay que guardarlo**: la AEAT no lo vuelve a
   * proporcionar. No viene si se rechazan todos los registros.
   */
  readonly csv?: string;
  readonly submission?: { readonly submitterNif: string; readonly submittedAt: string };
  /** Segundos que hay que esperar antes del siguiente envío (`TiempoEsperaEnvio`). */
  readonly waitSeconds: number;
  readonly items: readonly SubmissionItem[];
  /** XML de la respuesta, para conservarlo o auditarlo. */
  readonly rawXml: string;
}

/** Registro devuelto por una consulta. */
export interface QueryRecord {
  readonly invoiceId: InvoiceIdentifier;
  readonly status: 'Correcto' | 'AceptadoConErrores' | 'Anulado';
  readonly error?: RecordError;
  /** Fecha y hora de la última modificación del registro en la AEAT. */
  readonly lastModifiedAt: string;
  readonly submission?: {
    readonly submitterNif: string;
    readonly submittedAt: string;
    readonly requestId: string;
  };
  /** Datos del registro tal como los devuelve la AEAT (estructura del XSD). */
  readonly data: RespuestaDatosRegistroFacturacionType;
}

/** Una página de resultados de consulta. */
export interface QueryPage {
  readonly records: readonly QueryRecord[];
  /** Clave para pedir la página siguiente, o `undefined` si no hay más. */
  readonly nextPageKey: InvoiceIdentifier | undefined;
  readonly rawXml: string;
}

// ---------------------------------------------------------------------------------------------

const idFromWire = (w: IDFacturaExpedidaType): InvoiceIdentifier => ({
  issuerId: w.IDEmisorFactura,
  invoiceNumber: w.NumSerieFactura,
  issueDate: fromAeatDate(w.FechaExpedicionFactura),
});

function recordError(
  code: string | undefined,
  description: string | undefined,
): RecordError | undefined {
  if (code === undefined) return undefined;
  const n = Number(code);
  return { code: n, description: description ?? '', kind: aeatErrorKind(n) };
}

/**
 * Abre el sobre SOAP: devuelve el primer hijo de `Body` o lanza el error que corresponda.
 *
 * @throws SoapFaultError si la AEAT devuelve un SOAP Fault.
 * @throws TransportError si la respuesta no es XML (p. ej. una página HTML de error).
 */
export function openEnvelope(status: number, body: string): { payload: XmlElement; xml: string } {
  let root: XmlElement;
  try {
    root = parseXml(body);
  } catch (cause) {
    if (cause instanceof XmlParseError) {
      throw new TransportError(`Respuesta no válida de la AEAT (HTTP ${status}): no es XML.`, {
        status,
        body,
        cause,
      });
    }
    throw cause;
  }
  const bodyEl =
    root.ns === SOAP_ENV_NS && root.local === 'Envelope'
      ? childElement(root, SOAP_ENV_NS, 'Body')
      : undefined;
  const payload = bodyEl?.children[0];
  if (!payload)
    throw new TransportError(
      `Respuesta no válida de la AEAT (HTTP ${status}): no es un sobre SOAP.`,
      { status, body },
    );
  if (payload.ns === SOAP_ENV_NS && payload.local === 'Fault') {
    const text = (local: string) =>
      payload.children.find((c) => c.local === local)?.text.trim() ?? '';
    throw new SoapFaultError(text('faultcode'), text('faultstring'));
  }
  if (status < 200 || status >= 300) {
    throw new TransportError(`Respuesta HTTP ${status} inesperada de la AEAT.`, { status, body });
  }
  return { payload, xml: body };
}

function readPayload(
  payload: XmlElement,
  xml: string,
  element: string,
  schema: typeof SUBMISSION_RESPONSE_SCHEMA,
): unknown {
  const [key, local] = element.split(':') as [keyof typeof NAMESPACES, string];
  if (payload.ns !== NAMESPACES[key] || payload.local !== local) {
    throw new UnexpectedResponseError(
      `Se esperaba <${local}> en la respuesta y se ha recibido <${payload.local}>.`,
    );
  }
  try {
    // Se ignoran elementos desconocidos por si la AEAT añade campos nuevos a las respuestas.
    return readWire(schema, elementType(schema, element), payload, xml, {
      unknownElements: 'ignore',
    });
  } catch (cause) {
    if (cause instanceof XmlSchemaError)
      throw new UnexpectedResponseError(`Respuesta con estructura inesperada: ${cause.message}`, {
        cause,
      });
    throw cause;
  }
}

/** Interpreta la respuesta a un envío de registros. */
export function parseSubmissionResponse(status: number, body: string): SubmissionResponse {
  const { payload, xml } = openEnvelope(status, body);
  const w = readPayload(
    payload,
    xml,
    'sfR:RespuestaRegFactuSistemaFacturacion',
    SUBMISSION_RESPONSE_SCHEMA,
  ) as RespuestaRegFactuSistemaFacturacionType;
  const items = (w.RespuestaLinea ?? []).map((l): SubmissionItem => {
    const error = recordError(l.CodigoErrorRegistro, l.DescripcionErrorRegistro);
    const d = l.RegistroDuplicado;
    const dupError = d && recordError(d.CodigoErrorRegistro, d.DescripcionErrorRegistro);
    return {
      invoiceId: idFromWire(l.IDFactura),
      recordType: l.Operacion.TipoOperacion === 'Alta' ? 'registration' : 'cancellation',
      isCorrection: l.Operacion.Subsanacion === 'S',
      ...(l.RefExterna !== undefined && { externalReference: l.RefExterna }),
      status: l.EstadoRegistro,
      ...(error && { error }),
      ...(d && {
        duplicate: {
          requestId: d.IdPeticionRegistroDuplicado,
          status: d.EstadoRegistroDuplicado,
          ...(dupError && { error: dupError }),
        },
      }),
    };
  });
  return {
    status: w.EstadoEnvio,
    ...(w.CSV !== undefined && { csv: w.CSV }),
    ...(w.DatosPresentacion && {
      submission: {
        submitterNif: w.DatosPresentacion.NIFPresentador,
        submittedAt: w.DatosPresentacion.TimestampPresentacion,
      },
    }),
    waitSeconds: w.TiempoEsperaEnvio === '' ? 0 : Number(w.TiempoEsperaEnvio),
    items,
    rawXml: xml,
  };
}

/** Interpreta la respuesta a una consulta. */
export function parseQueryResponse(status: number, body: string): QueryPage {
  const { payload, xml } = openEnvelope(status, body);
  const w = readPayload(
    payload,
    xml,
    'sfLRRC:RespuestaConsultaFactuSistemaFacturacion',
    QUERY_RESPONSE_SCHEMA,
  ) as RespuestaConsultaFactuSistemaFacturacionType;
  const records = (w.RegistroRespuestaConsultaFactuSistemaFacturacion ?? []).map(
    (r): QueryRecord => {
      const error = recordError(
        r.EstadoRegistro.CodigoErrorRegistro,
        r.EstadoRegistro.DescripcionErrorRegistro,
      );
      const p = r.DatosPresentacion;
      return {
        invoiceId: idFromWire(r.IDFactura),
        status: r.EstadoRegistro.EstadoRegistro,
        ...(error && { error }),
        lastModifiedAt: r.EstadoRegistro.TimestampUltimaModificacion,
        ...(p && {
          submission: {
            submitterNif: p.NIFPresentador,
            submittedAt: p.TimestampPresentacion,
            requestId: p.IdPeticion,
          },
        }),
        data: r.DatosRegistroFacturacion,
      };
    },
  );
  const key = w.IndicadorPaginacion === 'S' ? w.ClavePaginacion : undefined;
  return {
    records,
    nextPageKey: key && idFromWire(key),
    rawXml: xml,
  };
}
