import type { IngredientSearchResult } from './types.ts';
import type { CatalogLocale } from '../foods/types.ts';

export type IngredientSource = 'CATALOG' | 'OFF' | 'SCAN';

export interface IngredientSearchService {
  /** `locale` names catalog results (German when absent); other sources keep their own names. */
  searchByName(
    query: string,
    sources?: Set<IngredientSource>,
    locale?: CatalogLocale,
  ): Promise<IngredientSearchResult[]>;
  searchByBarcode(barcode: string): Promise<IngredientSearchResult | null>;
}
