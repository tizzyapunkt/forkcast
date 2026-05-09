import { describe, it, expect } from 'vitest';
import { mapFoodEntry } from './map-food-entry.ts';
import type { FoodEntry } from './types.ts';

describe('mapFoodEntry', () => {
  it('produces an IngredientSearchResult with source FOODS, the entry id, canonical name, and the entry unit', () => {
    const entry: FoodEntry = {
      id: 'moehre',
      name: 'Möhre',
      synonyms: ['Karotte'],
      unit: 'g',
      macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
    };
    const result = mapFoodEntry(entry);
    expect(result.source).toBe('FOODS');
    expect(result.id).toBe('moehre');
    expect(result.name).toBe('Möhre');
    expect(result.unit).toBe('g');
  });

  it('scales macros from per-100 to per-unit (per-gram for g, per-ml for ml)', () => {
    const entry: FoodEntry = {
      id: 'olivenoel',
      name: 'Olivenöl',
      synonyms: [],
      unit: 'ml',
      macrosPer100: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    };
    const result = mapFoodEntry(entry);
    expect(result.unit).toBe('ml');
    expect(result.macrosPerUnit.calories).toBeCloseTo(8.84);
    expect(result.macrosPerUnit.fat).toBeCloseTo(1);
    expect(result.macrosPerUnit.protein).toBe(0);
    expect(result.macrosPerUnit.carbs).toBe(0);
  });

  it('scales each macro independently', () => {
    const entry: FoodEntry = {
      id: 'huehnchenbrust',
      name: 'Hähnchenbrust',
      synonyms: ['chicken breast'],
      unit: 'g',
      macrosPer100: { calories: 250, protein: 10, carbs: 0, fat: 23 },
    };
    const result = mapFoodEntry(entry);
    expect(result.macrosPerUnit.calories).toBeCloseTo(2.5);
    expect(result.macrosPerUnit.protein).toBeCloseTo(0.1);
    expect(result.macrosPerUnit.carbs).toBe(0);
    expect(result.macrosPerUnit.fat).toBeCloseTo(0.23);
  });

  it('propagates untracked: true to the result when set on the entry', () => {
    const entry: FoodEntry = {
      id: 'salz',
      name: 'Salz',
      synonyms: ['Speisesalz', 'salt'],
      unit: 'g',
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      untracked: true,
    };
    const result = mapFoodEntry(entry);
    expect(result.untracked).toBe(true);
  });

  it('omits untracked on the result when the entry has no untracked field', () => {
    const entry: FoodEntry = {
      id: 'moehre',
      name: 'Möhre',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
    };
    const result = mapFoodEntry(entry);
    expect('untracked' in result).toBe(false);
  });

  it('omits untracked on the result when the entry has untracked: false', () => {
    const entry: FoodEntry = {
      id: 'moehre',
      name: 'Möhre',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
      untracked: false,
    };
    const result = mapFoodEntry(entry);
    expect('untracked' in result).toBe(false);
  });
});
