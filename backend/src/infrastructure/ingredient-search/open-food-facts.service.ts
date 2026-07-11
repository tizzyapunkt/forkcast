import { OpenFoodFacts, SearchApi } from '@openfoodfacts/openfoodfacts-nodejs';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import { mapOffProduct } from '../../domain/ingredient-search/map-off-product.ts';

const FIELDS = 'code,product_name,product_name_de,serving_size,serving_quantity,nutriments';
const REQUEST_TIMEOUT_MS = 8_000;

function toRequestError(err: unknown): Error {
  const reason = err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'network error';
  return new Error(`Open Food Facts request failed: ${reason}`, { cause: err });
}

function statusError(response: Response): Error {
  return new Error(`Open Food Facts request failed: ${response.status} ${response.statusText}`);
}

export class OpenFoodFactsService implements IngredientSearchService {
  private readonly product: OpenFoodFacts;
  private readonly search: SearchApi;

  constructor(fetchFn: typeof fetch = globalThis.fetch) {
    // The SDK has no request timeout; without one a hanging OFF request stalls the whole search.
    const fetchWithTimeout: typeof fetch = (input, init) =>
      fetchFn(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    this.product = new OpenFoodFacts(fetchWithTimeout);
    this.search = new SearchApi(fetchWithTimeout);
  }

  async searchByName(query: string, _sources?: Set<string>): Promise<IngredientSearchResult[]> {
    const q = `${query} lang:de countries_tags:"en:germany"`;
    let result: Awaited<ReturnType<SearchApi['searchGet']>>;
    try {
      result = await this.search.searchGet({ q, langs: 'de', page_size: 20, fields: FIELDS });
    } catch (err) {
      throw toRequestError(err);
    }
    const { data, response } = result;
    if (!response.ok || data === undefined) throw statusError(response);
    const hits = 'hits' in data ? data.hits : [];
    return hits.flatMap((p) => {
      const mapped = mapOffProduct(p as Parameters<typeof mapOffProduct>[0]);
      return mapped ? [mapped] : [];
    });
  }

  async searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    let result: Awaited<ReturnType<OpenFoodFacts['getProductV2']>>;
    try {
      result = await this.product.getProductV2(barcode);
    } catch (err) {
      throw toRequestError(err);
    }
    const { data, response } = result;
    if (response.status === 404) return null;
    if (!response.ok || data === undefined) throw statusError(response);
    if (data.status !== 1 || !data.product) return null;
    return mapOffProduct(data.product as Parameters<typeof mapOffProduct>[0]);
  }
}
