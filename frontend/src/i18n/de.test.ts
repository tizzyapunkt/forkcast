import { describe, it, expect } from 'vitest';
import { de } from './de';

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
  it('multiplies all four macros by 100 and labels with 100g for solids', () => {
    expect(de.fullEntry.perUnit('g', 3.7, 0.13, 0.66, 0.07)).toBe('pro 100g — 370 kcal · 13g P · 66g K · 7g F');
  });

  it('multiplies all four macros by 100 and labels with 100ml for liquids', () => {
    expect(de.fullEntry.perUnit('ml', 0.47, 0.034, 0.05, 0.018)).toBe('pro 100ml — 47 kcal · 3g P · 5g K · 2g F');
  });

  it('falls back to per-unit display for non-mass/volume units', () => {
    expect(de.fullEntry.perUnit('piece', 80, 4, 12, 2)).toBe('pro piece — 80 kcal · 4g P · 12g K · 2g F');
  });
});

describe('de.recipeIngredientPicker.perUnit', () => {
  it('mirrors the fullEntry.perUnit rule for solids', () => {
    expect(de.recipeIngredientPicker.perUnit('g', 3.7, 0.13, 0.66, 0.07)).toBe(
      'pro 100g — 370 kcal · 13g P · 66g K · 7g F',
    );
  });

  it('mirrors the fullEntry.perUnit rule for liquids', () => {
    expect(de.recipeIngredientPicker.perUnit('ml', 0.47, 0.034, 0.05, 0.018)).toBe(
      'pro 100ml — 47 kcal · 3g P · 5g K · 2g F',
    );
  });

  it('falls back to per-unit display for non-mass/volume units', () => {
    expect(de.recipeIngredientPicker.perUnit('piece', 80, 4, 12, 2)).toBe('pro piece — 80 kcal · 4g P · 12g K · 2g F');
  });
});
