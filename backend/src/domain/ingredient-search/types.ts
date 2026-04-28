import type { MacrosPer100, MeasurementUnit } from '../meal-log/types.ts';

export interface IngredientSearchResult {
  offId: string;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100; // per single unit (e.g. per gram)
}
