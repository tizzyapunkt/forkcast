import type { FoodEntry } from '../foods/types.ts';
import type { MeasurementUnit } from '../recipes/types.ts';

export type ResolutionConfidence = 'high' | 'medium' | 'low';

/** A single unmatched ingredient to propose a resolution for. */
export interface ResolutionItem {
  name: string;
  note?: string;
  unit?: MeasurementUnit | null;
  amount?: number | null;
}

/** A candidate catalog food shown to the model so it can recognise a synonym instead of inventing a duplicate. */
export interface ResolutionCandidate {
  id: string;
  name: string;
  unit: 'g' | 'ml';
  macrosPer100: FoodEntry['macrosPer100'];
  untracked?: boolean;
}

export interface ResolutionRequest {
  item: ResolutionItem;
  /** Top-K fuzzy candidates from FOODS + USER for this item (not the whole catalog). */
  candidates: ResolutionCandidate[];
}

export type ResolutionVerdict =
  | { verdict: 'synonym-of'; foodId: string; synonym: string; confidence: ResolutionConfidence }
  | { verdict: 'new-food'; entry: FoodEntry; confidence: ResolutionConfidence }
  | { verdict: 'skip'; reason: string };

/**
 * Port: proposes one resolution verdict per unmatched item via a single AI call.
 * The adapter returns the model's verdicts verbatim; validation and degradation
 * of malformed `new-food` entries to `skip` is the use case's responsibility.
 */
export interface FoodResolutionProposer {
  propose(requests: ResolutionRequest[]): Promise<ResolutionVerdict[]>;
}

/**
 * Port: finds fuzzy candidate foods (FOODS + USER) for an unmatched name, so the
 * proposer can recognise a synonym the strict auto-matcher missed. Looser than
 * `IngredientSearchService.searchByName` on purpose.
 */
export interface ResolutionCandidateFinder {
  findCandidates(query: string, limit: number): Promise<ResolutionCandidate[]>;
}

/** Raised when the AI provider errors, times out, or returns unparseable tool output. */
export class FoodResolutionError extends Error {}
