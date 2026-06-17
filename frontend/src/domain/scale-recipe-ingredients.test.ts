import { describe, it, expect } from 'vitest';
import { scaleIngredients } from './scale-recipe-ingredients';
import type { RecipeIngredient } from './recipes';

const onion: RecipeIngredient = {
  name: 'Zwiebel',
  unit: 'g',
  macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
  amount: 150,
  pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
};

const flour: RecipeIngredient = {
  name: 'Mehl',
  unit: 'g',
  macrosPerUnit: { calories: 3.4, protein: 0.1, carbs: 0.7, fat: 0.01 },
  amount: 200,
};

describe('scaleIngredients', () => {
  it('doubles count and amount with factor 2; gramsPerPiece invariant', () => {
    const [scaled] = scaleIngredients([onion], 2);
    expect(scaled!.amount).toBe(300);
    expect(scaled!.pieceQuantity).toEqual({ amount: 2, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });

  it('halves count and amount with factor 0.5', () => {
    const [scaled] = scaleIngredients([onion], 0.5);
    expect(scaled!.amount).toBe(75);
    expect(scaled!.pieceQuantity).toEqual({ amount: 0.5, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });

  it('scales mass-only rows without touching missing pieceQuantity', () => {
    const [scaled] = scaleIngredients([flour], 2);
    expect(scaled!.amount).toBe(400);
    expect(scaled!.pieceQuantity).toBeUndefined();
  });

  it('returns the input unchanged when factor is invalid (NaN, 0, negative)', () => {
    expect(scaleIngredients([onion], Number.NaN)).toEqual([onion]);
    expect(scaleIngredients([onion], 0)).toEqual([onion]);
    expect(scaleIngredients([onion], -1)).toEqual([onion]);
  });

  it('preserves the invariant amount === pieceAmount * gramsPerPiece after scaling', () => {
    const [scaled] = scaleIngredients([onion], 1.5);
    if (!scaled?.pieceQuantity) throw new Error('expected piece quantity');
    expect(scaled.amount).toBeCloseTo(scaled.pieceQuantity.amount * scaled.pieceQuantity.gramsPerPiece, 1);
  });

  it('scales displayQuantity.amount and keeps unitLabel invariant', () => {
    const salt: RecipeIngredient = {
      name: 'Salz',
      unit: 'g',
      macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      amount: 0,
      untracked: true,
      displayQuantity: { amount: 1, unitLabel: 'TL' },
    };
    const [scaled2] = scaleIngredients([salt], 2);
    expect(scaled2!.displayQuantity).toEqual({ amount: 2, unitLabel: 'TL' });
    const [scaledHalf] = scaleIngredients([salt], 0.5);
    expect(scaledHalf!.displayQuantity).toEqual({ amount: 0.5, unitLabel: 'TL' });
  });

  it('leaves a qualitative displayQuantity (no amount) untouched while scaling', () => {
    const salt: RecipeIngredient = {
      name: 'Salz',
      unit: 'g',
      macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      amount: 0,
      untracked: true,
      displayQuantity: { unitLabel: 'nach Geschmack' },
    };
    const [scaled] = scaleIngredients([salt], 2);
    expect(scaled!.displayQuantity).toEqual({ unitLabel: 'nach Geschmack' });
  });

  it('scales both piece-tracked and displayQuantity rows together when they coexist in a recipe', () => {
    const salt: RecipeIngredient = {
      name: 'Salz',
      unit: 'g',
      macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      amount: 0,
      untracked: true,
      displayQuantity: { amount: 1, unitLabel: 'Prise' },
    };
    const scaled = scaleIngredients([onion, salt], 3);
    expect(scaled[0]!.pieceQuantity).toEqual({ amount: 3, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
    expect(scaled[1]!.displayQuantity).toEqual({ amount: 3, unitLabel: 'Prise' });
  });
});
