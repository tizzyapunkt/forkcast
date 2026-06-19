import type { MacrosPerUnit, MeasurementUnit } from '../meal-log/types.ts';

/**
 * Where a search result originated. `USER` is a runtime user-foods overlay entry;
 * `SCAN` is a product captured from packaging photos.
 */
export type IngredientResultSource = 'FOODS' | 'USER' | 'OFF' | 'SCAN';

export interface IngredientSearchResult {
  id: string;
  source: IngredientResultSource;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
  /** Mass per millilitre (g/ml) for volume→mass conversion of spoon measures. FOODS-only, optional. */
  density?: number;
  /** Human-readable serving size from the source product, e.g. "1 slice (25g)". */
  servingSize?: string;
  /** Gram weight of one serving from the source product. */
  servingQuantity?: number;
}
