import type { FoodEntry } from '../foods/types.ts';
import type { CatalogStore } from '../food-catalog/types.ts';
import type { MatchedDraftIngredient } from '../ai-recipe-import/types.ts';
import {
  buildMatchedRow,
  type MatchSourceFood,
  type OriginalDraftFields,
} from '../ai-recipe-import/build-matched-row.ts';

export type ConfirmResolutionInput =
  | { kind: 'new-food'; entry: FoodEntry; original: OriginalDraftFields }
  | { kind: 'synonym'; foodId: string; synonym: string; original: OriginalDraftFields };

export type ConfirmResolutionResult =
  | { ok: true; ingredient: MatchedDraftIngredient }
  | { ok: false; status: 404 | 409 | 422; error: string };

export interface ConfirmResolutionDeps {
  catalog: CatalogStore;
}

/** The catalog entry as the import matcher wants it: per-unit macros, untracked as a plain flag. */
function toMatchSource(entry: FoodEntry): MatchSourceFood {
  const m = entry.macrosPer100;
  return {
    name: entry.name,
    unit: entry.unit,
    macrosPerUnit: { calories: m.calories / 100, protein: m.protein / 100, carbs: m.carbs / 100, fat: m.fat / 100 },
    untracked: entry.untracked === true,
    density: entry.density,
  };
}

/**
 * Persist a confirmed resolution to the catalog and build the resolved draft row
 * by reusing the import post-match rules. A `new-food` appends an entry, a
 * `synonym` extends an existing entry's alternate names — both searchable
 * immediately, because the store rebuilds its index on every accepted write.
 * Nothing is persisted when the write is refused.
 */
export async function confirmResolution(
  deps: ConfirmResolutionDeps,
  input: ConfirmResolutionInput,
): Promise<ConfirmResolutionResult> {
  if (input.kind === 'new-food') {
    const result = await deps.catalog.add(input.entry);
    if (!result.ok) {
      return { ok: false, status: result.kind === 'conflict' ? 409 : 422, error: result.reason };
    }
    return { ok: true, ingredient: buildMatchedRow(toMatchSource(result.entry), 'CATALOG', input.original) };
  }

  const result = await deps.catalog.addSynonym(input.foodId, input.synonym);
  if (!result.ok) {
    return { ok: false, status: result.kind === 'not-found' ? 404 : 422, error: result.reason };
  }
  return { ok: true, ingredient: buildMatchedRow(toMatchSource(result.entry), 'CATALOG', input.original) };
}
