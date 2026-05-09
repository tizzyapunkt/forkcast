import type { MeasurementUnit, MacrosPer100 } from './meal-log';

export interface IngredientSearchResult {
  id: string;
  source: 'OFF' | 'FOODS' | 'RECENT';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
  untracked?: boolean;
}
