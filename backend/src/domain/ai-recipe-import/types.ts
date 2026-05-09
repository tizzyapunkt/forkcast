import type { MacrosPer100, MeasurementUnit, PieceQuantity } from '../recipes/types.ts';

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
  macrosPerUnit: MacrosPer100;
  amount: number | null;
  unitOverridden: boolean;
  source: 'FOODS' | 'OFF';
  pieceQuantity?: PieceQuantity;
  untracked?: boolean;
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
