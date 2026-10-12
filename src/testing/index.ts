/**
 * verifactu-ts/testing — AEAT simulada en memoria para tests de integradores.
 *
 * Responde como el servicio web real a envíos y consultas, sin red ni certificado: valida el XML
 * contra el esquema, aplica las reglas de validación de la librería, detecta duplicados,
 * anulaciones de registros inexistentes y huellas incorrectas, y pagina las consultas.
 *
 * **No sustituye** a las pruebas en el entorno de pruebas de la AEAT: no comprueba censo, NIF ni
 * apoderamientos, y la AEAT puede aplicar validaciones que la librería no conoce.
 *
 * @example
 * const aeat = createFakeAeat();
 * const client = new AeatClient({ transport: aeat.transport, environment: 'test', certificateType: 'personal', taxpayer });
 *
 * @packageDocumentation
 */
import type { Transport, TransportRequest } from '../client/transport.ts';
import { fromAeatDate } from '../common/dates.ts';
import { XmlSchemaError } from '../common/errors.ts';
import { verifyHash } from '../hash/hash.ts';
import type { InvoiceIdentifier } from '../models/identifiers.ts';
import type { InvoiceRecord } from '../models/records.ts';
import { validateRecord } from '../validation/validate.ts';
import type { ConsultaFactuSistemaFacturacionType } from '../xml/generated/consulta-lr.ts';
import { SFLRC } from '../xml/generated/consulta-lr.schema.ts';
import { NAMESPACES } from '../xml/generated/namespaces.ts';
import type { RegistroRespuestaConsultaRegFacturacionType } from '../xml/generated/respuesta-consulta-lr.ts';
import { SFLRRC } from '../xml/generated/respuesta-consulta-lr.schema.ts';
import type { RespuestaExpedidaType } from '../xml/generated/respuesta-suministro.ts';
import { SFR } from '../xml/generated/respuesta-suministro.schema.ts';
import type { IDFacturaExpedidaType } from '../xml/generated/suministro-informacion.ts';
import { SF } from '../xml/generated/suministro-informacion.schema.ts';
import type { RegFactuSistemaFacturacionType } from '../xml/generated/suministro-lr.ts';
import { SFLR } from '../xml/generated/suministro-lr.schema.ts';
import { childElement, parseXml, readWire } from '../xml/reader.ts';
import { cancellationFromWire, registrationFromWire, recordToWire } from '../xml/records.ts';
import { mergeSchemas } from '../xml/schema-decode.ts';
import { assertWire, elementType } from '../xml/schema-walk.ts';
import { SOAP_ENV_NS, soapEnvelope } from '../xml/soap.ts';
import { escapeText, writeElement } from '../xml/writer.ts';

const IN = mergeSchemas(SF, SFLR, SFLRC);
const OUT = mergeSchemas(SF, SFLR, SFR, SFLRRC);

/** Registro almacenado en la AEAT simulada. */
export interface StoredRecord {
  readonly record: InvoiceRecord;
  readonly status: 'Correcto' | 'AceptadoConErrores';
  readonly errorCode?: number;
  readonly cancelled: boolean;
  readonly requestId: string;
  readonly submittedAt: string;
}

export interface FakeAeatOptions {
  /** Fecha «actual» para las validaciones (`AAAA-MM-DD`). Por defecto, la real. */
  readonly today?: string;
  /** `TiempoEsperaEnvio` que se devuelve. Por defecto, 60. */
  readonly waitSeconds?: number;
  /** Registros por página en las consultas. Por defecto, 10 000 (como la AEAT). */
  readonly pageSize?: number;
}

export interface FakeAeat {
  readonly transport: Transport;
  /** Registros almacenados, por clave `emisor|número|fecha`. */
  readonly records: ReadonlyMap<string, StoredRecord>;
  /** Peticiones recibidas, en orden. */
  readonly requests: readonly TransportRequest[];
}

const keyOf = (id: InvoiceIdentifier) => `${id.issuerId}|${id.invoiceNumber}|${id.issueDate}`;
const idWire = (id: InvoiceIdentifier): IDFacturaExpedidaType => ({
  IDEmisorFactura: id.issuerId,
  NumSerieFactura: id.invoiceNumber,
  FechaExpedicionFactura: id.issueDate.split('-').reverse().join('-'),
});

function fault(code: 'Client' | 'Server', message: string) {
  const body = `<soapenv:Fault><faultcode>soapenv:${code}</faultcode><faultstring>${escapeText(message)}</faultstring></soapenv:Fault>`;
  return { status: 500, body: soapEnvelope(body) };
}

/** Crea una AEAT simulada. */
export function createFakeAeat(options: FakeAeatOptions = {}): FakeAeat {
  const records = new Map<string, StoredRecord>();
  const requests: TransportRequest[] = [];
  let sequence = 0;

  const transport: Transport = async (req) => {
    requests.push(req);
    let payload;
    try {
      const env = parseXml(req.body);
      payload =
        env.ns === SOAP_ENV_NS ? childElement(env, SOAP_ENV_NS, 'Body')?.children[0] : undefined;
    } catch {
      return fault('Client', 'Codigo[4103].Se ha producido un error inesperado al parsear el XML.');
    }
    if (payload?.ns === NAMESPACES.sfLR && payload.local === 'RegFactuSistemaFacturacion') {
      const type = elementType(IN, 'sfLR:RegFactuSistemaFacturacion');
      let wire: RegFactuSistemaFacturacionType;
      try {
        wire = readWire(IN, type, payload, req.body) as RegFactuSistemaFacturacionType;
        assertWire(IN, type, wire, payload.local);
      } catch (e) {
        if (e instanceof XmlSchemaError)
          return fault('Client', `Codigo[4102].El XML no cumple el esquema. ${e.message}`);
        throw e;
      }
      return { status: 200, body: await submission(wire) };
    }
    if (payload?.ns === NAMESPACES.sfLRC && payload.local === 'ConsultaFactuSistemaFacturacion') {
      const type = elementType(IN, 'sfLRC:ConsultaFactuSistemaFacturacion');
      const wire = readWire(IN, type, payload, req.body) as ConsultaFactuSistemaFacturacionType;
      return { status: 200, body: query(wire) };
    }
    return fault('Client', 'Codigo[4102].El XML no cumple el esquema. Operación no reconocida.');
  };

  async function submission(wire: RegFactuSistemaFacturacionType): Promise<string> {
    const nif = wire.Cabecera.ObligadoEmision.NIF;
    const requestId = String(++sequence).padStart(12, '0');
    const now = new Date().toISOString().slice(0, 19) + '+00:00';
    const lines: RespuestaExpedidaType[] = [];
    for (const rf of wire.RegistroFactura) {
      const record: InvoiceRecord = rf.RegistroAlta
        ? registrationFromWire(rf.RegistroAlta)
        : cancellationFromWire(rf.RegistroAnulacion);
      const key = keyOf(record.invoiceId);
      const existing = records.get(key);
      const reject = (code: number, description: string, duplicate?: StoredRecord): void => {
        lines.push({
          ...line(record),
          EstadoRegistro: 'Incorrecto',
          CodigoErrorRegistro: String(code),
          DescripcionErrorRegistro: description,
          ...(duplicate && {
            RegistroDuplicado: {
              IdPeticionRegistroDuplicado: duplicate.requestId,
              EstadoRegistroDuplicado: duplicate.cancelled
                ? 'Anulada'
                : duplicate.status === 'Correcto'
                  ? 'Correcta'
                  : 'AceptadaConErrores',
            },
          }),
        });
      };

      if (record.invoiceId.issuerId !== nif) {
        reject(
          1108,
          'El NIF del IDEmisorFactura debe ser el mismo que el NIF del ObligadoEmision.',
        );
        continue;
      }
      const violations = validateRecord(record, {
        ...(options.today !== undefined && { today: options.today }),
        taxpayerNif: nif,
      });
      const error = violations.find((v) => v.severity === 'error');
      if (error) {
        reject(error.aeatCode ?? 1100, error.message);
        continue;
      }
      if (record.kind === 'registration') {
        if (existing && !existing.cancelled && !record.isCorrection) {
          reject(3000, 'Registro de facturación duplicado.', existing);
          continue;
        }
        if (!existing && record.isCorrection && record.priorRejection !== 'X') {
          reject(3002, 'No existe el registro de facturación.');
          continue;
        }
      } else {
        if (existing?.cancelled) {
          reject(3001, 'El registro de facturación ya ha sido dado de baja.');
          continue;
        }
        if (!existing && !record.withoutPriorRecord) {
          reject(3002, 'No existe el registro de facturación.');
          continue;
        }
      }
      const admissible = violations.find((v) => v.severity === 'admisible');
      const hashOk = await verifyHash(record);
      const code = !hashOk ? 2000 : admissible?.aeatCode;
      const status = code === undefined ? 'Correcto' : 'AceptadoConErrores';
      records.set(key, {
        record: existing && record.kind === 'cancellation' ? existing.record : record,
        status: existing && record.kind === 'cancellation' ? existing.status : status,
        ...(code !== undefined && { errorCode: code }),
        cancelled: record.kind === 'cancellation',
        requestId,
        submittedAt: now,
      });
      lines.push({
        ...line(record),
        EstadoRegistro: status,
        ...(code !== undefined && {
          CodigoErrorRegistro: String(code),
          DescripcionErrorRegistro: !hashOk
            ? 'El cálculo de la huella suministrada es incorrecta.'
            : (admissible?.message ?? ''),
        }),
      });
    }
    const ok = lines.filter((l) => l.EstadoRegistro === 'Correcto').length;
    const bad = lines.filter((l) => l.EstadoRegistro === 'Incorrecto').length;
    const estado =
      bad === lines.length
        ? 'Incorrecto'
        : ok === lines.length
          ? 'Correcto'
          : 'ParcialmenteCorrecto';
    const response = writeElement(OUT, 'sfR:RespuestaRegFactuSistemaFacturacion', {
      ...(estado !== 'Incorrecto' && { CSV: `FAKE${requestId}`.slice(0, 16) }),
      ...(estado !== 'Incorrecto' && {
        DatosPresentacion: { NIFPresentador: nif, TimestampPresentacion: now },
      }),
      Cabecera: wire.Cabecera,
      TiempoEsperaEnvio: String(options.waitSeconds ?? 60),
      EstadoEnvio: estado,
      ...(lines.length > 0 && { RespuestaLinea: lines }),
    });
    return soapEnvelope(response);
  }

  function line(
    record: InvoiceRecord,
  ): Pick<RespuestaExpedidaType, 'IDFactura' | 'Operacion' | 'RefExterna'> {
    return {
      IDFactura: idWire(record.invoiceId),
      Operacion: {
        TipoOperacion: record.kind === 'registration' ? 'Alta' : 'Anulacion',
        ...(record.kind === 'registration' && record.isCorrection && { Subsanacion: 'S' as const }),
      },
      ...(record.externalReference !== undefined && { RefExterna: record.externalReference }),
    };
  }

  function query(wire: ConsultaFactuSistemaFacturacionType): string {
    const f = wire.FiltroConsulta;
    const nif = wire.Cabecera.ObligadoEmision?.NIF;
    const period = `${f.PeriodoImputacion.Ejercicio}-${f.PeriodoImputacion.Periodo}`;
    const matching = [...records.values()]
      .filter(
        (s) =>
          s.record.invoiceId.issuerId === nif && s.record.invoiceId.issueDate.startsWith(period),
      )
      .filter(
        (s) =>
          f.NumSerieFactura === undefined || s.record.invoiceId.invoiceNumber === f.NumSerieFactura,
      );
    const startKey =
      f.ClavePaginacion &&
      keyOf({
        issuerId: f.ClavePaginacion.IDEmisorFactura,
        invoiceNumber: f.ClavePaginacion.NumSerieFactura,
        issueDate: fromAeatDate(f.ClavePaginacion.FechaExpedicionFactura),
      });
    const start =
      startKey === undefined
        ? 0
        : matching.findIndex((s) => keyOf(s.record.invoiceId) === startKey) + 1;
    const pageSize = options.pageSize ?? 10_000;
    const page = matching.slice(start, start + pageSize);
    const more = start + pageSize < matching.length;
    const last = page[page.length - 1];
    const items = page.map((s): RegistroRespuestaConsultaRegFacturacionType => {
      const w = recordToWire(s.record);
      const data =
        s.record.kind === 'registration' && 'TipoFactura' in w
          ? {
              TipoFactura: w.TipoFactura,
              CuotaTotal: w.CuotaTotal,
              ImporteTotal: w.ImporteTotal,
              Huella: w.Huella,
            }
          : {};
      return {
        IDFactura: idWire(s.record.invoiceId),
        DatosRegistroFacturacion: data,
        DatosPresentacion: {
          NIFPresentador: s.record.invoiceId.issuerId,
          TimestampPresentacion: s.submittedAt,
          IdPeticion: s.requestId,
        },
        EstadoRegistro: {
          TimestampUltimaModificacion: s.submittedAt,
          EstadoRegistro: s.cancelled ? 'Anulado' : s.status,
          ...(s.errorCode !== undefined && { CodigoErrorRegistro: String(s.errorCode) }),
        },
      };
    });
    const response = writeElement(OUT, 'sfLRRC:RespuestaConsultaFactuSistemaFacturacion', {
      Cabecera: wire.Cabecera,
      PeriodoImputacion: f.PeriodoImputacion,
      IndicadorPaginacion: more ? 'S' : 'N',
      ResultadoConsulta: page.length > 0 ? 'ConDatos' : 'SinDatos',
      ...(items.length > 0 && { RegistroRespuestaConsultaFactuSistemaFacturacion: items }),
      ...(more && last && { ClavePaginacion: idWire(last.record.invoiceId) }),
    });
    return soapEnvelope(response);
  }

  return { transport, records, requests };
}
