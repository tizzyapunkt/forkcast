import { describe, it, expect } from 'vitest';
import { validateFoodEntry } from './validate-food-entry.ts';

const valid = {
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte', 'carrot'],
  unit: 'g' as const,
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  pieces: [{ label: 'mittel', grams: 75 }],
};

describe('validateFoodEntry', () => {
  it('accepts a complete entry with pieces', () => {
    const result = validateFoodEntry(valid);
    expect(result.ok).toBe(true);
  });

  it('accepts an entry without pieces', () => {
    const result = validateFoodEntry({ ...valid, pieces: undefined });
    expect(result.ok).toBe(true);
  });

  it('rejects an entry whose calories is null', () => {
    const result = validateFoodEntry({
      ...valid,
      macrosPer100: { ...valid.macrosPer100, calories: null as unknown as number },
    });
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/calories/i) });
  });

  it('rejects an entry whose calories is negative', () => {
    const result = validateFoodEntry({
      ...valid,
      macrosPer100: { ...valid.macrosPer100, calories: -1 },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an entry where the canonical name appears in synonyms (case-insensitive)', () => {
    const result = validateFoodEntry({ ...valid, synonyms: ['möhre', 'Karotte'] });
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/synonym/i) });
  });

  it('rejects a piece weight with zero grams', () => {
    const result = validateFoodEntry({ ...valid, pieces: [{ label: 'klein', grams: 0 }] });
    expect(result.ok).toBe(false);
  });

  it('rejects a piece weight with negative grams', () => {
    const result = validateFoodEntry({ ...valid, pieces: [{ label: 'klein', grams: -10 }] });
    expect(result.ok).toBe(false);
  });

  it('rejects a piece weight whose grams is not finite', () => {
    const result = validateFoodEntry({ ...valid, pieces: [{ label: 'klein', grams: Infinity }] });
    expect(result.ok).toBe(false);
  });

  it('rejects duplicate piece labels within an entry', () => {
    const result = validateFoodEntry({
      ...valid,
      pieces: [
        { label: 'mittel', grams: 75 },
        { label: 'mittel', grams: 100 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-g/ml unit', () => {
    const result = validateFoodEntry({ ...valid, unit: 'piece' as unknown as 'g' });
    expect(result.ok).toBe(false);
  });

  it('rejects a missing id', () => {
    const result = validateFoodEntry({ ...valid, id: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects a missing canonical name', () => {
    const result = validateFoodEntry({ ...valid, name: '' });
    expect(result.ok).toBe(false);
  });

  it('accepts an untracked entry with all-zero macros', () => {
    const result = validateFoodEntry({
      id: 'salz',
      name: 'Salz',
      synonyms: ['Speisesalz', 'salt'],
      unit: 'g',
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      untracked: true,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an untracked entry with non-zero calories', () => {
    const result = validateFoodEntry({
      id: 'salz',
      name: 'Salz',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 12, protein: 0, carbs: 0, fat: 0 },
      untracked: true,
    });
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/untracked.*all-zero/i) });
  });

  it('rejects an untracked entry with any non-zero macro', () => {
    for (const macro of ['protein', 'carbs', 'fat'] as const) {
      const result = validateFoodEntry({
        id: 'x',
        name: 'X',
        synonyms: [],
        unit: 'g',
        macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0, [macro]: 1 },
        untracked: true,
      });
      expect(result.ok).toBe(false);
    }
  });

  it('rejects an entry whose untracked is not a boolean', () => {
    const result = validateFoodEntry({
      id: 'x',
      name: 'X',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      untracked: 'yes' as unknown as boolean,
    });
    expect(result.ok).toBe(false);
  });
});
