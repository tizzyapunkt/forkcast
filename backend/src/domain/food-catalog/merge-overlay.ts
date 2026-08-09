import type { FoodEntry } from '../foods/types.ts';
import { fold } from '../ingredient-search/fold.ts';
import { findCatalogCollision, validateCatalogEntry } from './validate-catalog-entry.ts';

/** A user-confirmed alternate name recorded by the retired overlay. */
export interface LegacyLearnedSynonym {
  foodId: string;
  synonym: string;
}

/** The retired `user-foods.json` shape: confirmed foods plus learned synonyms. */
export interface LegacyUserFoodsOverlay {
  foods: FoodEntry[];
  synonyms: LegacyLearnedSynonym[];
}

export interface OverlayMergeResult {
  entries: FoodEntry[];
  /** Skipped foods and orphaned synonyms, each naming the offending id. */
  warnings: string[];
}

/**
 * Fold a legacy overlay into the catalog: foods are appended (an id or name
 * already in the catalog wins), learned synonyms are added to their target
 * entry. Idempotent by construction — re-merging already-merged content only
 * re-reports the collisions — so a crash between writing the catalog and
 * deleting the legacy file replays harmlessly.
 */
export function mergeOverlayIntoCatalog(catalog: FoodEntry[], overlay: LegacyUserFoodsOverlay): OverlayMergeResult {
  const warnings: string[] = [];
  const entries = [...catalog];

  for (const food of overlay.foods) {
    const validation = validateCatalogEntry(food);
    if (!validation.ok) {
      warnings.push(`catalog migration: skipping overlay food — ${validation.reason}`);
      continue;
    }
    const collision = findCatalogCollision(entries, validation.entry);
    if (collision !== null) {
      warnings.push(`catalog migration: skipping overlay food "${validation.entry.id}" — ${collision}`);
      continue;
    }
    entries.push(validation.entry);
  }

  for (const { foodId, synonym } of overlay.synonyms) {
    const index = entries.findIndex((e) => e.id === foodId);
    if (index === -1) {
      warnings.push(`catalog migration: skipping learned synonym for unknown foodId "${foodId}"`);
      continue;
    }
    const target = entries[index]!;
    const folded = fold(synonym);
    if (folded === fold(target.name) || target.synonyms.some((s) => fold(s) === folded)) continue;
    entries[index] = { ...target, synonyms: [...target.synonyms, synonym] };
  }

  return { entries, warnings };
}
