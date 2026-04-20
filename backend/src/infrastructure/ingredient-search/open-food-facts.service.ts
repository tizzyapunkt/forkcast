import type { IngredientSearchService } from '../../domain/ingredient-search/ingredient-search.service.js';
import type { IngredientSearchResult } from '../../domain/ingredient-search/types.js';
import { mapOffProduct } from '../../domain/ingredient-search/map-off-product.js';

const BASE_URL = 'https://world.openfoodfacts.org';

export class OpenFoodFactsService implements IngredientSearchService {
  async searchByName(query: string): Promise<IngredientSearchResult[]> {
    const url = `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20&fields=code,product_name,product_name_en,nutriments`;
    const res = await fetch(url);
    const data = (await res.json()) as { products?: unknown[] };
    const products = data.products ?? [];
    return products.flatMap((p) => {
      const result = mapOffProduct(p as Parameters<typeof mapOffProduct>[0]);
      return result ? [result] : [];
    });
  }

  async searchByBarcode(barcode: string): Promise<IngredientSearchResult | null> {
    const url = `${BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}?fields=code,product_name,product_name_en,nutriments`;
    const res = await fetch(url);
    const data = (await res.json()) as { status: number; product?: unknown };
    if (data.status !== 1 || !data.product) return null;
    return mapOffProduct(data.product as Parameters<typeof mapOffProduct>[0]);
  }
}
