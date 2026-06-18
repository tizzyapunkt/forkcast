import type { IngredientResultSource, IngredientSearchResult } from '../ingredient-search/types.ts';
import type { FoodEntry } from './types.ts';

export function mapFoodEntry(entry: FoodEntry, source: IngredientResultSource = 'FOODS'): IngredientSearchResult {
  const result: IngredientSearchResult = {
    id: entry.id,
    source,
    name: entry.name,
    unit: entry.unit,
    macrosPerUnit: {
      calories: entry.macrosPer100.calories / 100,
      protein: entry.macrosPer100.protein / 100,
      carbs: entry.macrosPer100.carbs / 100,
      fat: entry.macrosPer100.fat / 100,
    },
  };
  if (entry.untracked === true) result.untracked = true;
  if (entry.density !== undefined) result.density = entry.density;
  return result;
}
