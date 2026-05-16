import type { MacrosPerUnit, MeasurementUnit } from '../meal-log/types.ts';

export interface IngredientSearchResult {
  id: string;
  source: 'FOODS' | 'OFF';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
}
