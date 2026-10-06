import { fetchJson, ApiError } from './client';
import type { IngredientSearchResult, IngredientSearchSource } from '../domain/ingredient-search';
import { locale } from '../i18n/locale';

/** Catalog results come back named in the active locale (German fallback), so the request carries it. */
export function searchIngredients(q: string, sources?: IngredientSearchSource[]): Promise<IngredientSearchResult[]> {
  let url = `/api/search-ingredients?q=${encodeURIComponent(q)}&locale=${locale}`;
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
