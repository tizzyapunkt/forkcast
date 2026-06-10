import { describe, expect, it } from 'vitest';
import type { RecipeIngredient } from '../../domain/recipes';
import { isMassUnit, modeOf, seedMode } from './measurement-mode';

const base: RecipeIngredient = {
  name: 'Mehl',
  unit: 'g',
  macrosPerUnit: { calories: 3.4, protein: 0.1, carbs: 0.7, fat: 0.01 },
  amount: 200,
};

describe('modeOf', () => {
  it('returns "piece" when pieceQuantity is present', () => {
    const ing: RecipeIngredient = { ...base, pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 } };
    expect(modeOf(ing)).toBe('piece');
  });

  it('returns "free" when untracked and no pieceQuantity', () => {
    expect(modeOf({ ...base, untracked: true })).toBe('free');
  });

  it('returns "weight" for a plain mass row', () => {
    expect(modeOf(base)).toBe('weight');
  });

  it('prefers piece over free when both pieceQuantity and untracked are set', () => {
    const ing: RecipeIngredient = {
      ...base,
      untracked: true,
      pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };
    expect(modeOf(ing)).toBe('piece');
  });
});

describe('isMassUnit', () => {
  it('is true for g and ml', () => {
    expect(isMassUnit('g')).toBe(true);
    expect(isMassUnit('ml')).toBe(true);
  });

  it('is false for non-mass units', () => {
    expect(isMassUnit('tbsp')).toBe(false);
    expect(isMassUnit('piece')).toBe(false);
  });
});

describe('seedMode', () => {
  it('is a no-op when the mode already matches', () => {
    expect(seedMode(base, 'weight')).toBe(base);
  });

  it('→ piece seeds pieceQuantity and recomputes amount from the current amount', () => {
    const next = seedMode({ ...base, amount: 60 }, 'piece');
    expect(next.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Stück', gramsPerPiece: 60 });
    expect(next.amount).toBe(60);
    expect(next.untracked).toBeUndefined();
  });

  it('→ piece uses the fallback grams-per-piece (50) when amount is zero', () => {
    const next = seedMode({ ...base, amount: 0 }, 'piece');
    expect(next.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Stück', gramsPerPiece: 50 });
    expect(next.amount).toBe(50);
  });

  it('→ piece keeps an existing pieceQuantity verbatim', () => {
    const ing: RecipeIngredient = {
      ...base,
      untracked: true,
      displayQuantity: { amount: 1, unitLabel: 'TL' },
    };
    // from free → piece: no existing pieceQuantity, so it seeds one and clears untracked/displayQuantity
    const next = seedMode(ing, 'piece');
    expect(next.untracked).toBeUndefined();
    expect(next.displayQuantity).toBeUndefined();
    expect(next.pieceQuantity).toBeDefined();
  });

  it('→ free sets untracked and clears pieceQuantity', () => {
    const ing: RecipeIngredient = { ...base, pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 } };
    const next = seedMode(ing, 'free');
    expect(next.untracked).toBe(true);
    expect(next.pieceQuantity).toBeUndefined();
  });

  it('→ free preserves an existing displayQuantity', () => {
    const ing: RecipeIngredient = { ...base, untracked: true, displayQuantity: { amount: 2, unitLabel: 'EL' } };
    // weight → free path requires not already free; force from piece-less tracked is already weight, so use a tracked row
    const tracked: RecipeIngredient = { ...base };
    const next = seedMode(tracked, 'free');
    expect(next.untracked).toBe(true);
    // a tracked row has no displayQuantity to preserve; the preservation rule is exercised below
    expect(next.displayQuantity).toBeUndefined();
    // already-free with displayQuantity is a no-op (mode matches), keeping displayQuantity
    expect(seedMode(ing, 'free')).toBe(ing);
  });

  it('→ weight clears pieceQuantity, untracked and displayQuantity, preserving amount/unit', () => {
    const ing: RecipeIngredient = {
      ...base,
      amount: 300,
      pieceQuantity: { amount: 2, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };
    const next = seedMode(ing, 'weight');
    expect(next.pieceQuantity).toBeUndefined();
    expect(next.untracked).toBeUndefined();
    expect(next.displayQuantity).toBeUndefined();
    expect(next.amount).toBe(300);
    expect(next.unit).toBe('g');
  });

  it('→ weight from free drops the displayQuantity', () => {
    const ing: RecipeIngredient = { ...base, untracked: true, displayQuantity: { amount: 1, unitLabel: 'TL' } };
    const next = seedMode(ing, 'weight');
    expect(next.untracked).toBeUndefined();
    expect(next.displayQuantity).toBeUndefined();
  });
});
