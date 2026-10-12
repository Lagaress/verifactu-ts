/**
 * verifactu-ts/no-verifactu — piezas de la modalidad NO VERI*FACTU: firma XAdES-EPES de los
 * registros y registros de evento firmados y encadenados.
 *
 * En NO VERI*FACTU los registros no se envían de forma inmediata: el SIF los firma, los
 * conserva junto con el registro de eventos y los remite solo tras un requerimiento de la AEAT
 * (`client.send(records, { service: 'requirement', requirement: { reference, isLast } })`).
 *
 * @packageDocumentation
 */
export {
  AGE_SIGNATURE_POLICY,
  loadPemCredentials,
  signRecord,
  type SigningCredentials,
  type SigningKey,
  type SignOptions,
} from './xades/sign.ts';
export { parseCertificate, type CertificateInfo } from './xades/der.ts';
export {
  calculateEventHash,
  createEventRecord,
  eventFromXml,
  eventHashInput,
  eventToXml,
  EventType,
  toEventChainLink,
  validateEvent,
  verifyEventChain,
  type AnomalyType,
  type EventChainLink,
  type EventDetails,
  type EventRecord,
  type EventRecordInput,
} from './events/events.ts';
