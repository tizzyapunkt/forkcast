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
  /** The recipe's spoon measure, kept so resolving the row can still convert it to an amount. */
  rawDisplayAmount?: number;
  rawDisplayUnitLabel?: string;
  gramsPerSpoon?: number;
  note?: string;
}

export type DraftIngredient = MatchedDraftIngredient | UnmatchedDraftIngredient;

/** What the vision model read for one ingredient, before any catalog matching. */
export interface RawIngredientProvenance {
  name: string;
  /** The ingredient line exactly as printed — the model's transcription, before any interpretation. */
  sourceText?: string;
  amount?: number;
  unit?: MeasurementUnit;
  pieceQuantity?: PieceQuantity;
  rawDisplayAmount?: number;
  rawDisplayUnitLabel?: string;
  /** The model's estimate of one spoon of this food in grams. */
  gramsPerSpoon?: number;
  note?: string;
}

export interface SearchCandidateProvenance {
  name: string;
  source: IngredientSearchSource;
  unit: MeasurementUnit;
  untracked: boolean;
}

export interface IngredientMatchProvenance {
  raw: RawIngredientProvenance;
  candidates: SearchCandidateProvenance[];
  chosen: SearchCandidateProvenance | null;
  flags: {
    unitOverridden: boolean;
    pieceQuantityDropped: boolean;
    untrackedInherited: boolean;
    missingAmount: boolean;
    /** The amount rests on the model's per-spoon estimate. Absent from older backends — read as false. */
    spoonEstimated?: boolean;
  };
}

export interface RecipeDraftProvenance {
  /** Positionally parallel to `RecipeDraft.ingredients` — entry *i* describes draft ingredient *i*. */
  ingredients: IngredientMatchProvenance[];
}

export interface RecipeDraft {
  name: string;
  yield: number;
  ingredients: DraftIngredient[];
  steps: string[];
  /** The backend always sends this; optional here so the review screen degrades rather than breaks. */
  provenance?: RecipeDraftProvenance;
}
