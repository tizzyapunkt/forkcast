import type { MeasurementUnit, MacrosPerUnit } from './meal-log';

export interface IngredientSearchResult {
  id: string;
  source: 'OFF' | 'FOODS' | 'USER' | 'RECENT' | 'SCAN';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
  /** Human-readable serving size from the source product, e.g. "1 slice (25g)". */
  servingSize?: string;
  /** Gram weight of one serving from the source product. */
  servingQuantity?: number;
}
