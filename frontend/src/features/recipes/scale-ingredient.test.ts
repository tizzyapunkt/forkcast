import { describe, expect, it } from 'vitest';
import type { RecipeIngredient } from '../../domain/recipes';
import { formatMassAmount, formatPieceCount, scaleIngredient } from './scale-ingredient';

const macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

describe('scaleIngredient', () => {
  it('is a no-op for factor 1', () => {
    const ing: RecipeIngredient = { name: 'Mehl', unit: 'g', macrosPerUnit: macros, amount: 200 };
    expect(scaleIngredient(ing, 1)).toEqual(ing);
  });

  it('scales mass-only rows by the factor', () => {
    const ing: RecipeIngredient = { name: 'Mehl', unit: 'g', macrosPerUnit: macros, amount: 200 };
    expect(scaleIngredient(ing, 2.5)).toEqual({ ...ing, amount: 500 });
  });

  it('halves mass-only rows for factor 0.5', () => {
    const ing: RecipeIngredient = { name: 'Mehl', unit: 'g', macrosPerUnit: macros, amount: 200 };
    expect(scaleIngredient(ing, 0.5).amount).toBe(100);
  });

  it('scales both amount and pieceQuantity.amount, leaving gramsPerPiece and unitLabel invariant', () => {
    const ing: RecipeIngredient = {
      name: 'Zwiebel',
      unit: 'g',
      macrosPerUnit: macros,
      amount: 150,
      pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };

    const doubled = scaleIngredient(ing, 2);
    expect(doubled.amount).toBe(300);
    expect(doubled.pieceQuantity).toEqual({ amount: 2, unitLabel: 'Zwiebel', gramsPerPiece: 150 });

    const halved = scaleIngredient(ing, 0.5);
    expect(halved.amount).toBe(75);
    expect(halved.pieceQuantity).toEqual({ amount: 0.5, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });

  it('preserves the untracked flag and scales the amount identically', () => {
    const ing: RecipeIngredient = {
      name: 'Salz',
      unit: 'g',
      macrosPerUnit: macros,
      amount: 5,
      untracked: true,
    };

    const scaled = scaleIngredient(ing, 4);
    expect(scaled.untracked).toBe(true);
    expect(scaled.amount).toBe(20);
  });

  it('leaves name, unit, and macrosPerUnit unchanged', () => {
    const ing: RecipeIngredient = {
      name: 'Olivenöl',
      unit: 'ml',
      macrosPerUnit: { calories: 8.84, protein: 0, carbs: 0, fat: 1 },
      amount: 30,
    };
    const scaled = scaleIngredient(ing, 3);
    expect(scaled.name).toBe(ing.name);
    expect(scaled.unit).toBe(ing.unit);
    expect(scaled.macrosPerUnit).toEqual(ing.macrosPerUnit);
  });
});

describe('formatMassAmount', () => {
  it('renders integers without decimals', () => {
    expect(formatMassAmount(300)).toBe('300');
    expect(formatMassAmount(75)).toBe('75');
  });

  it('renders one decimal when needed and trims trailing zeros', () => {
    expect(formatMassAmount(12.5)).toBe('12.5');
    expect(formatMassAmount(12.0)).toBe('12');
  });

  it('rounds to at most one decimal', () => {
    expect(formatMassAmount(12.34)).toBe('12.3');
    expect(formatMassAmount(12.36)).toBe('12.4');
  });
});

describe('formatPieceCount', () => {
  it('renders integers without decimals', () => {
    expect(formatPieceCount(2)).toBe('2');
  });

  it('renders up to two decimals and trims trailing zeros', () => {
    expect(formatPieceCount(0.5)).toBe('0.5');
    expect(formatPieceCount(1.33)).toBe('1.33');
    expect(formatPieceCount(1.3)).toBe('1.3');
  });

  it('rounds to at most two decimals', () => {
    expect(formatPieceCount(1.337)).toBe('1.34');
  });
});
