import type { IngredientResultSource, IngredientSearchResult } from '../ingredient-search/types.ts';
import type { CatalogLocale, FoodEntry } from './types.ts';

/** The name an entry is shown by in `locale`: the English name in English when it has one, else the canonical name. */
export function foodDisplayName(entry: Pick<FoodEntry, 'name' | 'nameEn'>, locale: CatalogLocale): string {
  return locale === 'en' && entry.nameEn !== undefined ? entry.nameEn : entry.name;
}

export function mapFoodEntry(
  entry: FoodEntry,
  source: IngredientResultSource = 'CATALOG',
  locale: CatalogLocale = 'de',
): IngredientSearchResult {
  const result: IngredientSearchResult = {
    id: entry.id,
    source,
    name: foodDisplayName(entry, locale),
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
