import { describe, it, expect } from 'vitest';
import { spoonVolumeMl, convertSpoonToAmount } from './convert-spoon-amount.ts';

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

describe('convertSpoonToAmount', () => {
  it('converts a spoon of an ml-unit food to a volume without density', () => {
    expect(convertSpoonToAmount(2, 'EL', 'ml')).toBe(30);
    expect(convertSpoonToAmount(2, 'TL', 'ml')).toBe(10);
  });

  it('converts a spoon of a g-unit food using density', () => {
    // 2 TL × 5 ml × 0.55 g/ml = 5.5 g
    expect(convertSpoonToAmount(2, 'TL', 'g', 0.55)).toBeCloseTo(5.5);
  });

  it('rounds the result to one decimal place', () => {
    // 1 EL × 15 ml × 0.53 = 7.95 → 8.0 (one decimal)
    expect(convertSpoonToAmount(1, 'EL', 'g', 0.53)).toBe(8);
  });

  it('defaults a missing amount to 1 spoon', () => {
    expect(convertSpoonToAmount(undefined, 'EL', 'ml')).toBe(15);
  });

  it('does not convert a g-unit food without a density', () => {
    expect(convertSpoonToAmount(2, 'TL', 'g')).toBeUndefined();
  });

  it('does not convert a non-spoon label', () => {
    expect(convertSpoonToAmount(1, 'Prise', 'g', 0.55)).toBeUndefined();
    expect(convertSpoonToAmount(2, 'Schuss', 'ml')).toBeUndefined();
  });

  it('returns undefined for a missing label', () => {
    expect(convertSpoonToAmount(2, undefined, 'ml')).toBeUndefined();
  });

  it('returns undefined for a non-positive amount', () => {
    expect(convertSpoonToAmount(0, 'EL', 'ml')).toBeUndefined();
    expect(convertSpoonToAmount(-1, 'EL', 'ml')).toBeUndefined();
  });
});
