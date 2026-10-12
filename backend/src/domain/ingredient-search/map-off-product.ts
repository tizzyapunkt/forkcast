import type { IngredientSearchResult } from './types.ts';
import type { CatalogLocale } from '../foods/types.ts';

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
  product_name_en?: string;
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

const NAME_ORDER: Record<CatalogLocale | 'none', (keyof OffProduct)[]> = {
  en: ['product_name_en', 'product_name', 'product_name_de'],
  de: ['product_name_de', 'product_name', 'product_name_en'],
  none: ['product_name', 'product_name_de', 'product_name_en'],
};

/** The name in `locale` when Open Food Facts has one, else the generic name, else the other locale's. */
function pickName(product: OffProduct, locale?: CatalogLocale): string | undefined {
  for (const field of NAME_ORDER[locale ?? 'none']) {
    const value = product[field];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
}

export function mapOffProduct(product: OffProduct, locale?: CatalogLocale): IngredientSearchResult | null {
  const rawName = pickName(product, locale);
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
