/**
 * verifactu-ts — núcleo: modelos, validación, huella, encadenamiento, XML y URL del QR.
 *
 * El núcleo no tiene dependencias ni E/S y funciona en cualquier runtime con Web Crypto
 * (Node ≥ 22, Deno, Bun, navegadores, workers). El cliente SOAP está en `verifactu-ts/client`.
 *
 * @packageDocumentation
 */

export * from './common/amount.ts';
export * from './common/dates.ts';
export * from './common/errors.ts';

export * from './models/enums.ts';
export type * from './models/identifiers.ts';
export { isFiscalIdentifier } from './models/identifiers.ts';
export type * from './models/computer-system.ts';
export type * from './models/records.ts';

export * from './records/create.ts';
export * from './hash/hash.ts';
export * from './chain/chain.ts';

export * from './validation/validate.ts';
export type * from './validation/violation.ts';

export * from './qr/url.ts';

export * from './spec/version.ts';
export * from './spec/endpoints.ts';
export * from './spec/errors.ts';
