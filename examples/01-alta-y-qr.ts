// Crear un registro de alta encadenado, serializarlo y generar su QR (sin red).
import {
  createRegistrationRecord,
  qrUrl,
  recordToXml,
  toChainLink,
  type ChainLink,
  type ComputerSystem,
} from 'verifactu-ts';
import { qrSvg } from 'verifactu-ts/qr/render';

export const system: ComputerSystem = {
  vendorName: 'Mi Software de Facturación SL',
  vendorNif: 'B00000000',
  name: 'MiFactura',
  id: 'MF',
  version: '2.3.1',
  installationNumber: 'CLIENTE-0001',
  onlySupportsVerifactu: true,
  supportsMultipleTaxpayers: false,
  hasMultipleTaxpayers: false,
};

export async function main(previous: ChainLink | null = null) {
  const record = await createRegistrationRecord({
    invoiceId: { issuerId: 'A00000000', invoiceNumber: 'F2025-0042', issueDate: '2025-06-01' },
    issuerName: 'Perico de los Palotes, S.A.',
    invoiceType: 'F1',
    description: 'Servicios de consultoría',
    recipients: [{ name: 'Cliente Ejemplo SL', nif: '00000000A' }],
    breakdown: [
      {
        taxType: '01',
        regimeType: '01',
        operationType: 'S1',
        taxRate: '21',
        baseAmount: '1000.00',
        taxAmount: '210.00',
      },
    ],
    totalTaxAmount: '210.00',
    totalAmount: '1210.00',
    previous, // null ⇒ primer registro de la cadena
    system,
    hashedAt: new Date('2025-06-01T08:30:00Z'), // en la práctica: new Date()
  });

  // Guarda record y toChainLink(record): el siguiente registro se encadena con él.
  const link = toChainLink(record);
  const xml = recordToXml(record);
  const url = qrUrl(record, { environment: 'production', mode: 'verifactu' });
  const svg = qrSvg(url, { size: '35mm' });
  return { record, link, xml, url, svg };
}
