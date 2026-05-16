import type { DisplayQuantity, MacrosPerUnit, MeasurementUnit, PieceQuantity } from '../recipes/types.ts';

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
  source: 'FOODS' | 'OFF';
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

export interface SearchCandidateDebug {
  name: string;
  source: 'FOODS' | 'OFF';
  unit: MeasurementUnit;
  untracked: boolean;
}

export interface IngredientMatchDebug {
  raw: RawIngredient;
  candidates: SearchCandidateDebug[];
  chosen: SearchCandidateDebug | null;
  flags: {
    unitOverridden: boolean;
    pieceQuantityDropped: boolean;
    untrackedInherited: boolean;
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
