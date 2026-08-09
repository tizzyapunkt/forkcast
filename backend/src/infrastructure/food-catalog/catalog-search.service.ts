import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { CatalogStore } from '../../domain/food-catalog/types.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';
import { rankIndexedFoods } from '../../domain/foods/rank-food-entries.ts';
import { rankFuzzyCandidates } from '../../domain/foods/fuzzy-candidates.ts';

/**
 * Exposes the catalog through the `IngredientSearchService` port as the
 * `CATALOG` source. Reads the store's index per query, so any accepted write —
 * a new food, a corrected macro, a learned synonym — is searchable immediately
 * without a restart.
 */
export class CatalogSearchService implements IngredientSearchService {
  constructor(private readonly store: CatalogStore) {}

  async searchByName(query: string, _sources?: Set<string>): Promise<IngredientSearchResult[]> {
    return rankIndexedFoods(this.store.indexed(), query, 'CATALOG');
  }

  async searchByBarcode(_barcode: string): Promise<IngredientSearchResult | null> {
    return null;
  }

  /** Fuzzy (token/prefix-overlap) candidates for the AI resolution proposer — looser than searchByName. */
  findFuzzyCandidates(query: string, limit: number): FoodEntry[] {
    return rankFuzzyCandidates(this.store.indexed(), query, limit);
  }
}
