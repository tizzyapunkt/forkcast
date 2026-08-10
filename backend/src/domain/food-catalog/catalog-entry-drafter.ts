import type { FoodEntry } from '../foods/types.ts';

/**
 * Port: drafts one candidate catalog entry from a bare food name, for the
 * catalog manager's optional fill action. The draft is a suggestion — the user
 * edits and saves it — so nothing here persists.
 */
export interface CatalogEntryDrafter {
  draft(name: string): Promise<FoodEntry>;
}

/** Raised when the AI provider errors, times out, or returns unusable tool output. */
export class CatalogDraftError extends Error {}
