import { ValidationError } from '../common/errors.ts';
import type { ComputerSystem } from '../models/computer-system.ts';
import type { FiscalIdentifier, InvoiceIdentifier } from '../models/identifiers.ts';
import type { InvoiceRecord } from '../models/records.ts';
import {
  soapEndpoint,
  type CertificateType,
  type Environment,
  type Service,
} from '../spec/endpoints.ts';
import { Collector } from '../validation/collector.ts';
import { todayInMadrid } from '../validation/rules/business.ts';
import { validateRecord } from '../validation/validate.ts';
import type { Violation } from '../validation/violation.ts';
import { buildSubmissionXml, soapEnvelope, type SubmissionHeader } from '../xml/soap.ts';
import { BatchLimitError } from './errors.ts';
import { buildQueryXml, type QueryFilter } from './query.ts';
import {
  parseQueryResponse,
  parseSubmissionResponse,
  type QueryPage,
  type QueryRecord,
  type SubmissionResponse,
} from './responses.ts';
import type { Transport } from './transport.ts';

/** Máximo de registros por petición (Descripción del servicio web v1.0.3). */
export const MAX_RECORDS_PER_REQUEST = 1000;

export interface AeatClientOptions {
  /** Transporte con el certificado de cliente (p. ej. `nodeTransport(...)`). */
  readonly transport: Transport;
  /** Entorno de la AEAT. Obligatorio, para no enviar a producción por descuido. */
  readonly environment: Environment;
  /** Tipo de certificado: `personal` (www1/prewww1) o `seal` de sello electrónico (www10/prewww10). */
  readonly certificateType: CertificateType;
  /** Obligado a expedir las facturas (`ObligadoEmision`). */
  readonly taxpayer: FiscalIdentifier;
  /** Representante o asesor que genera los registros, si lo hay. */
  readonly representative?: FiscalIdentifier;
  /** Sistema informático; se usa en la cabecera `User-Agent`. */
  readonly system?: Pick<ComputerSystem, 'name' | 'version'>;
}

export interface SendOptions {
  /**
   * Servicio: `verifactu` (remisión voluntaria, por defecto) o `requirement` (registros
   * NO VERI*FACTU remitidos tras un requerimiento de la AEAT).
   */
  readonly service?: Service;
  /** Remisión voluntaria: fin de la remisión VERI*FACTU y/o incidencia. Solo con `service: 'verifactu'`. */
  readonly voluntaryRemission?: SubmissionHeader['voluntaryRemission'];
  /** Requerimiento: referencia y si es el último envío. Obligatorio con `service: 'requirement'`. */
  readonly requirement?: SubmissionHeader['requirement'];
  /** Validar registros y cabecera antes de enviar. Por defecto, `true`. */
  readonly validate?: boolean;
  /** Fecha actual (`AAAA-MM-DD`) para las validaciones; por defecto, la de Europe/Madrid. */
  readonly today?: string;
  readonly signal?: AbortSignal;
}

/**
 * Cliente del servicio web de la AEAT (SOAP 1.1) para enviar y consultar registros.
 *
 * No guarda estado: el SIF debe conservar el CSV de cada envío, respetar `waitSeconds` entre
 * envíos y mantener la cadena de registros.
 *
 * Port de AeatClient.php (josemmo/Verifactu-PHP, MIT), ampliado con la consulta.
 */
export class AeatClient {
  readonly options: AeatClientOptions;

  constructor(options: AeatClientOptions) {
    this.options = options;
  }

  /** URL del servicio que se usará. */
  endpoint(service: Service = 'verifactu'): string {
    return soapEndpoint(this.options.environment, this.options.certificateType, service);
  }

  /**
   * Envía hasta 1000 registros (altas y anulaciones) en una petición.
   *
   * @throws ValidationError si algún registro o la cabecera incumplen reglas de severidad `error`.
   * @throws BatchLimitError si hay más de 1000 registros.
   * @throws SoapFaultError si la AEAT rechaza la petición completa.
   * @throws TransportError si falla la comunicación.
   */
  async send(
    records: readonly InvoiceRecord[],
    options: SendOptions = {},
  ): Promise<SubmissionResponse> {
    if (records.length > MAX_RECORDS_PER_REQUEST) throw new BatchLimitError(records.length);
    const service = options.service ?? 'verifactu';
    const header: SubmissionHeader = {
      taxpayer: this.options.taxpayer,
      ...(this.options.representative && { representative: this.options.representative }),
      ...(options.voluntaryRemission && { voluntaryRemission: options.voluntaryRemission }),
      ...(options.requirement && { requirement: options.requirement }),
    };
    if (options.validate ?? true) {
      const today = options.today ?? todayInMadrid();
      const violations = [
        ...validateSubmissionHeader(header, service, today),
        ...records.flatMap((r, i) =>
          validateRecord(r, { today, taxpayerNif: this.options.taxpayer.nif }).map((v) => ({
            ...v,
            path: `records[${i}].${v.path}`,
          })),
        ),
      ];
      if (violations.some((v) => v.severity === 'error'))
        throw new ValidationError(violations, 'El envío');
    }
    const body = soapEnvelope(buildSubmissionXml(header, records));
    const res = await this.post(this.endpoint(service), body, options.signal);
    return parseSubmissionResponse(res.status, res.body);
  }

  /**
   * Consulta una página de registros enviados (como máximo 10 000 por página).
   * Solo disponible para sistemas VERI*FACTU.
   */
  async queryPage(
    filter: QueryFilter,
    options: { pageKey?: InvoiceIdentifier; asRecipient?: boolean; signal?: AbortSignal } = {},
  ): Promise<QueryPage> {
    const xml = buildQueryXml(
      filter,
      {
        taxpayer: this.options.taxpayer,
        ...(options.asRecipient !== undefined && { asRecipient: options.asRecipient }),
        ...(this.options.representative && { viaRepresentative: true }),
      },
      options.pageKey,
    );
    const res = await this.post(this.endpoint('verifactu'), soapEnvelope(xml), options.signal);
    return parseQueryResponse(res.status, res.body);
  }

  /**
   * Consulta registros recorriendo todas las páginas.
   *
   * @example
   * for await (const r of client.query({ year: 2026, month: 10 })) console.log(r.invoiceId, r.status);
   */
  async *query(
    filter: QueryFilter,
    options: { asRecipient?: boolean; signal?: AbortSignal } = {},
  ): AsyncGenerator<QueryRecord, void, undefined> {
    let pageKey: InvoiceIdentifier | undefined;
    do {
      const page = await this.queryPage(filter, { ...options, ...(pageKey && { pageKey }) });
      yield* page.records;
      pageKey = page.nextPageKey;
    } while (pageKey);
  }

  private post(url: string, body: string, signal: AbortSignal | undefined) {
    const system = this.options.system;
    return this.options.transport({
      url,
      body,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '""',
        'User-Agent': system ? `verifactu-ts (${system.name}/${system.version})` : 'verifactu-ts',
      },
      ...(signal && { signal }),
    });
  }
}

/**
 * Valida la cabecera de un envío (Validaciones v1.2.2 §3.1.1).
 *
 * @param service servicio al que se envía (`verifactu` o `requirement`).
 * @param today fecha actual `AAAA-MM-DD`.
 */
export function validateSubmissionHeader(
  header: SubmissionHeader,
  service: Service,
  today: string,
): Violation[] {
  const c = new Collector();
  const ref = 'Validaciones v1.2.2 §3.1.1';
  const vr = header.voluntaryRemission;
  if (service === 'requirement') {
    c.check(
      vr === undefined,
      'voluntaryRemission',
      'header.voluntary-in-requirement',
      'FechaFinVeriFactu e Incidencia solo se admiten en sistemas VERI*FACTU.',
      { reference: ref },
    );
    c.check(
      header.requirement !== undefined,
      'requirement',
      'header.requirement-required',
      'La remisión por requerimiento exige la referencia del requerimiento.',
      { aeatCode: 4129, reference: ref },
    );
  } else {
    c.check(
      header.requirement === undefined,
      'requirement',
      'header.requirement-in-verifactu',
      'RefRequerimiento solo se admite en sistemas NO VERI*FACTU (servicio requirement).',
      { reference: ref },
    );
  }
  if (header.requirement) {
    const r = header.requirement.reference;
    c.check(
      r.length > 0 && r.length <= 18,
      'requirement.reference',
      'header.requirement-reference',
      'La referencia del requerimiento debe tener entre 1 y 18 caracteres.',
    );
  }
  if (vr?.endDate !== undefined && today >= '2027-01-01') {
    const year = Number(today.slice(0, 4));
    const endYear = Number(vr.endDate.slice(0, 4));
    c.check(
      vr.endDate.slice(5) === '12-31' && (endYear === year || endYear === year - 1),
      'voluntaryRemission.endDate',
      'header.end-date-format',
      'Desde el 01/01/2027, FechaFinVeriFactu debe ser el 31 de diciembre del año actual o del anterior.',
      { reference: ref },
    );
  }
  return c.violations;
}

/** Divide una lista de registros en lotes de como máximo 1000 (el límite por petición). */
export function chunkRecords<T>(records: readonly T[], size = MAX_RECORDS_PER_REQUEST): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < records.length; i += size) out.push(records.slice(i, i + size));
  return out;
}

/**
 * Momento a partir del cual se puede hacer el siguiente envío, según `TiempoEsperaEnvio`
 * (control de flujo: Orden HAC/1177/2024, art. 16.2). Se puede enviar antes si se acumulan
 * 1000 registros.
 */
export function nextSendAllowedAt(
  response: Pick<SubmissionResponse, 'waitSeconds'>,
  receivedAt = new Date(),
): Date {
  return new Date(receivedAt.getTime() + response.waitSeconds * 1000);
}
