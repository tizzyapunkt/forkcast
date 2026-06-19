import { describe, it, expect } from 'vitest';
import { buildMatchedRowWithFlags, type MatchSourceFood, type OriginalDraftFields } from './build-matched-row.ts';

const macros = { calories: 3.81, protein: 0.006, carbs: 0.91, fat: 0.001 };

const trackedG = (density?: number): MatchSourceFood => ({
  name: 'Speisestärke',
  unit: 'g',
  macrosPerUnit: macros,
  density,
});

const trackedMl: MatchSourceFood = {
  name: 'Sojasauce',
  unit: 'ml',
  macrosPerUnit: { calories: 0.6, protein: 0.08, carbs: 0.05, fat: 0 },
};

const untrackedG: MatchSourceFood = {
  name: 'Ingwer',
  unit: 'g',
  macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  untracked: true,
};

describe('buildMatchedRowWithFlags — spoon conversion on tracked matches', () => {
  it('converts a spoon measure of a g-unit food using density', () => {
    const raw: OriginalDraftFields = { rawDisplayAmount: 2, rawDisplayUnitLabel: 'TL' };
    const { row, flags } = buildMatchedRowWithFlags(trackedG(0.55), 'FOODS', raw);

    expect(row.amount).toBeCloseTo(5.5);
    expect(row.unit).toBe('g');
    expect(row.untracked).toBeUndefined();
    expect(row.displayQuantity).toBeUndefined();
    expect(flags.missingAmount).toBe(false);
  });

  it('converts a spoon measure of an ml-unit food without density', () => {
    const raw: OriginalDraftFields = { rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL' };
    const { row, flags } = buildMatchedRowWithFlags(trackedMl, 'FOODS', raw);

    expect(row.amount).toBe(30);
    expect(row.unit).toBe('ml');
    expect(row.displayQuantity).toBeUndefined();
    expect(flags.missingAmount).toBe(false);
  });

  it('leaves a g-unit food without density unconverted and flags missingAmount', () => {
    const raw: OriginalDraftFields = { rawDisplayAmount: 1, rawDisplayUnitLabel: 'EL' };
    const { row, flags } = buildMatchedRowWithFlags(trackedG(undefined), 'FOODS', raw);

    expect(row.amount).toBeNull();
    expect(row.displayQuantity).toBeUndefined();
    expect(flags.missingAmount).toBe(true);
  });

  it('does not convert a non-spoon raw-display label', () => {
    const raw: OriginalDraftFields = { rawDisplayAmount: 1, rawDisplayUnitLabel: 'Prise' };
    const { row, flags } = buildMatchedRowWithFlags(trackedG(0.55), 'FOODS', raw);

    expect(row.amount).toBeNull();
    expect(flags.missingAmount).toBe(true);
  });

  it('keeps a stated canonical amount over any conversion', () => {
    const raw: OriginalDraftFields = { amount: 12, unit: 'g', rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL' };
    const { row } = buildMatchedRowWithFlags(trackedG(0.55), 'FOODS', raw);

    expect(row.amount).toBe(12);
  });

  it('leaves the untracked path unchanged — spoons become a displayQuantity, amount 0, no macros', () => {
    const raw: OriginalDraftFields = { rawDisplayAmount: 2, rawDisplayUnitLabel: 'TL' };
    const { row } = buildMatchedRowWithFlags(untrackedG, 'FOODS', raw);

    expect(row.untracked).toBe(true);
    expect(row.amount).toBe(0);
    expect(row.displayQuantity).toEqual({ amount: 2, unitLabel: 'TL' });
  });
});
