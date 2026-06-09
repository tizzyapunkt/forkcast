import type { MacrosPerUnit, MeasurementUnit } from '../meal-log/types.ts';

/** Where a search result originated. `SCAN` is a product captured from packaging photos. */
export type IngredientResultSource = 'FOODS' | 'OFF' | 'SCAN';

export interface IngredientSearchResult {
  id: string;
  source: IngredientResultSource;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
  /** Human-readable serving size from the source product, e.g. "1 slice (25g)". */
  servingSize?: string;
  /** Gram weight of one serving from the source product. */
  servingQuantity?: number;
}
