import type { MeasurementUnit, MacrosPerUnit } from './meal-log';

export interface IngredientSearchResult {
  id: string;
  source: 'OFF' | 'FOODS' | 'RECENT' | 'SCAN';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
}
