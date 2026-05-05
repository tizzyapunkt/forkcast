import type {
  IngredientSearchService,
  IngredientSource,
} from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';

const DEFAULT_SOURCES: Set<IngredientSource> = new Set(['BLS']);

export class CompositeIngredientSearchService implements IngredientSearchService {
  constructor(
    private readonly off: IngredientSearchService,
    private readonly bls: IngredientSearchService,
  ) {}

  async searchByName(
    query: string,
    sources: Set<IngredientSource> = DEFAULT_SOURCES,
  ): Promise<IngredientSearchResult[]> {
    const tasks: Promise<IngredientSearchResult[]>[] = [];
    const order: IngredientSource[] = [];

    if (sources.has('BLS')) {
      tasks.push(this.bls.searchByName(query));
      order.push('BLS');
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

    return [...(bySource.get('BLS') ?? []), ...(bySource.get('OFF') ?? [])];
  }

  async searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    return this.off.searchByBarcode(barcode);
  }
}
