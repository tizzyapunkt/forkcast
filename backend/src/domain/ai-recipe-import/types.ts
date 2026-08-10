import type { DisplayQuantity, MacrosPerUnit, MeasurementUnit, PieceQuantity } from '../recipes/types.ts';
import type { IngredientResultSource } from '../ingredient-search/types.ts';

export type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface RecipeImage {
  mediaType: SupportedImageMediaType;
  bytes: Uint8Array;
}

export interface RawIngredient {
  name: string;
  amount?: number;
  unit?: MeasurementUnit;
  pieceQuantity?: PieceQuantity;
  rawDisplayAmount?: number;
  rawDisplayUnitLabel?: string;
  note?: string;
}

export interface ExtractedDraft {
  name: string;
  yield: number;
  ingredients: RawIngredient[];
  steps: string[];
}

export interface MatchedDraftIngredient {
  matched: true;
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPerUnit;
  amount: number | null;
  unitOverridden: boolean;
  source: IngredientResultSource;
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

export interface SearchCandidateProvenance {
  name: string;
  source: IngredientResultSource;
  unit: MeasurementUnit;
  untracked: boolean;
}

export interface IngredientMatchProvenance {
  raw: RawIngredient;
  candidates: SearchCandidateProvenance[];
  chosen: SearchCandidateProvenance | null;
  flags: {
    unitOverridden: boolean;
    pieceQuantityDropped: boolean;
    untrackedInherited: boolean;
    missingAmount: boolean;
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
  /** Always present: how each row was matched, for the review screen. Never persisted. */
  provenance: RecipeDraftProvenance;
}
