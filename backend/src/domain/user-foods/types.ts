import type { FoodEntry } from '../foods/types.ts';

/** A user-confirmed alternate name for an existing curated catalog food. */
export interface LearnedSynonym {
  /** The curated FOODS entry id this synonym aliases. */
  foodId: string;
  /** The alternate name to learn (display form; case/diacritics preserved). */
  synonym: string;
}

/** The runtime-writable overlay: confirmed foods plus learned synonyms. */
export interface UserFoodsOverlay {
  foods: FoodEntry[];
  synonyms: LearnedSynonym[];
}

/**
 * Port for the runtime-writable user-foods overlay store. New foods and learned
 * synonyms confirmed during import resolution land here; the laptop curation
 * pipeline drains it via {@link exportAndClear}.
 */
export interface UserFoodsStore {
  load(): Promise<UserFoodsOverlay>;
  /** Validate and append a new food. Rejects on validation failure or overlay-internal collision. */
  addFood(entry: FoodEntry): Promise<void>;
  /** Append a learned synonym (no-op when the same foodId+synonym already exists). */
  addSynonym(syn: LearnedSynonym): Promise<void>;
  /** Atomically return the full overlay content and reset the store to empty. */
  exportAndClear(): Promise<UserFoodsOverlay>;
}
