import { describe, it, expect } from 'vitest';
import { spoonVolumeMl, convertSpoonMeasure } from './convert-spoon-amount.ts';

describe('spoonVolumeMl', () => {
  it('maps teaspoon labels (German + English) to 5 ml', () => {
    for (const label of ['TL', 'tl', 'Teelöffel', 'teeloeffel', 'tsp', 'teaspoon']) {
      expect(spoonVolumeMl(label)).toBe(5);
    }
  });

  it('maps tablespoon labels to 15 ml', () => {
    for (const label of ['EL', 'el', 'Esslöffel', 'essloeffel', 'tbsp', 'tablespoon']) {
      expect(spoonVolumeMl(label)).toBe(15);
    }
  });

  it('maps cup labels to 240 ml', () => {
    expect(spoonVolumeMl('Tasse')).toBe(240);
    expect(spoonVolumeMl('cup')).toBe(240);
  });

  it('tolerates surrounding whitespace and a trailing period', () => {
    expect(spoonVolumeMl('  EL.  ')).toBe(15);
  });

  it('returns undefined for non-spoon / qualitative labels', () => {
    for (const label of ['Prise', 'Schuss', 'Spritzer', 'n. Geschmack', 'g', 'ml', '']) {
      expect(spoonVolumeMl(label)).toBeUndefined();
    }
  });
});

describe('convertSpoonMeasure', () => {
  it('converts a spoon of an ml-unit food to a volume without density', () => {
    expect(convertSpoonMeasure({ count: 2, label: 'EL', unit: 'ml' })).toEqual({ amount: 30, estimated: false });
    expect(convertSpoonMeasure({ count: 2, label: 'TL', unit: 'ml' })).toEqual({ amount: 10, estimated: false });
  });

  it('converts a spoon of a g-unit food using density', () => {
    // 2 TL × 5 ml × 0.55 g/ml = 5.5 g
    expect(convertSpoonMeasure({ count: 2, label: 'TL', unit: 'g', density: 0.55 })).toEqual({
      amount: 5.5,
      estimated: false,
    });
  });

  it('rounds the result to one decimal place', () => {
    // 1 EL × 15 ml × 0.53 = 7.95 → 8.0 (one decimal)
    expect(convertSpoonMeasure({ count: 1, label: 'EL', unit: 'g', density: 0.53 })?.amount).toBe(8);
    // 3 TL × 1.37 g = 4.11 → 4.1
    expect(convertSpoonMeasure({ count: 3, label: 'TL', unit: 'g', gramsPerSpoon: 1.37 })?.amount).toBe(4.1);
  });

  it('defaults a missing count to 1 spoon', () => {
    expect(convertSpoonMeasure({ label: 'EL', unit: 'ml' })?.amount).toBe(15);
    expect(convertSpoonMeasure({ label: 'EL', unit: 'g', gramsPerSpoon: 8 })?.amount).toBe(8);
  });

  it('uses the per-spoon estimate for a g-unit food without density, and says so', () => {
    expect(convertSpoonMeasure({ count: 2, label: 'EL', unit: 'g', gramsPerSpoon: 8 })).toEqual({
      amount: 16,
      estimated: true,
    });
  });

  it('prefers density over the estimate', () => {
    expect(convertSpoonMeasure({ count: 2, label: 'TL', unit: 'g', density: 0.55, gramsPerSpoon: 4 })).toEqual({
      amount: 5.5,
      estimated: false,
    });
  });

  it('ignores the estimate for an ml-unit food', () => {
    expect(convertSpoonMeasure({ count: 1, label: 'EL', unit: 'ml', gramsPerSpoon: 13 })).toEqual({
      amount: 15,
      estimated: false,
    });
  });

  it('does not convert a g-unit food with neither density nor a usable estimate', () => {
    expect(convertSpoonMeasure({ count: 2, label: 'TL', unit: 'g' })).toBeUndefined();
    expect(convertSpoonMeasure({ count: 2, label: 'TL', unit: 'g', gramsPerSpoon: 0 })).toBeUndefined();
    expect(convertSpoonMeasure({ count: 2, label: 'TL', unit: 'g', gramsPerSpoon: -3 })).toBeUndefined();
    expect(convertSpoonMeasure({ count: 2, label: 'TL', unit: 'g', gramsPerSpoon: Number.NaN })).toBeUndefined();
  });

  it('does not convert a non-spoon label, even with an estimate', () => {
    expect(convertSpoonMeasure({ count: 1, label: 'Prise', unit: 'g', density: 0.55 })).toBeUndefined();
    expect(convertSpoonMeasure({ count: 1, label: 'Prise', unit: 'g', gramsPerSpoon: 0.3 })).toBeUndefined();
    expect(convertSpoonMeasure({ count: 2, label: 'Schuss', unit: 'ml' })).toBeUndefined();
  });

  it('returns undefined for a missing label', () => {
    expect(convertSpoonMeasure({ count: 2, unit: 'ml' })).toBeUndefined();
  });

  it('returns undefined for a non-positive count', () => {
    expect(convertSpoonMeasure({ count: 0, label: 'EL', unit: 'ml' })).toBeUndefined();
    expect(convertSpoonMeasure({ count: -1, label: 'EL', unit: 'ml' })).toBeUndefined();
  });

  it('does not convert into a non-mass unit', () => {
    expect(convertSpoonMeasure({ count: 1, label: 'EL', unit: 'piece', gramsPerSpoon: 8 })).toBeUndefined();
  });
});
