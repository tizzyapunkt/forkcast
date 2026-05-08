import type { IngredientSearchResult } from './types.ts';

export type IngredientSource = 'FOODS' | 'OFF';

export interface IngredientSearchService {
  searchByName(query: string, sources?: Set<IngredientSource>): Promise<IngredientSearchResult[]>;
  searchByBarcode(barcode: string): Promise<IngredientSearchResult | null>;
}
