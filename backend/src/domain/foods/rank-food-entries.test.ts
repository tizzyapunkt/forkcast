import { describe, it, expect } from 'vite-plus/test';
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

describe('rankFoods — English names', () => {
  const withEn = (name: string, nameEn: string, synonyms: string[] = []): FoodEntry => ({
    ...entry(name, synonyms),
    nameEn,
  });

  it('matches an entry by its English name in either locale', () => {
    const catalog = [withEn('Möhre', 'Carrot'), entry('Salz')];
    expect(rankFoods(catalog, 'carrot', 'CATALOG', 'de').map((r) => r.name)).toEqual(['Möhre']);
    expect(rankFoods(catalog, 'carrot', 'CATALOG', 'en').map((r) => r.name)).toEqual(['Carrot']);
  });

  it('matches the German name in the English locale and returns the English name', () => {
    expect(rankFoods([withEn('Apfel', 'Apple')], 'apfel', 'CATALOG', 'en').map((r) => r.name)).toEqual(['Apple']);
  });

  it('falls back to the canonical name in English when an entry has no English name', () => {
    expect(rankFoods([entry('Quark')], 'quark', 'CATALOG', 'en').map((r) => r.name)).toEqual(['Quark']);
  });

  it('defaults to German names', () => {
    expect(rankFoods([withEn('Apfel', 'Apple')], 'apple', 'CATALOG').map((r) => r.name)).toEqual(['Apfel']);
  });

  it('scores the English name in the canonical tier, above a synonym match', () => {
    const catalog = [entry('Karotte', ['carrot']), withEn('Möhre', 'Carrot')];
    expect(rankFoods(catalog, 'carrot', 'CATALOG', 'de').map((r) => r.name)).toEqual(['Möhre', 'Karotte']);
  });

  it('breaks ties by the display-name length for the requested locale', () => {
    const catalog = [withEn('Reisnudeln', 'Rice noodles'), withEn('Reismehl', 'Rice flour, very fine')];
    expect(rankFoods(catalog, 'reis', 'CATALOG', 'de').map((r) => r.name)).toEqual(['Reismehl', 'Reisnudeln']);
    expect(rankFoods(catalog, 'reis', 'CATALOG', 'en').map((r) => r.name)).toEqual([
      'Rice noodles',
      'Rice flour, very fine',
    ]);
  });

  it('breaks equal-length ties by localeCompare of the display name', () => {
    const catalog = [withEn('Birne', 'Pear X'), withEn('Apfel', 'Pear A')];
    expect(rankFoods(catalog, 'pear', 'CATALOG', 'en').map((r) => r.name)).toEqual(['Pear A', 'Pear X']);
  });
});
