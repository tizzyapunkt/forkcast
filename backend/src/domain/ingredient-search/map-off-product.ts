import type { IngredientSearchResult } from './types.ts';

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  nutriments?: OffNutriments;
}

export function mapOffProduct(product: OffProduct): IngredientSearchResult | null {
  const name = product.product_name || product.product_name_de;
  if (!name) return null;

  const n = product.nutriments ?? {};
  const calories100 = n['energy-kcal_100g'];
  if (calories100 === undefined || calories100 === null) return null;

  return {
    offId: product.code ?? '',
    name,
    unit: 'g',
    macrosPerUnit: {
      calories: calories100 / 100,
      protein: (n.proteins_100g ?? 0) / 100,
      carbs: (n.carbohydrates_100g ?? 0) / 100,
      fat: (n.fat_100g ?? 0) / 100,
    },
  };
}
