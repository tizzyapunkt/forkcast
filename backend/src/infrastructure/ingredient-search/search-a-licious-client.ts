// Thin client for Open Food Facts' Search-a-licious service
// (https://search.openfoodfacts.org, docs at /docs — beta, v0.1.x).
//
// OFF permanently shut down the classic full-text search endpoints
// (`/cgi/search.pl`, `/api/v2/search` with text parameters); full-text search
// only exists on this service now. The official JS SDK's search binding is
// generated from the beta spec and the SDK itself is still alpha, so we keep
// full-text search on this hand-rolled wrapper instead — it is deliberately
// self-contained so it can be swapped back to the SDK (or anything else)
// without touching callers. Barcode/product-detail lookups stay on the SDK.
// See README "Open Food Facts search" for the full reasoning.

const DEFAULT_BASE_URL = 'https://search.openfoodfacts.org';
const REQUEST_TIMEOUT_MS = 8_000;
const BODY_SNIPPET_MAX = 300;
// OFF asks API consumers to identify themselves via User-Agent.
const USER_AGENT = 'forkcast/1.0 (personal meal planner)';

export interface SearchALiciousQuery {
  /**
   * Full-text query. Supports Lucene-like field filters appended to the text,
   * e.g. `apfel lang:de countries_tags:"en:germany" brands_tags:"alnatura"`.
   */
  q: string;
  /** Comma-separated languages used for matching/localized fields, e.g. `de`. */
  langs?: string;
  /** 1-based result page. */
  page?: number;
  page_size?: number;
  /** Comma-separated product fields to include in each hit. */
  fields?: string;
  sort_by?: string;
}

/** Hits carry only the requested `fields`; callers map them to domain types. */
export type SearchALiciousHit = Record<string, unknown>;

export interface SearchALiciousSuccess {
  hits: SearchALiciousHit[];
  page: number;
  page_size: number;
  page_count: number;
  count: number;
  is_count_exact: boolean;
  took: number;
  timed_out: boolean;
}

/** Search-a-licious reports query errors with HTTP 200 and this body instead of hits. */
export interface SearchALiciousErrorBody {
  errors: unknown[];
}

export type SearchALiciousResponse = SearchALiciousSuccess | SearchALiciousErrorBody;

export class SearchALiciousHttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly bodySnippet?: string,
  ) {
    const base = `Search-a-licious request failed: ${status} ${statusText}`;
    super(bodySnippet ? `${base} — ${bodySnippet}` : base);
    this.name = 'SearchALiciousHttpError';
  }
}

export class SearchALiciousClient {
  constructor(
    private readonly fetchFn: typeof fetch = globalThis.fetch,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  /**
   * GET /search. Non-2xx responses become `SearchALiciousHttpError`;
   * network and timeout errors from fetch propagate untouched so callers
   * can classify them the same way as for other OFF requests.
   */
  async search(query: SearchALiciousQuery): Promise<SearchALiciousResponse> {
    const url = new URL('/search', this.baseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await this.fetchFn(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new SearchALiciousHttpError(
        response.status,
        response.statusText,
        text.length > 0 ? text.slice(0, BODY_SNIPPET_MAX) : undefined,
      );
    }
    return (await response.json()) as SearchALiciousResponse;
  }
}
