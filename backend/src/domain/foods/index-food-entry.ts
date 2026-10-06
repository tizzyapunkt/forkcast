import { fold } from '../ingredient-search/fold.ts';
import type { FoodEntry, FoodIndexedEntry } from './types.ts';

export function indexFoodEntry(entry: FoodEntry): FoodIndexedEntry {
  const indexed: FoodIndexedEntry = {
    ...entry,
    nameFolded: fold(entry.name),
    synonymsFolded: entry.synonyms.map(fold),
  };
  if (entry.nameEn !== undefined) indexed.nameEnFolded = fold(entry.nameEn);
  return indexed;
}
