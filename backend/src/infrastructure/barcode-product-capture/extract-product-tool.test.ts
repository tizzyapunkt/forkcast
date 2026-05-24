import { describe, it, expect } from 'vitest';
import { parseProductToolInput } from './extract-product-tool.ts';

describe('parseProductToolInput', () => {
  it('parses a valid tool output', () => {
    const product = parseProductToolInput({
      name: '  Himbeer-Heidelbeer-Mix  ',
      unit: 'g',
      calories: 54,
      protein: 0.9,
      carbs: 8.4,
      fat: 0.7,
    });
    expect(product).toEqual({
      name: 'Himbeer-Heidelbeer-Mix',
      unit: 'g',
      macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
    });
  });

  it('accepts the ml unit', () => {
    const product = parseProductToolInput({ name: 'Hafermilch', unit: 'ml', calories: 45 });
    expect(product.unit).toBe('ml');
  });

  it('defaults omitted protein/carbs/fat to 0', () => {
    const product = parseProductToolInput({ name: 'X', unit: 'g', calories: 10 });
    expect(product.macrosPer100).toEqual({ calories: 10, protein: 0, carbs: 0, fat: 0 });
  });

  it('rejects a non-object input', () => {
    expect(() => parseProductToolInput(null)).toThrow(/object/i);
    expect(() => parseProductToolInput('nope')).toThrow(/object/i);
  });

  it('rejects a blank name', () => {
    expect(() => parseProductToolInput({ name: '   ', unit: 'g', calories: 10 })).toThrow(/name/i);
  });

  it('rejects a unit outside g/ml', () => {
    expect(() => parseProductToolInput({ name: 'X', unit: 'kg', calories: 10 })).toThrow(/unit/i);
  });

  it('rejects missing calories', () => {
    expect(() => parseProductToolInput({ name: 'X', unit: 'g' })).toThrow(/calories/i);
  });

  it('rejects non-finite or negative calories', () => {
    expect(() => parseProductToolInput({ name: 'X', unit: 'g', calories: Number.NaN })).toThrow(/calories/i);
    expect(() => parseProductToolInput({ name: 'X', unit: 'g', calories: -1 })).toThrow(/calories/i);
  });

  it('rejects a present-but-negative macro', () => {
    expect(() => parseProductToolInput({ name: 'X', unit: 'g', calories: 10, protein: -2 })).toThrow(/protein/i);
  });
});
