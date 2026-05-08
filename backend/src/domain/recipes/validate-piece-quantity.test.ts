import { describe, it, expect } from 'vitest';
import { validatePieceQuantity } from './validate-piece-quantity.ts';
import type { RecipeIngredient } from './types.ts';

const base: RecipeIngredient = {
  name: 'Zwiebel',
  unit: 'g',
  macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
  amount: 150,
  pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
};

describe('validatePieceQuantity', () => {
  it('passes when pieceQuantity is absent', () => {
    expect(() => validatePieceQuantity({ ...base, pieceQuantity: undefined })).not.toThrow();
  });

  it('passes when amount equals pieceAmount * gramsPerPiece', () => {
    expect(() => validatePieceQuantity(base)).not.toThrow();
  });

  it('passes within 5 percent tolerance', () => {
    expect(() => validatePieceQuantity({ ...base, amount: 154 })).not.toThrow();
    expect(() => validatePieceQuantity({ ...base, amount: 146 })).not.toThrow();
  });

  it('rejects when amount diverges beyond 5 percent', () => {
    expect(() => validatePieceQuantity({ ...base, amount: 200 })).toThrow(/does not match/i);
  });

  it('rejects non-mass units', () => {
    expect(() =>
      validatePieceQuantity({
        ...base,
        unit: 'tbsp',
        amount: 2,
        pieceQuantity: { amount: 2, unitLabel: 'tbsp', gramsPerPiece: 14 },
      }),
    ).toThrow(/mass unit/i);
  });

  it('accepts ml as a mass unit for liquid pieces', () => {
    expect(() =>
      validatePieceQuantity({
        ...base,
        name: 'Lemon juice',
        unit: 'ml',
        amount: 30,
        pieceQuantity: { amount: 1, unitLabel: 'lemon', gramsPerPiece: 30 },
      }),
    ).not.toThrow();
  });

  it('rejects non-positive pieceAmount', () => {
    expect(() =>
      validatePieceQuantity({ ...base, pieceQuantity: { amount: 0, unitLabel: 'Zwiebel', gramsPerPiece: 150 } }),
    ).toThrow(/amount/i);
  });

  it('rejects non-positive gramsPerPiece', () => {
    expect(() =>
      validatePieceQuantity({ ...base, pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 0 } }),
    ).toThrow(/gramsPerPiece/i);
  });

  it('rejects empty unitLabel', () => {
    expect(() =>
      validatePieceQuantity({ ...base, pieceQuantity: { amount: 1, unitLabel: '   ', gramsPerPiece: 150 } }),
    ).toThrow(/unitLabel/i);
  });
});
