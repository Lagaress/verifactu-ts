import { describe, expect, it } from 'vitest';
import { aeatError, AEAT_ERROR_DESCRIPTIONS } from '../../src/errors.ts';
import { aeatErrorKind } from '../../src/index.ts';

describe('catálogo de errores de la AEAT', () => {
  it('clasifica los códigos por sección de errores.properties', () => {
    expect(aeatErrorKind(4102)).toBe('rechazo-envio');
    expect(aeatErrorKind(1108)).toBe('rechazo-registro');
    expect(aeatErrorKind(3000)).toBe('rechazo-registro');
    expect(aeatErrorKind(2000)).toBe('admisible');
    expect(aeatErrorKind(9999)).toBeUndefined();
  });

  it('incluye los 247 códigos con su descripción en el subpath opcional', () => {
    expect(Object.keys(AEAT_ERROR_DESCRIPTIONS)).toHaveLength(247);
    expect(aeatError(2000)).toEqual({
      code: 2000,
      kind: 'admisible',
      description: 'El cálculo de la huella suministrada es incorrecta.',
    });
    expect(aeatError(1)).toBeUndefined();
  });
});
