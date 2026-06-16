import type { FoodEntry } from '../foods/types.ts';
import type { MatchedDraftIngredient } from '../ai-recipe-import/types.ts';
import {
  buildMatchedRow,
  type MatchSourceFood,
  type OriginalDraftFields,
} from '../ai-recipe-import/build-matched-row.ts';
import { validateFoodEntry } from '../foods/validate-food-entry.ts';
import { fold } from '../ingredient-search/fold.ts';
import type { UserFoodsStore } from '../user-foods/types.ts';

/** A learned-synonym index the confirm use case registers against (the curated FOODS service). */
export interface SynonymRegistrar {
  /** Returns false when `foodId` is unknown (orphaned synonym). */
  addSynonym(foodId: string, synonym: string): boolean;
  /** Look up a curated entry by id so the resolved row can adopt its unit/macros. */
  findById(foodId: string): MatchSourceFood | null;
}

export type ConfirmResolutionInput =
  | { kind: 'new-food'; entry: FoodEntry; original: OriginalDraftFields }
  | { kind: 'synonym'; foodId: string; synonym: string; original: OriginalDraftFields };

export type ConfirmResolutionResult =
  | { ok: true; ingredient: MatchedDraftIngredient }
  | { ok: false; status: 409 | 422; error: string };

export interface ConfirmResolutionDeps {
  overlay: UserFoodsStore;
  curated: SynonymRegistrar;
}

/**
 * Persist a confirmed resolution to the overlay and build the resolved draft row
 * by reusing the import post-match rules. New foods are validated and checked for
 * collision against the curated catalog and overlay; synonyms register on the
 * live curated index.
 */
export async function confirmResolution(
  deps: ConfirmResolutionDeps,
  input: ConfirmResolutionInput,
): Promise<ConfirmResolutionResult> {
  if (input.kind === 'new-food') {
    const validation = validateFoodEntry(input.entry);
    if (!validation.ok) return { ok: false, status: 422, error: validation.reason };
    const entry = validation.entry;

    const foldedName = fold(entry.name);
    if (deps.curated.findById(entry.id)) {
      return { ok: false, status: 409, error: `a curated food already has id "${entry.id}"` };
    }
    const overlay = await deps.overlay.load();
    const collision = overlay.foods.some((f) => f.id === entry.id || fold(f.name) === foldedName);
    if (collision) return { ok: false, status: 409, error: `an overlay food already matches "${entry.name}"` };

    try {
      await deps.overlay.addFood(entry);
    } catch (err) {
      return { ok: false, status: 422, error: err instanceof Error ? err.message : String(err) };
    }
    const source: MatchSourceFood = {
      name: entry.name,
      unit: entry.unit,
      macrosPerUnit: {
        calories: entry.macrosPer100.calories / 100,
        protein: entry.macrosPer100.protein / 100,
        carbs: entry.macrosPer100.carbs / 100,
        fat: entry.macrosPer100.fat / 100,
      },
      untracked: entry.untracked === true,
    };
    return { ok: true, ingredient: buildMatchedRow(source, 'USER', input.original) };
  }

  // synonym
  const food = deps.curated.findById(input.foodId);
  if (!food) return { ok: false, status: 422, error: `no curated food with id "${input.foodId}"` };
  await deps.overlay.addSynonym({ foodId: input.foodId, synonym: input.synonym });
  deps.curated.addSynonym(input.foodId, input.synonym);
  return { ok: true, ingredient: buildMatchedRow(food, 'FOODS', input.original) };
}
