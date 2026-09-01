import { fetchJson } from './client';
import type { FavoriteIngredient, FavoriteUnit } from '../domain/favorite-ingredients';
import type { MacrosPerUnit } from '../domain/meal-log';

export interface FavoriteIngredientInput {
  name: string;
  unit: FavoriteUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
}

export interface UnfavoriteIngredientInput {
  name: string;
  unit: FavoriteUnit;
}

export function getFavoriteIngredients(): Promise<FavoriteIngredient[]> {
  return fetchJson<FavoriteIngredient[]>('/api/favorite-ingredients');
}

export function favoriteIngredient(input: FavoriteIngredientInput): Promise<FavoriteIngredient> {
  return fetchJson<FavoriteIngredient>('/api/favorite-ingredient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function unfavoriteIngredient(input: UnfavoriteIngredientInput): Promise<{ ok: true }> {
  return fetchJson<{ ok: true }>('/api/unfavorite-ingredient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
