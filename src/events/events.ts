import {
  formatDateTimeWithOffset,
  isDateTimeWithOffset,
  type DateTimeWithOffset,
} from '../common/dates.ts';
import { InvalidArgumentError, ValidationError, XmlSchemaError } from '../common/errors.ts';
import { sha256Hex } from '../hash/hash.ts';
import type { ComputerSystem } from '../models/computer-system.ts';
import type { IssuedBy } from '../models/enums.ts';
import type { FiscalIdentifier, Party } from '../models/identifiers.ts';
import type { GenerationTime } from '../records/create.ts';
import { SPEC_VERSION } from '../spec/version.ts';
import { Collector } from '../validation/collector.ts';
import type { Violation } from '../validation/violation.ts';
import { signDocument, type SigningCredentials, type SignOptions } from '../xades/sign.ts';
import {
  CountryType2_VALUES as EVENT_COUNTRIES,
  type CountryType2 as EventCountry,
  type DatosPropiosEventoType,
  type EventoType,
  type RegistroEventoType,
  type SistemaInformaticoType,
  type TipoAnomaliaType,
  type TipoEventoType,
} from '../xml/generated/eventos-sif.ts';
import { SFEV } from '../xml/generated/eventos-sif.schema.ts';
import { NAMESPACES } from '../xml/generated/namespaces.ts';
import type { RawXml } from '../xml/raw-xml.ts';
import { parseXml, readWire } from '../xml/reader.ts';
import { assertWire, elementType } from '../xml/schema-walk.ts';
import { DEFAULT_PREFIXES, writeElement } from '../xml/writer.ts';

/**
 * Registros de evento de los sistemas NO VERI*FACTU (`EventosSIF.xsd`).
 *
 * Son obligatorios solo cuando el sistema funciona en modalidad NO VERI*FACTU (FAQ desarrolladores
 * v1.3, n.º 15). Cada evento se encadena con el anterior mediante su huella y **siempre va
 * firmado** (XAdES-EPES). No hay servicio web para enviarlos: el SIF los conserva y los exporta
 * cuando la AEAT los requiera.
 */

/** Tipo de evento (`TipoEvento`, lista L2E). */
export const EventType = {
  /** Inicio del funcionamiento como NO VERI*FACTU. */
  StartNoVerifactu: '01',
  /** Fin del funcionamiento como NO VERI*FACTU. */
  EndNoVerifactu: '02',
  /** Lanzamiento del proceso de detección de anomalías en los registros de facturación. */
  InvoiceAnomalyCheck: '03',
  /** Detección de anomalías en los registros de facturación. */
  InvoiceAnomalyDetected: '04',
  /** Lanzamiento del proceso de detección de anomalías en los registros de evento. */
  EventAnomalyCheck: '05',
  /** Detección de anomalías en los registros de evento. */
  EventAnomalyDetected: '06',
  /** Restauración de copia de seguridad. */
  BackupRestore: '07',
  /** Exportación de registros de facturación de un periodo. */
  InvoiceExport: '08',
  /** Exportación de registros de evento de un periodo. */
  EventExport: '09',
  /** Registro resumen de eventos. */
  Summary: '10',
  /** Otros eventos registrados voluntariamente por el productor. */
  Other: '90',
} as const satisfies Record<string, TipoEventoType>;
export type EventType = (typeof EventType)[keyof typeof EventType];

/** Tipo de anomalía (`TipoAnomalia`, lista L4E). Ver los valores en el XSD. */
export type AnomalyType = TipoAnomaliaType;

/** Datos específicos de cada tipo de evento (`DatosPropiosEvento`), con la estructura del XSD. */
export type EventDetails = DatosPropiosEventoType;

/** Enlace con el evento anterior (`Encadenamiento/EventoAnterior`). */
export interface EventChainLink {
  readonly eventType: EventType;
  readonly generatedAt: DateTimeWithOffset;
  readonly hash: string;
}

/** Registro de evento (`RegistroEvento`). */
export interface EventRecord {
  readonly kind: 'event';
  readonly system: ComputerSystem;
  /** Obligado a expedir las facturas (`ObligadoEmision`). */
  readonly taxpayer: FiscalIdentifier;
  /** Facturas expedidas por un tercero o por el destinatario (`EmitidaPorTerceroODestinatario`). */
  readonly issuedBy?: IssuedBy;
  /** Tercero o destinatario (`TerceroODestinatario`). */
  readonly counterparty?: Party;
  /** Fecha, hora y huso de generación (`FechaHoraHusoGenEvento`). */
  readonly generatedAt: DateTimeWithOffset;
  readonly eventType: EventType;
  readonly details?: EventDetails;
  /** Otros datos del evento (`OtrosDatosEvento`), hasta 100 caracteres. */
  readonly otherData?: string;
  /** Evento anterior de la cadena, o `null` si es el primero (`PrimerEvento = S`). */
  readonly previous: EventChainLink | null;
  /** Huella del evento (`HuellaEvento`). */
  readonly hash: string;
  /** Firma XAdES (obligatoria en los eventos). */
  readonly signature: RawXml;
}

export type EventRecordInput = Omit<EventRecord, 'kind' | 'hash' | 'signature' | 'generatedAt'> & {
  readonly generatedAt: GenerationTime;
};

// ---------------------------------------------------------------------------------------------

/** Cadena de entrada de la huella de un evento (Especificación de huella v0.1.2 §3.c). */
export function eventHashInput(
  e: Pick<EventRecord, 'system' | 'taxpayer' | 'eventType' | 'previous' | 'generatedAt'>,
): string {
  const fields: [string, string][] = [
    ['NIF', e.system.vendorNif ?? ''],
    ['ID', e.system.vendorForeignId?.value ?? ''],
    ['IdSistemaInformatico', e.system.id],
    ['Version', e.system.version],
    ['NumeroInstalacion', e.system.installationNumber],
    ['NIF', e.taxpayer.nif],
    ['TipoEvento', e.eventType],
    ['HuellaEvento', e.previous?.hash ?? ''],
    ['FechaHoraHusoGenEvento', e.generatedAt],
  ];
  return fields.map(([k, v]) => `${k}=${v.trim()}`).join('&');
}

/** Huella de un evento. */
export function calculateEventHash(e: Parameters<typeof eventHashInput>[0]): Promise<string> {
  return sha256Hex(eventHashInput(e));
}

/** Enlace que el siguiente evento debe usar para encadenarse con `event`. */
export function toEventChainLink(
  event: Pick<EventRecord, 'eventType' | 'generatedAt' | 'hash'>,
): EventChainLink {
  return { eventType: event.eventType, generatedAt: event.generatedAt, hash: event.hash };
}

// ---------------------------------------------------------------------------------------------

const sn = (v: boolean): 'S' | 'N' => (v ? 'S' : 'N');

/**
 * La lista de países de EventosSIF.xsd no incluye `RE` (Reunión), que sí admite
 * SuministroInformacion.xsd (ver docs/SPEC-NOTES.md).
 */
function eventCountry(country: string | undefined): { CodigoPais?: EventCountry } {
  if (country === undefined) return {};
  if (!(EVENT_COUNTRIES as readonly string[]).includes(country)) {
    throw new InvalidArgumentError(
      `El código de país ${country} no está admitido en los registros de evento (EventosSIF.xsd).`,
    );
  }
  return { CodigoPais: country as EventCountry };
}

function systemToWire(s: ComputerSystem): SistemaInformaticoType {
  const common = {
    NombreRazon: s.vendorName,
    NombreSistemaInformatico: s.name,
    IdSistemaInformatico: s.id,
    Version: s.version,
    NumeroInstalacion: s.installationNumber,
    TipoUsoPosibleSoloVerifactu: sn(s.onlySupportsVerifactu),
    TipoUsoPosibleMultiOT: sn(s.supportsMultipleTaxpayers),
    IndicadorMultiplesOT: sn(s.hasMultipleTaxpayers),
  };
  const f = s.vendorForeignId;
  return f
    ? {
        ...common,
        IDOtro: { ...eventCountry(f.country), IDType: f.type, ID: f.value },
      }
    : { ...common, NIF: s.vendorNif ?? '' };
}

function eventToWireUnsigned(e: Omit<EventRecord, 'signature'>): Omit<EventoType, 'Signature'> {
  const cp = e.counterparty;
  return {
    SistemaInformatico: systemToWire(e.system),
    ObligadoEmision: { NombreRazon: e.taxpayer.name, NIF: e.taxpayer.nif },
    ...(e.issuedBy && { EmitidaPorTerceroODestinatario: e.issuedBy }),
    ...(cp && {
      TerceroODestinatario:
        'nif' in cp
          ? { NombreRazon: cp.name, NIF: cp.nif }
          : {
              NombreRazon: cp.name,
              IDOtro: {
                ...eventCountry(cp.country),
                IDType: cp.type,
                ID: cp.value,
              },
            },
    }),
    FechaHoraHusoGenEvento: e.generatedAt,
    TipoEvento: e.eventType,
    ...(e.details && { DatosPropiosEvento: e.details }),
    ...(e.otherData !== undefined && { OtrosDatosEvento: e.otherData }),
    Encadenamiento: e.previous
      ? {
          EventoAnterior: {
            TipoEvento: e.previous.eventType,
            FechaHoraHusoGenEvento: e.previous.generatedAt,
            HuellaEvento: e.previous.hash,
          },
        }
      : { PrimerEvento: 'S' },
    TipoHuella: '01',
    HuellaEvento: e.hash,
  };
}

/** Serializa un evento como `<sf:RegistroEvento xmlns:sf="…EventosSIF.xsd">`, validándolo contra el XSD. */
export function eventToXml(e: EventRecord): string {
  const wire: RegistroEventoType = {
    IDVersion: SPEC_VERSION.idVersion,
    Evento: { ...eventToWireUnsigned(e), Signature: e.signature },
  };
  return writeElement(SFEV, 'sfEv:RegistroEvento', wire);
}

/** Lee un evento desde XML (`RegistroEvento` de EventosSIF.xsd). */
export function eventFromXml(xml: string): EventRecord {
  const root = parseXml(xml);
  if (root.ns !== NAMESPACES.sfEv || root.local !== 'RegistroEvento') {
    throw new XmlSchemaError(
      root.local,
      'se esperaba un elemento RegistroEvento de EventosSIF.xsd',
    );
  }
  const type = elementType(SFEV, 'sfEv:RegistroEvento');
  const w = readWire(SFEV, type, root, xml) as RegistroEventoType;
  assertWire(SFEV, type, w, root.local);
  const ev = w.Evento;
  const s = ev.SistemaInformatico;
  const t = ev.TerceroODestinatario;
  const yes = (v: string | undefined) => v === 'S';
  return {
    kind: 'event',
    system: {
      vendorName: s.NombreRazon,
      ...(s.NIF !== undefined
        ? { vendorNif: s.NIF }
        : {
            vendorForeignId: {
              ...(s.IDOtro.CodigoPais && { country: s.IDOtro.CodigoPais }),
              type: s.IDOtro.IDType,
              value: s.IDOtro.ID,
            },
          }),
      name: s.NombreSistemaInformatico ?? '',
      id: s.IdSistemaInformatico,
      version: s.Version,
      installationNumber: s.NumeroInstalacion,
      onlySupportsVerifactu: yes(s.TipoUsoPosibleSoloVerifactu),
      supportsMultipleTaxpayers: yes(s.TipoUsoPosibleMultiOT),
      hasMultipleTaxpayers: yes(s.IndicadorMultiplesOT),
    },
    taxpayer: { name: ev.ObligadoEmision.NombreRazon, nif: ev.ObligadoEmision.NIF },
    ...(ev.EmitidaPorTerceroODestinatario && { issuedBy: ev.EmitidaPorTerceroODestinatario }),
    ...(t && {
      counterparty:
        t.NIF !== undefined
          ? { name: t.NombreRazon, nif: t.NIF }
          : {
              name: t.NombreRazon,
              ...(t.IDOtro.CodigoPais && { country: t.IDOtro.CodigoPais }),
              type: t.IDOtro.IDType,
              value: t.IDOtro.ID,
            },
    }),
    generatedAt: ev.FechaHoraHusoGenEvento,
    eventType: ev.TipoEvento,
    ...(ev.DatosPropiosEvento && { details: ev.DatosPropiosEvento }),
    ...(ev.OtrosDatosEvento !== undefined && { otherData: ev.OtrosDatosEvento }),
    previous: ev.Encadenamiento.EventoAnterior
      ? {
          eventType: ev.Encadenamiento.EventoAnterior.TipoEvento,
          generatedAt: ev.Encadenamiento.EventoAnterior.FechaHoraHusoGenEvento,
          hash: ev.Encadenamiento.EventoAnterior.HuellaEvento,
        }
      : null,
    hash: ev.HuellaEvento,
    signature: ev.Signature,
  };
}

// ---------------------------------------------------------------------------------------------

/** Valida los datos de un evento que no comprueba el esquema. */
export function validateEvent(
  e: Omit<EventRecord, 'signature' | 'hash'> & { readonly hash?: string },
): Violation[] {
  const c = new Collector();
  c.check(
    isDateTimeWithOffset(e.generatedAt),
    'generatedAt',
    'event.datetime',
    'Fecha y hora no válida (AAAA-MM-DDThh:mm:ss±hh:mm).',
  );
  c.check(
    e.taxpayer.nif.length === 9,
    'taxpayer.nif',
    'format.nif',
    'El NIF debe tener 9 caracteres.',
  );
  c.check(
    /^[A-Z0-9]{2}$/.test(e.system.id),
    'system.id',
    'business.system-id',
    'IdSistemaInformatico debe tener 2 posiciones en mayúsculas o dígitos.',
  );
  c.check(
    (e.system.vendorNif === undefined) !== (e.system.vendorForeignId === undefined),
    'system',
    'format.vendor-id',
    'Hay que informar exactamente uno de vendorNif o vendorForeignId.',
  );
  c.check(
    e.otherData === undefined || e.otherData.length <= 100,
    'otherData',
    'format.max-length',
    'Máximo 100 caracteres.',
  );
  c.check(
    e.issuedBy === undefined || e.counterparty !== undefined,
    'counterparty',
    'event.counterparty-required',
    'Con EmitidaPorTerceroODestinatario hay que informar el tercero o destinatario.',
  );
  if (e.previous) {
    c.check(
      /^[0-9A-F]{64}$/.test(e.previous.hash),
      'previous.hash',
      'format.previous-hash',
      'La huella del evento anterior debe tener 64 caracteres hexadecimales en mayúsculas.',
    );
  }
  return c.violations;
}

/**
 * Crea un registro de evento: calcula la huella, lo firma (la firma es obligatoria en los
 * eventos) y lo valida contra el esquema.
 *
 * @throws ValidationError si el evento incumple alguna regla.
 */
export async function createEventRecord(
  input: EventRecordInput,
  credentials: SigningCredentials,
  options: SignOptions = {},
): Promise<EventRecord> {
  const generatedAt =
    typeof input.generatedAt === 'string'
      ? input.generatedAt
      : input.generatedAt instanceof Date
        ? formatDateTimeWithOffset(input.generatedAt)
        : formatDateTimeWithOffset(input.generatedAt.instant, input.generatedAt.timeZone);
  const draft = { ...input, kind: 'event' as const, generatedAt };
  const violations = validateEvent(draft);
  if (violations.some((v) => v.severity === 'error'))
    throw new ValidationError(violations, 'El evento');
  const hash = await calculateEventHash(draft);
  const unsigned = { ...draft, hash };
  const wire = { IDVersion: SPEC_VERSION.idVersion, Evento: eventToWireUnsigned(unsigned) };
  // Sin la firma el evento no cumple el esquema (Signature es obligatoria): se valida al final.
  const unsignedXml = writeElement(SFEV, 'sfEv:RegistroEvento', wire, { validate: false });
  const raw = await signDocument(
    unsignedXml,
    { prefix: DEFAULT_PREFIXES.sfEv, ns: NAMESPACES.sfEv },
    credentials,
    options,
  );
  const event: EventRecord = { ...unsigned, signature: { raw } };
  try {
    eventToXml(event);
  } catch (cause) {
    if (cause instanceof XmlSchemaError)
      throw new InvalidArgumentError(`El evento no cumple EventosSIF.xsd: ${cause.message}`, {
        cause,
      });
    throw cause;
  }
  return event;
}

/** Problemas de una cadena de eventos (huellas y enlaces). */
export async function verifyEventChain(
  events: readonly EventRecord[],
  previous: EventChainLink | null = null,
): Promise<{ index: number; message: string }[]> {
  const issues: { index: number; message: string }[] = [];
  let expected = previous;
  for (const [index, e] of events.entries()) {
    if ((await calculateEventHash(e)) !== e.hash)
      issues.push({ index, message: 'La huella no corresponde a los datos del evento.' });
    const p = e.previous;
    const ok =
      expected === null
        ? p === null
        : p !== null &&
          p.hash === expected.hash &&
          p.eventType === expected.eventType &&
          p.generatedAt === expected.generatedAt;
    if (!ok)
      issues.push({ index, message: 'El evento no apunta al evento inmediatamente anterior.' });
    expected = toEventChainLink(e);
  }
  return issues;
}
