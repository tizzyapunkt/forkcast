import type { IngredientSearchResult } from './types.js';

export interface IngredientSearchService {
  searchByName(query: string): Promise<IngredientSearchResult[]>;
  searchByBarcode(barcode: string): Promise<IngredientSearchResult | null>;
}
