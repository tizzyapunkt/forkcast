import { describe, it, expect } from 'vitest';
import { normalizeIngredientName } from './normalize-ingredient-name.ts';

describe('normalizeIngredientName', () => {
  it('strips a trailing comma-suffix preparation modifier', () => {
    expect(normalizeIngredientName('Ingwer, fein gehackt')).toBe('Ingwer');
    expect(normalizeIngredientName('Knoblauchzehe, fein gehackt')).toBe('Knoblauchzehe');
    expect(normalizeIngredientName('Tomaten, geschält')).toBe('Tomaten');
  });

  it('strips trailing parenthetical content', () => {
    expect(normalizeIngredientName('Olivenöl (extra vergine)')).toBe('Olivenöl');
    expect(normalizeIngredientName('Tomaten (gehackt aus der Dose)')).toBe('Tomaten');
  });

  it('strips comma-suffix and parenthetical together', () => {
    expect(normalizeIngredientName('Ingwer, fein gehackt (frisch)')).toBe('Ingwer');
  });

  it('preserves leading qualifiers that change the food (e.g. sugar-free, smoked)', () => {
    expect(normalizeIngredientName('Zuckerfreier Ahornsirup')).toBe('Zuckerfreier Ahornsirup');
    expect(normalizeIngredientName('Geräucherter Lachs')).toBe('Geräucherter Lachs');
  });

  it('collapses surrounding whitespace after stripping', () => {
    expect(normalizeIngredientName('  Ingwer  ,  fein gehackt  ')).toBe('Ingwer');
    expect(normalizeIngredientName('Tomaten   (frisch)')).toBe('Tomaten');
  });

  it('returns the original (trimmed) name when nothing strips', () => {
    expect(normalizeIngredientName('Olivenöl')).toBe('Olivenöl');
    expect(normalizeIngredientName('  Olivenöl  ')).toBe('Olivenöl');
  });

  it('returns the original (trimmed) name when stripping would leave nothing', () => {
    expect(normalizeIngredientName(', fein gehackt')).toBe(', fein gehackt');
    expect(normalizeIngredientName('(extra)')).toBe('(extra)');
  });

  it('does not strip across an internal comma when there is content on both sides treated as one name', () => {
    // We only strip a single trailing ", ..." suffix, not commas embedded mid-name.
    // For our purposes any trailing comma-clause is prep noise, so this is intentional.
    expect(normalizeIngredientName('Pasta, gekocht und abgekühlt')).toBe('Pasta');
  });
});
