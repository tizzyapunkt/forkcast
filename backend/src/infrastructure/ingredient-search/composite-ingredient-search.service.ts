import type {
  IngredientSearchService,
  IngredientSource,
} from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { ScannedProduct, ScannedProductStore } from '../../domain/barcode-product-capture/types.ts';
import { mapScannedProduct } from '../../domain/barcode-product-capture/map-scanned-product.ts';
import { fold } from '../../domain/ingredient-search/fold.ts';
import { scoreFoodMatch } from '../../domain/ingredient-search/score-food-match.ts';

const DEFAULT_SOURCES: Set<IngredientSource> = new Set(['OFF']);
const SCAN_RESULT_CAP = 20;

export class CompositeIngredientSearchService implements IngredientSearchService {
  constructor(
    private readonly off: IngredientSearchService,
    private readonly foods: IngredientSearchService,
    private readonly scanned?: ScannedProductStore,
    private readonly user?: IngredientSearchService,
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
    if (sources.has('USER') && this.user) {
      tasks.push(this.user.searchByName(query));
      order.push('USER');
    }
    if (sources.has('SCAN')) {
      tasks.push(this.searchScannedByName(query));
      order.push('SCAN');
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

    return [
      ...(bySource.get('FOODS') ?? []),
      ...(bySource.get('USER') ?? []),
      ...(bySource.get('SCAN') ?? []),
      ...(bySource.get('OFF') ?? []),
    ];
  }

  async searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    if (this.scanned) {
      const stored = await this.scanned.findByBarcode(barcode);
      if (stored) return mapScannedProduct(stored);
    }
    return this.off.searchByBarcode(barcode);
  }

  /** Name-search the locally-scanned products (folded, tiered scoring), mapped to SCAN results. */
  private async searchScannedByName(query: string): Promise<IngredientSearchResult[]> {
    if (!this.scanned?.list) return [];
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const q = fold(trimmed);
    const products = await this.scanned.list();
    const scored: { product: ScannedProduct; score: number }[] = [];
    for (const product of products) {
      const score = scoreFoodMatch({ nameFolded: fold(product.name), synonymsFolded: [] }, q);
      if (score > 0) scored.push({ product, score });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.product.name.length !== b.product.name.length) return a.product.name.length - b.product.name.length;
      return a.product.name.localeCompare(b.product.name);
    });
    return scored.slice(0, SCAN_RESULT_CAP).map((s) => mapScannedProduct(s.product));
  }
}
