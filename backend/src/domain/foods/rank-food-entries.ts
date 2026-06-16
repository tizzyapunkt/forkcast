import type { IngredientResultSource, IngredientSearchResult } from '../ingredient-search/types.ts';
import { fold } from '../ingredient-search/fold.ts';
import { scoreFoodMatch } from '../ingredient-search/score-food-match.ts';
import { indexFoodEntry } from './index-food-entry.ts';
import { mapFoodEntry } from './map-food-entry.ts';
import type { FoodEntry, FoodIndexedEntry } from './types.ts';

const RESULT_CAP = 20;

/**
 * Rank pre-indexed food entries against a query and map the top results to
 * search results carrying the given `source`. Shared by the curated FOODS
 * service and the user-foods overlay service so folding, scoring, tie-breaking,
 * and the result cap stay identical across sources.
 */
export function rankIndexedFoods(
  entries: FoodIndexedEntry[],
  query: string,
  source: IngredientResultSource,
): IngredientSearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const q = fold(trimmed);
  const scored: { entry: FoodIndexedEntry; score: number }[] = [];
  for (const entry of entries) {
    const score = scoreFoodMatch(entry, q);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.entry.name.length !== b.entry.name.length) return a.entry.name.length - b.entry.name.length;
    return a.entry.name.localeCompare(b.entry.name);
  });
  return scored.slice(0, RESULT_CAP).map((s) => mapFoodEntry(s.entry, source));
}

/** Convenience for sources that hold plain (unindexed) entries, e.g. the overlay. */
export function rankFoods(
  entries: FoodEntry[],
  query: string,
  source: IngredientResultSource,
): IngredientSearchResult[] {
  return rankIndexedFoods(entries.map(indexFoodEntry), query, source);
}
