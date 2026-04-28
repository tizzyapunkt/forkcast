import { fetchJson, ApiError } from './client';
import type { IngredientSearchResult } from '../domain/ingredient-search';

export function searchIngredients(q: string): Promise<IngredientSearchResult[]> {
  return fetchJson<IngredientSearchResult[]>(`/api/search-ingredients?q=${encodeURIComponent(q)}`);
}

export async function searchBarcode(barcode: string): Promise<IngredientSearchResult | null> {
  try {
    return await fetchJson<IngredientSearchResult>(`/api/search-ingredients/barcode/${encodeURIComponent(barcode)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
