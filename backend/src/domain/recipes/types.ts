export type MeasurementUnit = 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece';

export interface MacrosPer100 {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

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
