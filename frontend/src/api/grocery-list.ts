import { fetchJson } from './client';
import type { GroceryList, RecipePortions } from '../domain/grocery-list';

export function getGroceryList(startDate: string, portions: RecipePortions = {}): Promise<GroceryList> {
  const pairs = Object.entries(portions).map(([recipeId, n]) => `${recipeId}:${n}`);
  const query = pairs.length > 0 ? `?portions=${encodeURIComponent(pairs.join(','))}` : '';
  return fetchJson<GroceryList>(`/api/grocery-list/${startDate}${query}`);
}
