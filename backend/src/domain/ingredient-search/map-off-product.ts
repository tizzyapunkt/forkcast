import type { IngredientSearchResult } from './types.ts';

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  // Open Food Facts returns many more nutrient keys (per-serving, per-value, units, …).
  // We only read the `_100g` fields above; the rest are tolerated and ignored.
  [key: string]: number | string | undefined;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  /** A list from search-a-licious, a comma-separated string from the product API. */
  brands?: string | string[];
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
}

/** Open Food Facts names are often shouted (`SKYR`) or all lowercase (`skyr`): sentence-case those, keep the rest. */
function tidyName(raw: string): string {
  const name = raw.trim();
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function mapOffProduct(product: OffProduct): IngredientSearchResult | null {
  const rawName = product.product_name || product.product_name_de;
  if (!rawName) return null;
  const name = tidyName(rawName);
  const brands = typeof product.brands === 'string' ? product.brands.split(',') : (product.brands ?? []);
  const brand = brands[0]?.trim() || undefined;

  const n = product.nutriments ?? {};
  const calories100 = n['energy-kcal_100g'];
  if (calories100 === undefined || calories100 === null) return null;

  const servingSize =
    typeof product.serving_size === 'string' && product.serving_size.length > 0 ? product.serving_size : undefined;
  const servingQuantityNum = Number(product.serving_quantity);
  const servingQuantity =
    Number.isFinite(servingQuantityNum) && servingQuantityNum > 0 ? servingQuantityNum : undefined;

  return {
    id: product.code ?? '',
    source: 'OFF',
    name,
    unit: 'g',
    macrosPerUnit: {
      calories: calories100 / 100,
      protein: (n.proteins_100g ?? 0) / 100,
      carbs: (n.carbohydrates_100g ?? 0) / 100,
      fat: (n.fat_100g ?? 0) / 100,
    },
    ...(brand !== undefined ? { brand } : {}),
    ...(servingSize !== undefined ? { servingSize } : {}),
    ...(servingQuantity !== undefined ? { servingQuantity } : {}),
  };
}
