import type { MeasurementUnit, MacrosPerUnit } from './meal-log';

/** Sources a search can be asked for. `RECENT` is a client-side list, never requested from the backend. */
export type IngredientSearchSource = 'CATALOG' | 'OFF' | 'SCAN';

export interface IngredientSearchResult {
  id: string;
  source: IngredientSearchSource | 'RECENT';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
  /** Human-readable serving size from the source product, e.g. "1 slice (25g)". */
  servingSize?: string;
  /** Gram weight of one serving from the source product. */
  servingQuantity?: number;
}
