import type { IngredientResultSource, IngredientSearchResult } from '../ingredient-search/types.ts';
import { fold } from '../ingredient-search/fold.ts';
import { matchFoodEntry, type FoodMatch } from '../ingredient-search/score-food-match.ts';
import { indexFoodEntry } from './index-food-entry.ts';
import { foodDisplayName, mapFoodEntry } from './map-food-entry.ts';
import type { CatalogLocale, FoodEntry, FoodIndexedEntry } from './types.ts';

const RESULT_CAP = 20;

/**
 * Rank pre-indexed food entries against a query and map the top results to
 * search results carrying the given `source`. Shared by the curated FOODS
 * service and the user-foods overlay service so folding, scoring, tie-breaking,
 * and the result cap stay identical across sources. Matching ignores `locale`;
 * it decides the returned names and the tie-break order.
 */
export function rankIndexedFoods(
  entries: FoodIndexedEntry[],
  query: string,
  source: IngredientResultSource,
  locale: CatalogLocale = 'de',
): IngredientSearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const q = fold(trimmed);
  const scored: ({ entry: FoodIndexedEntry; displayName: string } & FoodMatch)[] = [];
  for (const entry of entries) {
    const match = matchFoodEntry(entry, q);
    if (match.score > 0) scored.push({ entry, displayName: foodDisplayName(entry, locale), ...match });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.displayName.length !== b.displayName.length) return a.displayName.length - b.displayName.length;
    return a.displayName.localeCompare(b.displayName);
  });
  return scored.slice(0, RESULT_CAP).map((s) => ({
    ...mapFoodEntry(s.entry, source, locale),
    matchConfidence: s.confident ? 'confident' : 'partial',
  }));
}

/** Convenience for sources that hold plain (unindexed) entries, e.g. the overlay. */
export function rankFoods(
  entries: FoodEntry[],
  query: string,
  source: IngredientResultSource,
  locale: CatalogLocale = 'de',
): IngredientSearchResult[] {
  return rankIndexedFoods(entries.map(indexFoodEntry), query, source, locale);
}
