import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';

export class CompositeIngredientSearchService implements IngredientSearchService {
  constructor(
    private readonly off: IngredientSearchService,
    private readonly bls: IngredientSearchService,
  ) {}

  async searchByName(query: string): Promise<IngredientSearchResult[]> {
    const [blsOutcome, offOutcome] = await Promise.allSettled([
      this.bls.searchByName(query),
      this.off.searchByName(query),
    ]);

    const blsHits = blsOutcome.status === 'fulfilled' ? blsOutcome.value : [];
    const offHits = offOutcome.status === 'fulfilled' ? offOutcome.value : [];

    if (blsOutcome.status === 'rejected') {
      console.error('BLS search failed:', blsOutcome.reason);
    }
    if (offOutcome.status === 'rejected') {
      console.error('OFF search failed:', offOutcome.reason);
    }

    return [...blsHits, ...offHits];
  }

  async searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    return this.off.searchByBarcode(barcode);
  }
}
