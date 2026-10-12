import type { ComputerSystem, RegistrationRecordInput } from '../src/index.ts';

/** Sistema informático ficticio para tests. */
export const SYSTEM: ComputerSystem = {
  vendorName: 'Perico de los Palotes, S.A.',
  vendorNif: 'A00000000',
  name: 'Test SIF',
  id: 'TS',
  version: '0.0.1',
  installationNumber: '01234',
  onlySupportsVerifactu: true,
  supportsMultipleTaxpayers: false,
  hasMultipleTaxpayers: false,
};

/** Datos mínimos de un alta F1 válida, para variar en cada test. */
export function f1Input(overrides: Partial<RegistrationRecordInput> = {}): RegistrationRecordInput {
  return {
    invoiceId: { issuerId: 'A00000000', invoiceNumber: 'PRUEBA-0001', issueDate: '2025-06-01' },
    issuerName: 'Perico de los Palotes, S.A.',
    invoiceType: 'F1',
    description: 'Servicios de consultoría',
    recipients: [{ name: 'Antonio García Pérez', nif: '00000000A' }],
    breakdown: [
      {
        taxType: '01',
        regimeType: '01',
        operationType: 'S1',
        taxRate: '21.00',
        baseAmount: '100.00',
        taxAmount: '21.00',
      },
    ],
    totalTaxAmount: '21.00',
    totalAmount: '121.00',
    previous: null,
    system: SYSTEM,
    hashedAt: '2025-06-01T10:20:30+02:00',
    ...overrides,
  };
}
