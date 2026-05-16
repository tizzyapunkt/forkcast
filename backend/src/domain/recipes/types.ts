export type MeasurementUnit = 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece';

export interface MacrosPerUnit {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PieceQuantity {
  amount: number;
  unitLabel: string;
  gramsPerPiece: number;
}

export interface DisplayQuantity {
  amount: number;
  unitLabel: string;
}

export interface RecipeIngredient {
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  amount: number;
  pieceQuantity?: PieceQuantity;
  untracked?: boolean;
  displayQuantity?: DisplayQuantity;
  note?: string;
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
