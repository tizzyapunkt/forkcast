import { describe, it, expect } from 'vitest';
import { rankFoods } from './rank-food-entries.ts';
import type { FoodEntry } from './types.ts';

function entry(name: string, synonyms: string[] = []): FoodEntry {
  return {
    id: name.toLowerCase(),
    name,
    synonyms,
    unit: 'g',
    macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
}

describe('rankFoods — match confidence', () => {
  it('still returns a prefix-into-compound hit, marked partial', () => {
    const results = rankFoods([entry('Honigmelone')], 'Honig', 'CATALOG');
    expect(results.map((r) => [r.name, r.matchConfidence])).toEqual([['Honigmelone', 'partial']]);
  });

  it('marks each result without changing the ranking', () => {
    const results = rankFoods([entry('Kichererbsenmehl'), entry('Kichererbsen')], 'Kichererbse', 'CATALOG');
    expect(results.map((r) => [r.name, r.matchConfidence])).toEqual([
      ['Kichererbsen', 'confident'],
      ['Kichererbsenmehl', 'partial'],
    ]);
  });

  it('marks a synonym match as confident', () => {
    const results = rankFoods([entry('Erdnussbutter', ['Erdnussmus'])], 'Erdnussmus', 'CATALOG');
    expect(results[0]?.matchConfidence).toBe('confident');
  });
});
