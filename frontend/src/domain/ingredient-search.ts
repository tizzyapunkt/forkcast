import type { MeasurementUnit, MacrosPer100 } from './meal-log';

export interface IngredientSearchResult {
  offId: string;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
}
