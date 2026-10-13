import type {
  IngredientSearchService,
  IngredientSource,
} from '../../../backend/src/domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../../backend/src/domain/ingredient-search/types.ts';
import type { CatalogLocale } from '../../../backend/src/domain/foods/types.ts';
import { mapOffProduct } from '../../../backend/src/domain/ingredient-search/map-off-product.ts';
import { fold } from '../../../backend/src/domain/ingredient-search/fold.ts';
import { matchFoodEntry } from '../../../backend/src/domain/ingredient-search/score-food-match.ts';

/** One product as the build script stores it: the raw OFF fields `mapOffProduct` reads. */
export type OffSnapshotProduct = Parameters<typeof mapOffProduct>[0];

/** `frontend/src/demo/off-snapshot.json`, written by `scripts/demo/build-off-snapshot.mts`. */
export interface OffSnapshot {
  source: string;
  license: string;
  builtAt: string;
  countries: string[];
  /** Most-scanned first. */
  products: OffSnapshotProduct[];
}

interface IndexedProduct {
  result: IngredientSearchResult;
  nameFolded: string;
  synonymsFolded: string[];
  /** Every name and brand, for the "contains every query word" filter. */
  haystack: string;
}

/** The same cap as a live Open Food Facts search (`page_size: 20`). */
const RESULT_CAP = 20;

function brandsOf(product: OffSnapshotProduct): string[] {
  const { brands } = product;
  return typeof brands === 'string' ? brands.split(',') : (brands ?? []);
}

/**
 * The demo's Open Food Facts source. Browsers block live OFF name search (no CORS), so names are
 * matched against a bundled snapshot of popular products; barcodes still go to OFF live.
 */
export class SnapshotOffSearch implements IngredientSearchService {
  private snapshot: Promise<OffSnapshot> | undefined;
  private readonly indexes = new Map<CatalogLocale, Promise<IndexedProduct[]>>();

  constructor(
    private readonly load: () => Promise<OffSnapshot>,
    private readonly barcode: IngredientSearchService,
  ) {}

  async searchByName(
    query: string,
    _sources?: Set<IngredientSource>,
    locale: CatalogLocale = 'de',
  ): Promise<IngredientSearchResult[]> {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    const words = q.split(/\s+/);
    const scored: { entry: IndexedProduct; score: number; rank: number }[] = [];
    (await this.index(locale)).forEach((entry, rank) => {
      if (!words.every((word) => entry.haystack.includes(word))) return;
      const { score } = matchFoodEntry(entry, q);
      if (score > 0) scored.push({ entry, score, rank });
    });
    scored.sort((a, b) => b.score - a.score || a.rank - b.rank);
    return scored.slice(0, RESULT_CAP).map((s) => s.entry.result);
  }

  searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    return this.barcode.searchByBarcode(barcode);
  }

  /** Folded once per locale, on first use: later keystrokes don't re-fold thousands of names. */
  private index(locale: CatalogLocale): Promise<IndexedProduct[]> {
    let index = this.indexes.get(locale);
    if (!index) {
      this.snapshot ??= this.load();
      index = this.snapshot.then(({ products }) =>
        products.flatMap((product) => {
          const result = mapOffProduct(product, locale);
          if (!result) return [];
          const others = [product.product_name, product.product_name_de, product.product_name_en, ...brandsOf(product)]
            .filter((text): text is string => typeof text === 'string' && text.trim().length > 0)
            .map((text) => fold(text.trim()));
          const nameFolded = fold(result.name);
          return [{ result, nameFolded, synonymsFolded: others, haystack: [nameFolded, ...others].join(' ') }];
        }),
      );
      this.indexes.set(locale, index);
    }
    return index;
  }
}
