import type { MacrosPer100, MeasurementUnit } from '../meal-log/types.ts';

export type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface RecipeImage {
  mediaType: SupportedImageMediaType;
  bytes: Uint8Array;
}

export interface RawIngredient {
  name: string;
  amount?: number;
  unit?: MeasurementUnit;
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
  source: 'BLS' | 'OFF';
}

export interface UnmatchedDraftIngredient {
  matched: false;
  name: string;
  amount: number | null;
  unit: MeasurementUnit | null;
}

export type DraftIngredient = MatchedDraftIngredient | UnmatchedDraftIngredient;

export interface RecipeDraft {
  name: string;
  yield: number;
  ingredients: DraftIngredient[];
  steps: string[];
}
