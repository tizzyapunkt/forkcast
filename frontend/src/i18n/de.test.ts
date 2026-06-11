import { describe, it, expect } from 'vitest';
import { de, formatMacroTriplet } from './de';

describe('formatMacroTriplet', () => {
  it('renders middot-separated values with P/KH/F labels and no g suffix', () => {
    expect(formatMacroTriplet(52, 0, 30)).toBe('52 P · 0 KH · 30 F');
  });

  it('rounds each value to the nearest integer', () => {
    expect(formatMacroTriplet(31.4, 59.6, 7.2)).toBe('31 P · 60 KH · 7 F');
  });

  it('renders zeros for an empty triplet', () => {
    expect(formatMacroTriplet(0, 0, 0)).toBe('0 P · 0 KH · 0 F');
  });
});

describe('de.dailyLog.macroInline', () => {
  it('prefixes the unified triplet with a middot for use as a kcal suffix', () => {
    expect(de.dailyLog.macroInline(52, 0, 30)).toBe('· 52 P · 0 KH · 30 F');
  });
});

describe('de.recipes.macroLine', () => {
  it('renders the unified triplet with a / Portion rate suffix', () => {
    expect(de.recipes.macroLine(500, 40, 0, 36)).toBe('500 kcal · 40 P · 0 KH · 36 F / Portion');
  });
});

describe('de.recipeTotals.summary', () => {
  it('renders kcal followed by the unified triplet', () => {
    expect(de.recipeTotals.summary(200, 20, 10, 10)).toBe('200 kcal · 20 P · 10 KH · 10 F');
  });
});

describe('de.searchPanel.kcalPer', () => {
  it('multiplies by 100 and labels with 100g for solids', () => {
    expect(de.searchPanel.kcalPer(3.7, 'g')).toBe('370 kcal / 100g');
  });

  it('multiplies by 100 and labels with 100ml for liquids', () => {
    expect(de.searchPanel.kcalPer(0.47, 'ml')).toBe('47 kcal / 100ml');
  });

  it('rounds to whole numbers', () => {
    expect(de.searchPanel.kcalPer(3.89, 'g')).toBe('389 kcal / 100g');
  });

  it('falls back to per-unit display for piece', () => {
    expect(de.searchPanel.kcalPer(80, 'piece')).toBe('80 kcal / piece');
  });

  it('falls back to per-unit display for cup', () => {
    expect(de.searchPanel.kcalPer(2, 'cup')).toBe('2 kcal / cup');
  });
});

describe('de.recentPanel.kcalPer', () => {
  it('uses the same per-100 rule as the search panel for g', () => {
    expect(de.recentPanel.kcalPer(3.7, 'g')).toBe('370 kcal / 100g');
  });

  it('uses the same per-100 rule as the search panel for ml', () => {
    expect(de.recentPanel.kcalPer(0.47, 'ml')).toBe('47 kcal / 100ml');
  });

  it('falls back to per-unit display for piece', () => {
    expect(de.recentPanel.kcalPer(80, 'piece')).toBe('80 kcal / piece');
  });

  it('falls back to per-unit display for cup', () => {
    expect(de.recentPanel.kcalPer(2, 'cup')).toBe('2 kcal / cup');
  });
});

describe('de.fullEntry.perUnit', () => {
  it('renders the kcal rate with a slash and the macro triplet with middots for solids', () => {
    expect(de.fullEntry.perUnit('g', 3.7, 0.13, 0.66, 0.07)).toBe('370 kcal / 100g · 13 P · 66 KH · 7 F');
  });

  it('renders the per-100 rate for liquids', () => {
    expect(de.fullEntry.perUnit('ml', 0.47, 0.034, 0.05, 0.018)).toBe('47 kcal / 100ml · 3 P · 5 KH · 2 F');
  });

  it('falls back to per-unit display for non-mass/volume units', () => {
    expect(de.fullEntry.perUnit('piece', 80, 4, 12, 2)).toBe('80 kcal / piece · 4 P · 12 KH · 2 F');
  });
});

describe('de.recipeIngredientPicker.perUnit', () => {
  it('mirrors the fullEntry.perUnit rule for solids', () => {
    expect(de.recipeIngredientPicker.perUnit('g', 3.7, 0.13, 0.66, 0.07)).toBe('370 kcal / 100g · 13 P · 66 KH · 7 F');
  });

  it('mirrors the fullEntry.perUnit rule for liquids', () => {
    expect(de.recipeIngredientPicker.perUnit('ml', 0.47, 0.034, 0.05, 0.018)).toBe(
      '47 kcal / 100ml · 3 P · 5 KH · 2 F',
    );
  });

  it('falls back to per-unit display for non-mass/volume units', () => {
    expect(de.recipeIngredientPicker.perUnit('piece', 80, 4, 12, 2)).toBe('80 kcal / piece · 4 P · 12 KH · 2 F');
  });
});
