import type { MeasurementUnit, MacrosPerUnit } from './meal-log';
import type { IngredientSearchSource } from './ingredient-search';

export interface PieceQuantity {
  amount: number;
  unitLabel: string;
  gramsPerPiece: number;
}

export interface DisplayQuantity {
  /**
   * Optional: a purely qualitative label ("nach Geschmack") carries no number. When
   * present it is a count for the unitLabel ("1 Prise") and scales with servings.
   */
  amount?: number;
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

export interface MatchedDraftIngredient {
  matched: true;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  amount: number | null;
  unitOverridden: boolean;
  source: IngredientSearchSource;
  pieceQuantity?: PieceQuantity;
  untracked?: boolean;
  displayQuantity?: DisplayQuantity;
  note?: string;
}

export interface UnmatchedDraftIngredient {
  matched: false;
  name: string;
  amount: number | null;
  unit: MeasurementUnit | null;
  pieceQuantity?: PieceQuantity;
  note?: string;
}

export type DraftIngredient = MatchedDraftIngredient | UnmatchedDraftIngredient;

export interface RawIngredientDebug {
  name: string;
  amount?: number;
  unit?: MeasurementUnit;
  pieceQuantity?: PieceQuantity;
  rawDisplayAmount?: number;
  rawDisplayUnitLabel?: string;
  note?: string;
}

export interface SearchCandidateDebug {
  name: string;
  source: IngredientSearchSource;
  unit: MeasurementUnit;
  untracked: boolean;
}

export interface IngredientMatchDebug {
  raw: RawIngredientDebug;
  candidates: SearchCandidateDebug[];
  chosen: SearchCandidateDebug | null;
  flags: {
    unitOverridden: boolean;
    pieceQuantityDropped: boolean;
    untrackedInherited: boolean;
    missingAmount: boolean;
  };
}

export interface RecipeDraftDebug {
  ingredients: IngredientMatchDebug[];
}

export interface RecipeDraft {
  name: string;
  yield: number;
  ingredients: DraftIngredient[];
  steps: string[];
  debug?: RecipeDraftDebug;
}
