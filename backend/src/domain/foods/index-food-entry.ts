import { fold } from '../ingredient-search/fold.ts';
import type { FoodEntry, FoodIndexedEntry } from './types.ts';

export function indexFoodEntry(entry: FoodEntry): FoodIndexedEntry {
  return {
    ...entry,
    nameFolded: fold(entry.name),
    synonymsFolded: entry.synonyms.map(fold),
  };
}
