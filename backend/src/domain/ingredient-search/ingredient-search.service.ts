import type { IngredientSearchResult } from './types.ts';
import type { CatalogLocale } from '../foods/types.ts';

export type IngredientSource = 'CATALOG' | 'OFF' | 'SCAN';

export interface IngredientSearchService {
  /** `locale` names catalog and Open Food Facts results and picks the language OFF is searched in (German when absent). */
  searchByName(
    query: string,
    sources?: Set<IngredientSource>,
    locale?: CatalogLocale,
  ): Promise<IngredientSearchResult[]>;
  searchByBarcode(barcode: string): Promise<IngredientSearchResult | null>;
}
