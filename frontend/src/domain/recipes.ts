import type { MeasurementUnit, MacrosPer100 } from './meal-log';

export interface RecipeIngredient {
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
  amount: number;
}

export interface Recipe {
  id: string;
  name: string;
  yield: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  createdAt: string;
  updatedAt: string;
}
