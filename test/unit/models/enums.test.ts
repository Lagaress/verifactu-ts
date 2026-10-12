import { describe, expect, it } from 'vitest';
import {
  CorrectiveType,
  ForeignIdType,
  GeneratedBy,
  InvoiceType,
  IssuedBy,
  OperationType,
  RegimeType,
  TaxType,
  isExemptOperation,
  isNonSubjectOperation,
  isSubjectOperation,
} from '../../../src/index.ts';
import * as sf from '../../../src/xml/generated/suministro-informacion.ts';

const sorted = (values: readonly string[]) => [...values].sort();

describe('enums frente a los XSD vigentes', () => {
  it.each([
    ['InvoiceType', InvoiceType, sf.ClaveTipoFacturaType_VALUES],
    ['CorrectiveType', CorrectiveType, sf.ClaveTipoRectificativaType_VALUES],
    ['TaxType', TaxType, sf.ImpuestoType_VALUES],
    ['RegimeType', RegimeType, sf.IdOperacionesTrascendenciaTributariaType_VALUES],
    [
      'OperationType',
      OperationType,
      [...sf.CalificacionOperacionType_VALUES, ...sf.OperacionExentaType_VALUES],
    ],
    ['ForeignIdType', ForeignIdType, sf.PersonaFisicaJuridicaIDTypeType_VALUES],
    ['GeneratedBy', GeneratedBy, sf.GeneradoPorType_VALUES],
    ['IssuedBy', IssuedBy, sf.TercerosODestinatarioType_VALUES],
  ])('%s contiene exactamente los valores del XSD', (_name, enumObject, xsdValues) => {
    expect(sorted(Object.values(enumObject))).toEqual(sorted(xsdValues));
  });

  it('clasifica las operaciones (Verifactu-PHP OperationTypeTest)', () => {
    expect(isSubjectOperation('S1')).toBe(true);
    expect(isSubjectOperation('S2')).toBe(true);
    expect(isNonSubjectOperation('N1')).toBe(true);
    expect(isNonSubjectOperation('S1')).toBe(false);
    expect(isExemptOperation('E8')).toBe(true);
    expect(isExemptOperation('N2')).toBe(false);
  });
});
