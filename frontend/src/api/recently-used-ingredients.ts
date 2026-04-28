import { fetchJson } from './client';
import type { RecentlyUsedIngredient } from '../domain/meal-log';

export function getRecentlyUsedIngredients(): Promise<RecentlyUsedIngredient[]> {
  return fetchJson<RecentlyUsedIngredient[]>('/api/recently-used-ingredients');
}
