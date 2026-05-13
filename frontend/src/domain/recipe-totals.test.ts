import { describe, it, expect } from 'vitest';
import { computeRecipeTotals } from './recipe-totals';
import type { RecipeIngredient } from './recipes';

const oats: RecipeIngredient = {
  name: 'Oats',
  unit: 'g',
  macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 },
  amount: 100,
};

const beef: RecipeIngredient = {
  name: 'Beef',
  unit: 'g',
  macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
  amount: 200,
};

const salt: RecipeIngredient = {
  name: 'Salz',
  unit: 'g',
  macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
  amount: 5,
  untracked: true,
};

describe('computeRecipeTotals', () => {
  it('returns zeros for an empty list', () => {
    const { total, perServing } = computeRecipeTotals([], 1);
    expect(total).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(perServing).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('sums tracked ingredient macros into the total', () => {
    const { total } = computeRecipeTotals([oats], 1);
    expect(total.calories).toBeCloseTo(370, 5);
    expect(total.protein).toBeCloseTo(13, 5);
    expect(total.carbs).toBeCloseTo(66, 5);
    expect(total.fat).toBeCloseTo(7, 5);
  });

  it('divides total by yield for perServing', () => {
    const { total, perServing } = computeRecipeTotals([oats], 2);
    expect(perServing.calories).toBeCloseTo(total.calories / 2, 5);
    expect(perServing.protein).toBeCloseTo(total.protein / 2, 5);
  });

  it('excludes untracked rows from the rollup', () => {
    const { total } = computeRecipeTotals([oats, salt], 1);
    expect(total.calories).toBeCloseTo(370, 5);
    expect(total.fat).toBeCloseTo(7, 5);
  });

  it('sums multiple tracked rows', () => {
    const { total } = computeRecipeTotals([oats, beef], 1);
    expect(total.calories).toBeCloseTo(370 + 500, 5);
    expect(total.protein).toBeCloseTo(13 + 52, 5);
  });

  it('treats non-positive yield as 1', () => {
    const { total: t0, perServing: ps0 } = computeRecipeTotals([oats], 0);
    expect(ps0).toEqual(t0);
    const { total: tn, perServing: psn } = computeRecipeTotals([oats], -3);
    expect(psn).toEqual(tn);
  });

  it('treats non-finite yield as 1', () => {
    const { total, perServing } = computeRecipeTotals([oats], Number.NaN);
    expect(perServing).toEqual(total);
  });
});
