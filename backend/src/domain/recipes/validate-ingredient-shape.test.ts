import { describe, it, expect } from 'vitest';
import { validateIngredientShape } from './validate-ingredient-shape.ts';
import type { RecipeIngredient } from './types.ts';

const zeroMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function tracked(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    name: 'Oats',
    unit: 'g',
    macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 },
    amount: 80,
    ...overrides,
  };
}

function untracked(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    name: 'Salz',
    unit: 'g',
    macrosPerUnit: zeroMacros,
    amount: 5,
    untracked: true,
    ...overrides,
  };
}

describe('validateIngredientShape', () => {
  it('accepts a valid tracked ingredient', () => {
    expect(() => validateIngredientShape(tracked())).not.toThrow();
  });

  it('rejects empty name', () => {
    expect(() => validateIngredientShape(tracked({ name: '   ' }))).toThrow(/name/i);
  });

  it('rejects unknown unit', () => {
    expect(() => validateIngredientShape(tracked({ unit: 'foo' as unknown as 'g' }))).toThrow(/unit/i);
  });

  it('rejects tracked with amount = 0', () => {
    expect(() => validateIngredientShape(tracked({ amount: 0 }))).toThrow(/positive/i);
  });

  it('rejects tracked with negative amount', () => {
    expect(() => validateIngredientShape(tracked({ amount: -1 }))).toThrow(/positive/i);
  });

  it('rejects non-finite amount', () => {
    expect(() => validateIngredientShape(tracked({ amount: Number.NaN }))).toThrow(/finite/i);
  });

  it('accepts untracked with amount = 0', () => {
    expect(() => validateIngredientShape(untracked({ amount: 0 }))).not.toThrow();
  });

  it('rejects untracked with negative amount', () => {
    expect(() => validateIngredientShape(untracked({ amount: -0.5 }))).toThrow(/>= 0/);
  });

  it('rejects untracked with missing unit', () => {
    expect(() => validateIngredientShape(untracked({ unit: '' as unknown as 'g' }))).toThrow(/unit/i);
  });

  it('accepts untracked with a valid displayQuantity', () => {
    expect(() =>
      validateIngredientShape(untracked({ amount: 0, displayQuantity: { amount: 1, unitLabel: 'TL' } })),
    ).not.toThrow();
  });

  it('rejects displayQuantity on a tracked row', () => {
    expect(() => validateIngredientShape(tracked({ displayQuantity: { amount: 1, unitLabel: 'TL' } }))).toThrow(
      /untracked/i,
    );
  });

  it('rejects displayQuantity with empty unitLabel', () => {
    expect(() => validateIngredientShape(untracked({ displayQuantity: { amount: 1, unitLabel: '   ' } }))).toThrow(
      /unitLabel/i,
    );
  });

  it('rejects displayQuantity with overlong unitLabel (>24 chars)', () => {
    expect(() =>
      validateIngredientShape(untracked({ displayQuantity: { amount: 1, unitLabel: 'a'.repeat(25) } })),
    ).toThrow(/24/);
  });

  it('rejects displayQuantity with negative amount', () => {
    expect(() => validateIngredientShape(untracked({ displayQuantity: { amount: -1, unitLabel: 'TL' } }))).toThrow(
      /displayQuantity\.amount/,
    );
  });

  it('accepts a legacy untracked row without displayQuantity', () => {
    expect(() => validateIngredientShape(untracked({ amount: 5 }))).not.toThrow();
  });

  it('accepts a legacy tracked row without displayQuantity', () => {
    expect(() => validateIngredientShape(tracked())).not.toThrow();
  });
});
