import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.ts';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.ts';
import { mapOffProduct } from '../../domain/ingredient-search/map-off-product.ts';

const PRODUCT_BASE_URL = 'https://world.openfoodfacts.org';
const SEARCH_BASE_URL = 'https://search.openfoodfacts.org';
const USER_AGENT = 'forkcast/0.1 (icejunior1991+anthropic@gmail.com)';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || !contentType.includes('application/json')) {
    throw new Error(
      `Open Food Facts request failed: ${res.status} ${res.statusText} (content-type: ${contentType || 'none'})`,
    );
  }
  return (await res.json()) as T;
}

export class OpenFoodFactsService implements IngredientSearchService {
  async searchByName(query: string): Promise<IngredientSearchResult[]> {
    const q = `${query} lang:de`;
    const url = `${SEARCH_BASE_URL}/search?q=${encodeURIComponent(q)}&langs=de&page_size=20&fields=code,product_name,product_name_de,nutriments`;
    const data = await fetchJson<{ hits?: unknown[] }>(url);
    const hits = data.hits ?? [];
    return hits.flatMap((p) => {
      const result = mapOffProduct(p as Parameters<typeof mapOffProduct>[0]);
      return result ? [result] : [];
    });
  }

  async searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    const url = `${PRODUCT_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}?fields=code,product_name,product_name_de,nutriments`;
    const data = await fetchJson<{ status: number; product?: unknown }>(url);
    if (data.status !== 1 || !data.product) return null;
    return mapOffProduct(data.product as Parameters<typeof mapOffProduct>[0]);
  }
}
