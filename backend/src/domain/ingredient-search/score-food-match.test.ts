import { describe, it, expect } from 'vitest';
import { scoreFoodMatch } from './score-food-match.ts';
import { fold } from './fold.ts';
import { indexFoodEntry } from '../foods/index-food-entry.ts';
import type { FoodEntry } from '../foods/types.ts';

function entry(name: string, synonyms: string[] = []): FoodEntry {
  return {
    id: name.toLowerCase(),
    name,
    synonyms,
    unit: 'g',
    macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
}

describe('scoreFoodMatch', () => {
  it('returns 0 when query appears in neither canonical name nor any synonym', () => {
    const e = indexFoodEntry(entry('Möhre', ['Karotte']));
    expect(scoreFoodMatch(e, fold('zzznomatch'))).toBe(0);
  });

  describe('canonical name tier ordering (uses higher tier values)', () => {
    it('exact canonical = 100', () => {
      expect(scoreFoodMatch(indexFoodEntry(entry('Hähnchenbrust')), fold('Hähnchenbrust'))).toBe(100);
    });

    it('whole-word canonical = 80', () => {
      expect(scoreFoodMatch(indexFoodEntry(entry('Hähnchenbrust, gegart')), fold('Hähnchenbrust'))).toBe(80);
    });

    it('prefix canonical = 60', () => {
      expect(scoreFoodMatch(indexFoodEntry(entry('Reisnudeln')), fold('Reis'))).toBe(60);
    });

    it('token-start canonical = 40', () => {
      expect(scoreFoodMatch(indexFoodEntry(entry('Naturreis (Reisbasis)')), fold('Reis'))).toBe(40);
    });

    it('substring canonical = 20', () => {
      expect(scoreFoodMatch(indexFoodEntry(entry('Suppenhähnchen')), fold('Hähnchen'))).toBe(20);
    });
  });

  describe('synonym tier ordering (uses lower tier values, 10 less than canonical)', () => {
    it('exact synonym = 90, whole-word = 70, prefix = 50, token-start = 30, substring = 10', () => {
      expect(scoreFoodMatch(indexFoodEntry(entry('Möhre', ['Carrot'])), fold('Carrot'))).toBe(90);
      expect(scoreFoodMatch(indexFoodEntry(entry('Möhre', ['Carrot, raw'])), fold('Carrot'))).toBe(70);
      expect(scoreFoodMatch(indexFoodEntry(entry('Möhre', ['Carrotcake'])), fold('Carrot'))).toBe(50);
      expect(scoreFoodMatch(indexFoodEntry(entry('Möhre', ['Big Carrotcake'])), fold('Carrot'))).toBe(30);
      expect(scoreFoodMatch(indexFoodEntry(entry('Möhre', ['Mycarrotthing'])), fold('Carrot'))).toBe(10);
    });
  });

  describe('canonical-vs-synonym precedence', () => {
    it('canonical exact (100) outranks synonym exact (90) on the same entry — returns 100', () => {
      expect(scoreFoodMatch(indexFoodEntry(entry('Hähnchen', ['Hähnchen-twin'])), fold('Hähnchen'))).toBe(100);
    });

    it('synonym exact (90) beats canonical plain substring (20)', () => {
      expect(scoreFoodMatch(indexFoodEntry(entry('Suppencarrotsalat', ['Carrot'])), fold('Carrot'))).toBe(90);
    });
  });

  describe('best of multiple synonyms', () => {
    it('picks the highest-scoring synonym when canonical does not match', () => {
      const e = indexFoodEntry(entry('Möhre', ['Suppen-mit-carrot', 'Carrot, raw', 'Mycarrotthing']));
      expect(scoreFoodMatch(e, fold('Carrot'))).toBe(70);
    });
  });

  describe('input is already folded', () => {
    it('does not match when query has different case (caller must fold first)', () => {
      const e = indexFoodEntry(entry('Möhre'));
      expect(scoreFoodMatch(e, 'MÖHRE')).toBe(0);
      expect(scoreFoodMatch(e, 'mohre')).toBe(100);
    });
  });

  describe('canonical / synonym appears as a whole word inside a longer query', () => {
    it('canonical whole-word inside a longer query scores at the canonical whole-word tier (80)', () => {
      const e = indexFoodEntry(entry('Kichererbsen'));
      expect(scoreFoodMatch(e, fold('Kichererbsen (aus der Dose, abgetropft)'))).toBe(80);
    });

    it('canonical bounded by parenthesis on the right scores whole-word', () => {
      const e = indexFoodEntry(entry('Spinat'));
      expect(scoreFoodMatch(e, fold('frischer Spinat (TK)'))).toBe(80);
    });

    it('canonical bounded by hyphen scores whole-word', () => {
      const e = indexFoodEntry(entry('Tomate'));
      expect(scoreFoodMatch(e, fold('getrocknete Tomate-aus-Italien'))).toBe(80);
    });

    it('canonical prefix-of-query without right boundary does NOT fire (Reis vs Reisnudeln)', () => {
      const e = indexFoodEntry(entry('Reis'));
      expect(scoreFoodMatch(e, fold('Reisnudeln'))).toBe(0);
    });

    it('canonical suffix-of-query without left boundary does NOT fire (Salz vs Knoblauchsalz)', () => {
      const e = indexFoodEntry(entry('Salz'));
      expect(scoreFoodMatch(e, fold('Knoblauchsalz'))).toBe(0);
    });

    it('synonym whole-word inside a longer query scores at the synonym whole-word tier (70)', () => {
      const e = indexFoodEntry(entry('Möhre', ['Karotte']));
      expect(scoreFoodMatch(e, fold('eine Karotte (mittel)'))).toBe(70);
    });

    it('canonical exact match still scores 100, not double-counted as 80', () => {
      const e = indexFoodEntry(entry('Kichererbsen'));
      expect(scoreFoodMatch(e, fold('Kichererbsen'))).toBe(100);
    });

    it('canonical contained inside multi-word query both before and after another word', () => {
      const e = indexFoodEntry(entry('Frischkäse'));
      expect(scoreFoodMatch(e, fold('150 g Frischkäse leicht'))).toBe(80);
    });
  });
});
