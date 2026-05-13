import type { MeasurementUnit, MacrosPer100 } from './meal-log';

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
  macrosPerUnit: MacrosPer100;
  amount: number;
  pieceQuantity?: PieceQuantity;
  untracked?: boolean;
  displayQuantity?: DisplayQuantity;
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

export interface MatchedDraftIngredient {
  matched: true;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
  amount: number | null;
  unitOverridden: boolean;
  source: 'FOODS' | 'OFF';
  pieceQuantity?: PieceQuantity;
  untracked?: boolean;
  displayQuantity?: DisplayQuantity;
}

export interface UnmatchedDraftIngredient {
  matched: false;
  name: string;
  amount: number | null;
  unit: MeasurementUnit | null;
  pieceQuantity?: PieceQuantity;
}

export type DraftIngredient = MatchedDraftIngredient | UnmatchedDraftIngredient;

export interface RecipeDraft {
  name: string;
  yield: number;
  ingredients: DraftIngredient[];
  steps: string[];
}
