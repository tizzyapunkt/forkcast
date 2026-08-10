import { describe, it, expect } from 'vitest';
import { validateCatalogEntry, findCatalogCollision } from './validate-catalog-entry.ts';
import type { FoodEntry } from '../foods/types.ts';

const entry = (overrides: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte', 'carrot'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  ...overrides,
});

describe('validateCatalogEntry', () => {
  it('accepts a well-formed entry', () => {
    const result = validateCatalogEntry(entry());
    expect(result.ok).toBe(true);
  });

  it('rejects a canonical name repeated in synonyms, ignoring case and diacritics', () => {
    const result = validateCatalogEntry(entry({ synonyms: ['möhre'] }));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('moehre') });
  });

  it('rejects a unit other than g or ml', () => {
    const result = validateCatalogEntry(entry({ unit: 'tbsp' as 'g' }));
    expect(result.ok).toBe(false);
  });

  it('rejects non-finite or negative macros', () => {
    expect(validateCatalogEntry(entry({ macrosPer100: { calories: -1, protein: 0, carbs: 0, fat: 0 } })).ok).toBe(
      false,
    );
    expect(
      validateCatalogEntry(entry({ macrosPer100: { calories: Number.NaN, protein: 0, carbs: 0, fat: 0 } })).ok,
    ).toBe(false);
    expect(
      validateCatalogEntry(
        entry({ macrosPer100: { calories: 10, protein: 0, carbs: 0, fat: null as unknown as number } }),
      ).ok,
    ).toBe(false);
  });

  it('rejects an untracked entry carrying non-zero macros', () => {
    const result = validateCatalogEntry(
      entry({ untracked: true, macrosPer100: { calories: 12, protein: 0, carbs: 0, fat: 0 } }),
    );
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('moehre') });
  });

  it('accepts an untracked entry with all-zero macros', () => {
    const result = validateCatalogEntry(
      entry({ id: 'salz', name: 'Salz', untracked: true, macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 } }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate piece labels and non-positive piece weights', () => {
    expect(
      validateCatalogEntry(
        entry({
          pieces: [
            { label: 'mittel', grams: 80 },
            { label: 'mittel', grams: 120 },
          ],
        }),
      ).ok,
    ).toBe(false);
    expect(validateCatalogEntry(entry({ pieces: [{ label: 'mittel', grams: 0 }] })).ok).toBe(false);
  });

  it('accepts unique piece labels with positive weights', () => {
    expect(
      validateCatalogEntry(
        entry({
          pieces: [
            { label: 'klein', grams: 60 },
            { label: 'mittel', grams: 80 },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it('rejects an id that is not lowercase ASCII kebab-case', () => {
    for (const id of [
      'Moehre',
      'speisestärke',
      'moehre_gross',
      'moehre gross',
      '-moehre',
      'moehre-',
      'moehre--gross',
    ]) {
      const result = validateCatalogEntry(entry({ id }));
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain(id);
    }
  });

  it('accepts kebab-case ids with digits', () => {
    expect(validateCatalogEntry(entry({ id: 'weizenmehl-405' })).ok).toBe(true);
  });
});

describe('findCatalogCollision', () => {
  const catalog = [entry(), entry({ id: 'salz', name: 'Salz', synonyms: [] })];

  it('reports no collision for a genuinely new entry', () => {
    expect(findCatalogCollision(catalog, entry({ id: 'pfeffer', name: 'Pfeffer' }))).toBeNull();
  });

  it('reports a collision when the id already exists', () => {
    expect(findCatalogCollision(catalog, entry({ id: 'salz', name: 'Meersalz' }))).toContain('salz');
  });

  it('reports a collision when the folded canonical name already exists', () => {
    expect(findCatalogCollision(catalog, entry({ id: 'moehre-neu', name: 'mohre' }))).toContain('Möhre');
  });

  it('ignores the entry being replaced when an id is excluded', () => {
    expect(findCatalogCollision(catalog, entry({ name: 'Möhre gelb' }), 'moehre')).toBeNull();
  });

  it('still reports a collision against a different entry when an id is excluded', () => {
    expect(findCatalogCollision(catalog, entry({ id: 'moehre', name: 'Salz' }), 'moehre')).toContain('Salz');
  });
});
