import { fetchJson, ApiError } from './client';
import type { IngredientSearchResult } from '../domain/ingredient-search';

export function searchIngredients(
  q: string,
  sources?: Array<'FOODS' | 'USER' | 'OFF'>,
): Promise<IngredientSearchResult[]> {
  let url = `/api/search-ingredients?q=${encodeURIComponent(q)}`;
  if (sources && sources.length > 0) {
    url += `&sources=${sources.map((s) => s.toLowerCase()).join(',')}`;
  }
  return fetchJson<IngredientSearchResult[]>(url);
}

export async function searchBarcode(barcode: string): Promise<IngredientSearchResult | null> {
  try {
    return await fetchJson<IngredientSearchResult>(`/api/search-ingredients/barcode/${encodeURIComponent(barcode)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
