import type {
  IngredientSearchService,
  IngredientSource,
} from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { ScannedProductStore } from '../../domain/barcode-product-capture/types.ts';
import { mapScannedProduct } from '../../domain/barcode-product-capture/map-scanned-product.ts';

const DEFAULT_SOURCES: Set<IngredientSource> = new Set(['OFF']);

export class CompositeIngredientSearchService implements IngredientSearchService {
  constructor(
    private readonly off: IngredientSearchService,
    private readonly foods: IngredientSearchService,
    private readonly scanned?: ScannedProductStore,
  ) {}

  async searchByName(
    query: string,
    sources: Set<IngredientSource> = DEFAULT_SOURCES,
  ): Promise<IngredientSearchResult[]> {
    const tasks: Promise<IngredientSearchResult[]>[] = [];
    const order: IngredientSource[] = [];

    if (sources.has('FOODS')) {
      tasks.push(this.foods.searchByName(query));
      order.push('FOODS');
    }
    if (sources.has('OFF')) {
      tasks.push(this.off.searchByName(query));
      order.push('OFF');
    }

    const outcomes = await Promise.allSettled(tasks);

    const bySource = new Map<IngredientSource, IngredientSearchResult[]>();
    for (let i = 0; i < order.length; i++) {
      const outcome = outcomes[i]!;
      const src = order[i]!;
      if (outcome.status === 'fulfilled') {
        bySource.set(src, outcome.value);
      } else {
        console.error(`${src} search failed:`, outcome.reason);
        bySource.set(src, []);
      }
    }

    return [...(bySource.get('FOODS') ?? []), ...(bySource.get('OFF') ?? [])];
  }

  async searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    if (this.scanned) {
      const stored = await this.scanned.findByBarcode(barcode);
      if (stored) return mapScannedProduct(stored);
    }
    return this.off.searchByBarcode(barcode);
  }
}
