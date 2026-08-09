import type { MacrosPerUnit, MeasurementUnit } from '../meal-log/types.ts';

/**
 * Where a search result originated. `CATALOG` is the user's own editable food
 * catalog; `SCAN` is a product captured from packaging photos; `OFF` is Open
 * Food Facts.
 */
export type IngredientResultSource = 'CATALOG' | 'OFF' | 'SCAN';

export interface IngredientSearchResult {
  id: string;
  source: IngredientResultSource;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
  /** Mass per millilitre (g/ml) for volume→mass conversion of spoon measures. Catalog-only, optional. */
  density?: number;
  /** Human-readable serving size from the source product, e.g. "1 slice (25g)". */
  servingSize?: string;
  /** Gram weight of one serving from the source product. */
  servingQuantity?: number;
}
