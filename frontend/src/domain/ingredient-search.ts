import type { MeasurementUnit, MacrosPer100 } from './meal-log';

export interface IngredientSearchResult {
  id: string;
  source: 'OFF' | 'BLS' | 'RECENT';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
}
