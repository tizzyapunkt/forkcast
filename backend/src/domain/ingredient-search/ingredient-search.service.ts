import type { IngredientSearchResult } from './types.ts';

export type IngredientSource = 'BLS' | 'OFF';

export interface IngredientSearchService {
  searchByName(query: string, sources?: Set<IngredientSource>): Promise<IngredientSearchResult[]>;
  searchByBarcode(barcode: string): Promise<IngredientSearchResult | null>;
}
