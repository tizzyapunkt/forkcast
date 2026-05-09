import type { MacrosPer100, MeasurementUnit } from '../meal-log/types.ts';

export interface IngredientSearchResult {
  id: string;
  source: 'FOODS' | 'OFF';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
  untracked?: boolean;
}
