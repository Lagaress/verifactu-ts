/**
 * verifactu-ts/client — cliente del servicio web de la AEAT (envío y consulta de registros).
 *
 * El cliente no hace E/S por sí mismo: usa un {@link Transport}. Para Node.js está
 * `verifactu-ts/transport/node`; para Deno, Bun u otros runtimes, `fetchTransport`.
 *
 * @packageDocumentation
 */
export {
  AeatClient,
  chunkRecords,
  MAX_RECORDS_PER_REQUEST,
  nextSendAllowedAt,
  validateSubmissionHeader,
  type AeatClientOptions,
  type SendOptions,
} from './aeat-client.ts';
export * from './errors.ts';
export { buildQueryXml, type QueryContext, type QueryFilter } from './query.ts';
export * from './responses.ts';
export type * from './transport.ts';
export { fetchTransport, type FetchTransportOptions } from './transports/fetch.ts';
