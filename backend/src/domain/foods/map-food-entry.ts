import type { IngredientSearchResult } from '../ingredient-search/types.ts';
import type { FoodEntry } from './types.ts';

export function mapFoodEntry(entry: FoodEntry): IngredientSearchResult {
  return {
    id: entry.id,
    source: 'FOODS',
    name: entry.name,
    unit: entry.unit,
    macrosPerUnit: {
      calories: entry.macrosPer100.calories / 100,
      protein: entry.macrosPer100.protein / 100,
      carbs: entry.macrosPer100.carbs / 100,
      fat: entry.macrosPer100.fat / 100,
    },
  };
}
