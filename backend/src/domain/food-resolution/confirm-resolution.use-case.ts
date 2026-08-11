import type { FoodEntry } from '../foods/types.ts';
import type { CatalogStore } from '../food-catalog/types.ts';
import { slugifyName } from '../food-catalog/slugify-name.ts';
import { fold } from '../ingredient-search/fold.ts';
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
 * Re-key an entry by its canonical name and clean up its alternate names.
 *
 * The resolve sheet lets the user rename an AI-proposed entry (`dünne Reisnudeln`
 * → `Reisnudeln`) while the proposed id rides along untouched, so the id is
 * derived here rather than trusted — the entry is always keyed by the name it is
 * stored under. Synonyms are deduplicated and stripped of the canonical name for
 * the same reason: renaming turns a retained alias into a duplicate of the name,
 * which entry validation rejects outright.
 */
function normalizeNewFoodEntry(entry: FoodEntry): { ok: true; entry: FoodEntry } | { ok: false; reason: string } {
  const id = slugifyName(entry.name ?? '');
  if (id === '') return { ok: false, reason: `entry name "${String(entry.name)}" yields no usable id` };

  const foldedName = fold(entry.name);
  const seen = new Set<string>([foldedName]);
  const synonyms = (entry.synonyms ?? []).filter((s) => {
    if (typeof s !== 'string') return true; // let validation report the real problem
    const folded = fold(s);
    if (seen.has(folded)) return false;
    seen.add(folded);
    return true;
  });

  return { ok: true, entry: { ...entry, id, synonyms } };
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
    const normalized = normalizeNewFoodEntry(input.entry);
    if (!normalized.ok) return { ok: false, status: 422, error: normalized.reason };
    const result = await deps.catalog.add(normalized.entry);
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
