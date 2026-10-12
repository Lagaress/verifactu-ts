import { fromAeatDate, toAeatDate } from '../common/dates.ts';
import { XmlSchemaError } from '../common/errors.ts';
import type { ComputerSystem } from '../models/computer-system.ts';
import type { OperationType } from '../models/enums.ts';
import type { InvoiceIdentifier, Party } from '../models/identifiers.ts';
import type {
  BreakdownDetails,
  CancellationRecord,
  ChainLink,
  InvoiceRecord,
  RegistrationRecord,
} from '../models/records.ts';
import { SPEC_VERSION } from '../spec/version.ts';
import { NAMESPACES } from './generated/namespaces.ts';
import { SF } from './generated/suministro-informacion.schema.ts';
import type {
  CalificacionOperacionType,
  DetalleType,
  EncadenamientoFacturaAnteriorType,
  IDFacturaARType,
  IDOtroType,
  OperacionExentaType,
  PersonaFisicaJuridicaType,
  RegistroFacturacionAltaType,
  RegistroFacturacionAltaType_Encadenamiento,
  RegistroFacturacionAnulacionType,
  SistemaInformaticoType,
} from './generated/suministro-informacion.ts';
import { parseXml, readWire, type XmlElement } from './reader.ts';
import { assertWire, elementType } from './schema-walk.ts';
import { writeElement } from './writer.ts';

/**
 * Conversión entre los modelos de dominio y los «tipos de cable» generados desde el XSD.
 *
 * Port de los métodos export()/fromXml() de los modelos de josemmo/Verifactu-PHP (MIT). Aquí el
 * orden de los elementos lo impone el esquema (ver writer.ts), no este código.
 */

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const sn = (value: boolean): 'S' | 'N' => (value ? 'S' : 'N');

/** Añade la propiedad solo si el valor está definido (compatible con exactOptionalPropertyTypes). */
function opt<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;
}

// ---------------------------------------------------------------------------------------------
// Dominio → cable

function idFactura(id: InvoiceIdentifier): IDFacturaARType {
  return {
    IDEmisorFactura: id.issuerId,
    NumSerieFactura: id.invoiceNumber,
    FechaExpedicionFactura: toAeatDate(id.issueDate),
  };
}

function party(p: Party): PersonaFisicaJuridicaType {
  if ('nif' in p) return { NombreRazon: p.name, NIF: p.nif };
  const idOtro: IDOtroType = { ...opt('CodigoPais', p.country), IDType: p.type, ID: p.value };
  return { NombreRazon: p.name, IDOtro: idOtro };
}

function system(s: ComputerSystem): SistemaInformaticoType {
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
  if (s.vendorForeignId) {
    const f = s.vendorForeignId;
    return { ...common, IDOtro: { ...opt('CodigoPais', f.country), IDType: f.type, ID: f.value } };
  }
  return { ...common, NIF: s.vendorNif ?? '' };
}

function chain(previous: ChainLink | null): RegistroFacturacionAltaType_Encadenamiento {
  if (previous === null) return { PrimerRegistro: 'S' };
  const anterior: EncadenamientoFacturaAnteriorType = {
    ...idFactura(previous.invoiceId),
    Huella: previous.hash,
  };
  return { RegistroAnterior: anterior };
}

function detail(line: BreakdownDetails): DetalleType {
  const op = line.operationType;
  const classification = op.startsWith('E')
    ? { OperacionExenta: op as OperacionExentaType }
    : { CalificacionOperacion: op as CalificacionOperacionType };
  return {
    ...opt('Impuesto', line.taxType),
    ...opt('ClaveRegimen', line.regimeType),
    ...classification,
    ...opt('TipoImpositivo', line.taxRate),
    BaseImponibleOimporteNoSujeto: line.baseAmount,
    ...opt('BaseImponibleACoste', line.costBaseAmount),
    ...opt('CuotaRepercutida', line.taxAmount),
    ...opt('TipoRecargoEquivalencia', line.surchargeRate),
    ...opt('CuotaRecargoEquivalencia', line.surchargeAmount),
  };
}

/** Registro de alta del modelo → `RegistroAlta` del XSD. */
export function registrationToWire(r: RegistrationRecord): RegistroFacturacionAltaType {
  const hasCorrection =
    r.correctedBaseAmount !== undefined ||
    r.correctedTaxAmount !== undefined ||
    r.correctedSurchargeAmount !== undefined;
  return {
    IDVersion: SPEC_VERSION.idVersion,
    IDFactura: idFactura(r.invoiceId),
    ...opt('RefExterna', r.externalReference),
    NombreRazonEmisor: r.issuerName,
    Subsanacion: sn(r.isCorrection),
    ...opt('RechazoPrevio', r.priorRejection),
    TipoFactura: r.invoiceType,
    ...opt('TipoRectificativa', r.correctiveType),
    ...opt(
      'FacturasRectificadas',
      r.correctedInvoices?.length
        ? { IDFacturaRectificada: r.correctedInvoices.map(idFactura) }
        : undefined,
    ),
    ...opt(
      'FacturasSustituidas',
      r.replacedInvoices?.length
        ? { IDFacturaSustituida: r.replacedInvoices.map(idFactura) }
        : undefined,
    ),
    ...opt(
      'ImporteRectificacion',
      hasCorrection
        ? {
            BaseRectificada: r.correctedBaseAmount as string,
            CuotaRectificada: r.correctedTaxAmount as string,
            ...opt('CuotaRecargoRectificado', r.correctedSurchargeAmount),
          }
        : undefined,
    ),
    ...opt(
      'FechaOperacion',
      r.operationDate === undefined ? undefined : toAeatDate(r.operationDate),
    ),
    DescripcionOperacion: r.description,
    ...opt(
      'FacturaSimplificadaArt7273',
      r.isSimplifiedArt7273 === undefined ? undefined : sn(r.isSimplifiedArt7273),
    ),
    ...opt(
      'FacturaSinIdentifDestinatarioArt61d',
      r.isWithoutRecipientArt61d === undefined ? undefined : sn(r.isWithoutRecipientArt61d),
    ),
    ...opt('Macrodato', r.isMacrodata === undefined ? undefined : sn(r.isMacrodata)),
    ...opt('EmitidaPorTerceroODestinatario', r.issuedBy),
    ...opt('Tercero', r.thirdParty && party(r.thirdParty)),
    ...opt(
      'Destinatarios',
      r.recipients.length > 0 ? { IDDestinatario: r.recipients.map(party) } : undefined,
    ),
    ...opt('Cupon', r.hasCoupon === undefined ? undefined : sn(r.hasCoupon)),
    Desglose: { DetalleDesglose: r.breakdown.map(detail) },
    CuotaTotal: r.totalTaxAmount,
    ImporteTotal: r.totalAmount,
    Encadenamiento: chain(r.previous),
    SistemaInformatico: system(r.system),
    FechaHoraHusoGenRegistro: r.hashedAt,
    ...opt('NumRegistroAcuerdoFacturacion', r.billingAgreementNumber),
    ...opt('IdAcuerdoSistemaInformatico', r.systemAgreementId),
    TipoHuella: '01',
    Huella: r.hash,
    ...opt('Signature', r.signature),
  };
}

/** Registro de anulación del modelo → `RegistroAnulacion` del XSD. */
export function cancellationToWire(r: CancellationRecord): RegistroFacturacionAnulacionType {
  return {
    IDVersion: SPEC_VERSION.idVersion,
    IDFactura: {
      IDEmisorFacturaAnulada: r.invoiceId.issuerId,
      NumSerieFacturaAnulada: r.invoiceId.invoiceNumber,
      FechaExpedicionFacturaAnulada: toAeatDate(r.invoiceId.issueDate),
    },
    ...opt('RefExterna', r.externalReference),
    ...opt('SinRegistroPrevio', r.withoutPriorRecord ? ('S' as const) : undefined),
    ...opt('RechazoPrevio', r.isPriorRejection ? ('S' as const) : undefined),
    ...opt('GeneradoPor', r.generatedBy),
    ...opt('Generador', r.generator && party(r.generator)),
    Encadenamiento: chain(r.previous),
    SistemaInformatico: system(r.system),
    FechaHoraHusoGenRegistro: r.hashedAt,
    TipoHuella: '01',
    Huella: r.hash,
    ...opt('Signature', r.signature),
  };
}

// ---------------------------------------------------------------------------------------------
// Cable → dominio

const yes = (v: string | undefined): boolean => v === 'S';

function invoiceId(w: IDFacturaARType): InvoiceIdentifier {
  return {
    issuerId: w.IDEmisorFactura,
    invoiceNumber: w.NumSerieFactura,
    issueDate: fromAeatDate(w.FechaExpedicionFactura),
  };
}

function partyFromWire(w: PersonaFisicaJuridicaType): Party {
  if (w.NIF !== undefined) return { name: w.NombreRazon, nif: w.NIF };
  const o = w.IDOtro;
  return { name: w.NombreRazon, ...opt('country', o.CodigoPais), type: o.IDType, value: o.ID };
}

function systemFromWire(w: SistemaInformaticoType): ComputerSystem {
  return {
    vendorName: w.NombreRazon,
    ...(w.NIF !== undefined
      ? { vendorNif: w.NIF }
      : {
          vendorForeignId: {
            ...opt('country', w.IDOtro.CodigoPais),
            type: w.IDOtro.IDType,
            value: w.IDOtro.ID,
          },
        }),
    name: w.NombreSistemaInformatico,
    id: w.IdSistemaInformatico,
    version: w.Version,
    installationNumber: w.NumeroInstalacion,
    onlySupportsVerifactu: yes(w.TipoUsoPosibleSoloVerifactu),
    supportsMultipleTaxpayers: yes(w.TipoUsoPosibleMultiOT),
    hasMultipleTaxpayers: yes(w.IndicadorMultiplesOT),
  };
}

function chainFromWire(w: RegistroFacturacionAltaType_Encadenamiento): ChainLink | null {
  if (w.RegistroAnterior === undefined) return null;
  const a = w.RegistroAnterior;
  return { invoiceId: invoiceId(a), hash: a.Huella };
}

function detailFromWire(w: DetalleType): BreakdownDetails {
  const operationType: OperationType = w.CalificacionOperacion ?? w.OperacionExenta;
  return {
    ...opt('taxType', w.Impuesto),
    ...opt('regimeType', w.ClaveRegimen),
    operationType,
    ...opt('taxRate', w.TipoImpositivo),
    baseAmount: w.BaseImponibleOimporteNoSujeto,
    ...opt('costBaseAmount', w.BaseImponibleACoste),
    ...opt('taxAmount', w.CuotaRepercutida),
    ...opt('surchargeRate', w.TipoRecargoEquivalencia),
    ...opt('surchargeAmount', w.CuotaRecargoEquivalencia),
  };
}

const optBool = (v: string | undefined): boolean | undefined =>
  v === undefined ? undefined : v === 'S';

/** `RegistroAlta` del XSD → registro de alta del modelo (conserva los literales de los importes). */
export function registrationFromWire(w: RegistroFacturacionAltaType): RegistrationRecord {
  const ir = w.ImporteRectificacion;
  const record: Mutable<RegistrationRecord> = {
    kind: 'registration',
    invoiceId: invoiceId(w.IDFactura),
    ...opt('externalReference', w.RefExterna),
    issuerName: w.NombreRazonEmisor,
    isCorrection: yes(w.Subsanacion),
    ...opt('priorRejection', w.RechazoPrevio),
    invoiceType: w.TipoFactura,
    ...opt('correctiveType', w.TipoRectificativa),
    ...opt('correctedInvoices', w.FacturasRectificadas?.IDFacturaRectificada.map(invoiceId)),
    ...opt('replacedInvoices', w.FacturasSustituidas?.IDFacturaSustituida.map(invoiceId)),
    ...opt('correctedBaseAmount', ir?.BaseRectificada),
    ...opt('correctedTaxAmount', ir?.CuotaRectificada),
    ...opt('correctedSurchargeAmount', ir?.CuotaRecargoRectificado),
    ...opt(
      'operationDate',
      w.FechaOperacion === undefined ? undefined : fromAeatDate(w.FechaOperacion),
    ),
    description: w.DescripcionOperacion,
    ...opt('isSimplifiedArt7273', optBool(w.FacturaSimplificadaArt7273)),
    ...opt('isWithoutRecipientArt61d', optBool(w.FacturaSinIdentifDestinatarioArt61d)),
    ...opt('isMacrodata', optBool(w.Macrodato)),
    ...opt('issuedBy', w.EmitidaPorTerceroODestinatario),
    ...opt('thirdParty', w.Tercero && partyFromWire(w.Tercero)),
    recipients: w.Destinatarios?.IDDestinatario.map(partyFromWire) ?? [],
    ...opt('hasCoupon', optBool(w.Cupon)),
    breakdown: w.Desglose.DetalleDesglose.map(detailFromWire),
    totalTaxAmount: w.CuotaTotal,
    totalAmount: w.ImporteTotal,
    previous: chainFromWire(w.Encadenamiento),
    system: systemFromWire(w.SistemaInformatico),
    hashedAt: w.FechaHoraHusoGenRegistro,
    ...opt('billingAgreementNumber', w.NumRegistroAcuerdoFacturacion),
    ...opt('systemAgreementId', w.IdAcuerdoSistemaInformatico),
    hash: w.Huella,
    ...opt('signature', w.Signature),
  };
  return record;
}

/** `RegistroAnulacion` del XSD → registro de anulación del modelo. */
export function cancellationFromWire(w: RegistroFacturacionAnulacionType): CancellationRecord {
  return {
    kind: 'cancellation',
    invoiceId: {
      issuerId: w.IDFactura.IDEmisorFacturaAnulada,
      invoiceNumber: w.IDFactura.NumSerieFacturaAnulada,
      issueDate: fromAeatDate(w.IDFactura.FechaExpedicionFacturaAnulada),
    },
    ...opt('externalReference', w.RefExterna),
    withoutPriorRecord: yes(w.SinRegistroPrevio),
    isPriorRejection: yes(w.RechazoPrevio),
    ...opt('generatedBy', w.GeneradoPor),
    ...opt('generator', w.Generador && partyFromWire(w.Generador)),
    previous: chainFromWire(w.Encadenamiento),
    system: systemFromWire(w.SistemaInformatico),
    hashedAt: w.FechaHoraHusoGenRegistro,
    hash: w.Huella,
    ...opt('signature', w.Signature),
  };
}

// ---------------------------------------------------------------------------------------------
// API pública

/** Convierte un registro del modelo en su objeto XSD (`RegistroAlta` o `RegistroAnulacion`). */
export function recordToWire(
  record: InvoiceRecord,
): RegistroFacturacionAltaType | RegistroFacturacionAnulacionType {
  return record.kind === 'registration' ? registrationToWire(record) : cancellationToWire(record);
}

/**
 * Serializa un registro como elemento XML independiente (`<sum1:RegistroAlta xmlns:sum1="…">` o
 * `<sum1:RegistroAnulacion …>`), validándolo antes contra el esquema.
 *
 * Es el formato de los ejemplos de la AEAT y el nodo que se firma en la modalidad NO VERI*FACTU.
 *
 * @throws XmlSchemaError si el registro no se ajusta al XSD.
 */
export function recordToXml(record: InvoiceRecord): string {
  return record.kind === 'registration'
    ? writeElement(SF, 'sf:RegistroAlta', registrationToWire(record))
    : writeElement(SF, 'sf:RegistroAnulacion', cancellationToWire(record));
}

/**
 * Lee un registro de facturación desde XML. El elemento raíz debe ser `RegistroAlta` o
 * `RegistroAnulacion` (namespace de SuministroInformacion.xsd), o un `RegistroFactura` que lo
 * contenga.
 *
 * Los importes conservan su literal original (p. ej. `41.4`) para que la huella se pueda
 * recalcular exactamente.
 *
 * @throws XmlParseError si el XML no está bien formado.
 * @throws XmlSchemaError si no se ajusta al XSD.
 */
export function recordFromXml(xml: string): InvoiceRecord {
  let root: XmlElement = parseXml(xml);
  if (root.ns === NAMESPACES.sfLR && root.local === 'RegistroFactura') {
    const inner = root.children[0];
    if (!inner || root.children.length !== 1)
      throw new XmlSchemaError('RegistroFactura', 'se esperaba un único registro');
    root = inner;
  }
  if (
    root.ns !== NAMESPACES.sf ||
    (root.local !== 'RegistroAlta' && root.local !== 'RegistroAnulacion')
  ) {
    throw new XmlSchemaError(
      root.local,
      'se esperaba un elemento RegistroAlta o RegistroAnulacion de SuministroInformacion.xsd',
    );
  }
  const type = elementType(SF, `sf:${root.local}`);
  const wire = readWire(SF, type, root, xml);
  assertWire(SF, type, wire, root.local);
  return root.local === 'RegistroAlta'
    ? registrationFromWire(wire as RegistroFacturacionAltaType)
    : cancellationFromWire(wire as RegistroFacturacionAnulacionType);
}
