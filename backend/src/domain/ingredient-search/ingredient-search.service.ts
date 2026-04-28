import type { IngredientSearchResult } from './types.ts';

export interface IngredientSearchService {
  searchByName(query: string): Promise<IngredientSearchResult[]>;
  searchByBarcode(barcode: string): Promise<IngredientSearchResult | null>;
}
