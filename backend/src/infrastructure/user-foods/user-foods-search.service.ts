import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { UserFoodsStore } from '../../domain/user-foods/types.ts';
import { rankFoods } from '../../domain/foods/rank-food-entries.ts';

/**
 * Exposes the user-foods overlay through the `IngredientSearchService` port as
 * the `USER` source. Reads the overlay on each query so foods confirmed at
 * runtime are findable immediately, without a backend restart. The overlay is
 * the user's own small catalog, so per-query indexing is cheap.
 */
export class UserFoodsSearchService implements IngredientSearchService {
  constructor(private readonly store: UserFoodsStore) {}

  async searchByName(query: string): Promise<IngredientSearchResult[]> {
    const { foods } = await this.store.load();
    return rankFoods(foods, query, 'USER');
  }

  async searchByBarcode(): Promise<IngredientSearchResult | null> {
    return null;
  }
}
