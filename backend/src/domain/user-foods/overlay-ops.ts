import type { FoodEntry } from '../foods/types.ts';
import { validateFoodEntry } from '../foods/validate-food-entry.ts';
import { fold } from '../ingredient-search/fold.ts';
import type { LearnedSynonym, UserFoodsOverlay } from './types.ts';

export function emptyOverlay(): UserFoodsOverlay {
  return { foods: [], synonyms: [] };
}

export type OverlayAddResult = { ok: true; overlay: UserFoodsOverlay } | { ok: false; reason: string };

/**
 * Validate `entry` against the curated food-entry rules and append it to a copy
 * of `overlay`. Rejects entries that fail validation or collide (by id or folded
 * canonical name) with a food already in the overlay. Cross-source collision with
 * the curated catalog is the confirm use case's responsibility, not the store's.
 */
export function addFoodToOverlay(overlay: UserFoodsOverlay, entry: FoodEntry): OverlayAddResult {
  const validation = validateFoodEntry(entry);
  if (!validation.ok) return { ok: false, reason: validation.reason };
  const foldedName = fold(entry.name);
  for (const existing of overlay.foods) {
    if (existing.id === entry.id || fold(existing.name) === foldedName) {
      return { ok: false, reason: `overlay already has a food matching "${entry.name}"` };
    }
  }
  return { ok: true, overlay: { foods: [...overlay.foods, entry], synonyms: overlay.synonyms } };
}

/** Append a learned synonym to a copy of `overlay`, deduping by foodId + folded synonym. */
export function addSynonymToOverlay(overlay: UserFoodsOverlay, syn: LearnedSynonym): UserFoodsOverlay {
  const foldedSyn = fold(syn.synonym);
  const dup = overlay.synonyms.some((s) => s.foodId === syn.foodId && fold(s.synonym) === foldedSyn);
  if (dup) return overlay;
  return { foods: overlay.foods, synonyms: [...overlay.synonyms, syn] };
}
