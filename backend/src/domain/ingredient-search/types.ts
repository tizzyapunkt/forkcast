import type { MacrosPer100, MeasurementUnit } from '../meal-log/types.ts';

export interface IngredientSearchResult {
  id: string;
  source: 'OFF' | 'BLS';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
}
