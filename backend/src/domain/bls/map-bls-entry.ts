import type { IngredientSearchResult } from '../ingredient-search/types.ts';
import type { BlsEntry } from './types.ts';

export function mapBlsEntry(entry: BlsEntry): IngredientSearchResult {
  return {
    id: entry.id,
    source: 'BLS',
    name: entry.name_de,
    unit: 'g',
    macrosPerUnit: {
      calories: entry.calories100 / 100,
      protein: entry.protein100 / 100,
      carbs: entry.carbs100 / 100,
      fat: entry.fat100 / 100,
    },
  };
}
