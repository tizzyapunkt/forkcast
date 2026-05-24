import type { IngredientSearchResult } from '../ingredient-search/types.ts';
import type { ScannedProduct } from './types.ts';

/**
 * Maps a stored product to a search result, mirroring the OFF/FOODS mappers:
 * the barcode is the id, the source is `SCAN`, and per-100 macros are divided
 * by 100 to the per-unit convention used everywhere downstream.
 */
export function mapScannedProduct(product: ScannedProduct): IngredientSearchResult {
  return {
    id: product.barcode,
    source: 'SCAN',
    name: product.name,
    unit: product.unit,
    macrosPerUnit: {
      calories: product.macrosPer100.calories / 100,
      protein: product.macrosPer100.protein / 100,
      carbs: product.macrosPer100.carbs / 100,
      fat: product.macrosPer100.fat / 100,
    },
  };
}
