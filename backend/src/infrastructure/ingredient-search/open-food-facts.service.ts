import { OpenFoodFacts } from '@openfoodfacts/openfoodfacts-nodejs';
import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import type { DiagnosticsRecorder } from '../../domain/diagnostics/diagnostics-log.ts';
import { mapOffProduct } from '../../domain/ingredient-search/map-off-product.ts';
import {
  SearchALiciousClient,
  SearchALiciousHttpError,
  type SearchALiciousResponse,
} from './search-a-licious-client.ts';

const FIELDS = 'code,product_name,product_name_de,serving_size,serving_quantity,nutriments';
const REQUEST_TIMEOUT_MS = 8_000;
const BODY_SNIPPET_MAX = 300;

function failureReason(err: unknown): string {
  return err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'network error';
}

// openapi-fetch has already consumed the body of a non-ok response; what it read
// is only available through the result's `error` field (text, or parsed JSON).
function bodySnippet(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  const text = typeof error === 'string' ? error : JSON.stringify(error);
  return text.length > 0 ? text.slice(0, BODY_SNIPPET_MAX) : undefined;
}

function statusError(status: number, statusText: string, snippet?: string): Error {
  const base = `Open Food Facts request failed: ${status} ${statusText}`;
  return new Error(snippet ? `${base} — ${snippet}` : base);
}

export class OpenFoodFactsService implements IngredientSearchService {
  private readonly product: OpenFoodFacts;
  // Full-text search runs on our own Search-a-licious client, not the SDK —
  // see search-a-licious-client.ts for why.
  private readonly search: SearchALiciousClient;

  constructor(
    fetchFn: typeof fetch = globalThis.fetch,
    private readonly recorder?: DiagnosticsRecorder,
  ) {
    // The SDK has no request timeout; without one a hanging OFF request stalls the whole search.
    // (The search client brings its own timeout, so it gets the raw fetch.)
    const fetchWithTimeout: typeof fetch = (input, init) =>
      fetchFn(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    this.product = new OpenFoodFacts(fetchWithTimeout);
    this.search = new SearchALiciousClient(fetchFn);
  }

  private record(operation: 'search' | 'barcode', outcome: string, startedAt: number, detail?: string): void {
    this.recorder?.record({ kind: 'off', message: `${operation} ${outcome} (${Date.now() - startedAt}ms)`, detail });
  }

  async searchByName(query: string, _sources?: Set<string>): Promise<IngredientSearchResult[]> {
    const q = `${query} lang:de countries_tags:"en:germany"`;
    const startedAt = Date.now();
    let data: SearchALiciousResponse;
    try {
      data = await this.search.search({ q, langs: 'de', page_size: 20, fields: FIELDS });
    } catch (err) {
      if (err instanceof SearchALiciousHttpError) {
        this.record('search', `failed ${err.status} ${err.statusText}`, startedAt, err.bodySnippet);
        throw statusError(err.status, err.statusText, err.bodySnippet);
      }
      const reason = failureReason(err);
      this.record('search', `failed: ${reason}`, startedAt);
      throw new Error(`Open Food Facts request failed: ${reason}`, { cause: err });
    }
    this.record('search', 'ok 200', startedAt);
    const hits = 'hits' in data ? data.hits : [];
    return hits.flatMap((p) => {
      const mapped = mapOffProduct(p as Parameters<typeof mapOffProduct>[0]);
      return mapped ? [mapped] : [];
    });
  }

  async searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    const startedAt = Date.now();
    let result: Awaited<ReturnType<OpenFoodFacts['getProductV2']>>;
    try {
      result = await this.product.getProductV2(barcode);
    } catch (err) {
      const reason = failureReason(err);
      this.record('barcode', `failed: ${reason}`, startedAt);
      throw new Error(`Open Food Facts request failed: ${reason}`, { cause: err });
    }
    const { data, error, response } = result;
    if (response.status === 404) {
      this.record('barcode', 'not-found 404', startedAt);
      return null;
    }
    if (!response.ok || data === undefined) {
      const snippet = bodySnippet(error);
      this.record('barcode', `failed ${response.status} ${response.statusText}`, startedAt, snippet);
      throw statusError(response.status, response.statusText, snippet);
    }
    this.record('barcode', `ok ${response.status}`, startedAt);
    if (data.status !== 1 || !data.product) return null;
    return mapOffProduct(data.product as Parameters<typeof mapOffProduct>[0]);
  }
}
