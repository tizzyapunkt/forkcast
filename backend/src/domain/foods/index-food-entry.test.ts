import { describe, it, expect } from 'vitest';
import { indexFoodEntry } from './index-food-entry.ts';
import type { FoodEntry } from './types.ts';

const entry: FoodEntry = {
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte', 'CARROT'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
};

describe('indexFoodEntry', () => {
  it('folds the canonical name (lowercase, no diacritics)', () => {
    expect(indexFoodEntry(entry).nameFolded).toBe('mohre');
  });

  it('folds each synonym in order', () => {
    expect(indexFoodEntry(entry).synonymsFolded).toEqual(['karotte', 'carrot']);
  });

  it('produces an empty synonyms array when input has none', () => {
    expect(indexFoodEntry({ ...entry, synonyms: [] }).synonymsFolded).toEqual([]);
  });

  it('preserves all original entry fields', () => {
    const indexed = indexFoodEntry(entry);
    expect(indexed.id).toBe('moehre');
    expect(indexed.name).toBe('Möhre');
    expect(indexed.synonyms).toEqual(['Karotte', 'CARROT']);
    expect(indexed.unit).toBe('g');
    expect(indexed.macrosPer100).toEqual(entry.macrosPer100);
  });
});
