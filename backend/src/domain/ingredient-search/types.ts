import type { MacrosPer100, MeasurementUnit } from '../meal-log/types.js';

export interface IngredientSearchResult {
  offId: string;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100; // per single unit (e.g. per gram)
}
