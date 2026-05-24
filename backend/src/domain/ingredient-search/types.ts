import type { MacrosPerUnit, MeasurementUnit } from '../meal-log/types.ts';

/** Where a search result originated. `SCAN` is a product captured from packaging photos. */
export type IngredientResultSource = 'FOODS' | 'OFF' | 'SCAN';

export interface IngredientSearchResult {
  id: string;
  source: IngredientResultSource;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
}
