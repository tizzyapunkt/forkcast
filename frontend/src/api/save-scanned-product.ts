import { fetchJson } from './client';
import type { IngredientSearchResult } from '../domain/ingredient-search';
import type { ProductMacros } from './extract-product-from-photos';

export interface SaveScannedProductPayload {
  barcode: string;
  name: string;
  unit: 'g' | 'ml';
  macrosPer100: ProductMacros;
}

export async function saveScannedProduct(payload: SaveScannedProductPayload): Promise<IngredientSearchResult> {
  return fetchJson<IngredientSearchResult>('/api/save-scanned-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
