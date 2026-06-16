import type { MeasurementUnit, MacrosPerUnit } from './meal-log';
import type { MatchedDraftIngredient, PieceQuantity } from './recipes';

export type ResolutionConfidence = 'high' | 'medium' | 'low';

/** A full food entry (per-100 macros), the editable payload of a new-food proposal. */
export interface FoodEntryDraft {
  id: string;
  name: string;
  synonyms: string[];
  unit: 'g' | 'ml';
  macrosPer100: MacrosPerUnit;
  pieces?: { label: string; grams: number }[];
  untracked?: boolean;
}

/** A curated food summary embedded in a synonym proposal. */
export interface ProposalFoodSummary {
  id: string;
  name: string;
  unit: 'g' | 'ml';
  macrosPer100: MacrosPerUnit;
  untracked?: boolean;
}

export type ResolutionProposal =
  | {
      verdict: 'synonym-of';
      foodId: string;
      synonym: string;
      confidence: ResolutionConfidence;
      food: ProposalFoodSummary;
    }
  | { verdict: 'new-food'; entry: FoodEntryDraft; confidence: ResolutionConfidence }
  | { verdict: 'skip'; reason: string };

/** A single unmatched item sent to the propose endpoint. */
export interface ResolutionItemInput {
  name: string;
  note?: string;
  unit?: MeasurementUnit | null;
  amount?: number | null;
}

/** The original draft fields preserved when confirming, so the resolved row keeps its quantities. */
export interface OriginalDraftFields {
  amount?: number | null;
  unit?: MeasurementUnit | null;
  pieceQuantity?: PieceQuantity;
  note?: string;
  rawDisplayAmount?: number;
  rawDisplayUnitLabel?: string;
}

export type ConfirmResolutionPayload =
  | { kind: 'new-food'; entry: FoodEntryDraft; original: OriginalDraftFields }
  | { kind: 'synonym'; foodId: string; synonym: string; original: OriginalDraftFields };

export interface ConfirmResolutionResponse {
  ingredient: MatchedDraftIngredient;
}

/** The user-foods overlay export shape (also the augment-script input). */
export interface UserFoodsOverlayExport {
  foods: FoodEntryDraft[];
  synonyms: { foodId: string; synonym: string }[];
}
