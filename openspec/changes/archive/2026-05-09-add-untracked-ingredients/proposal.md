## Why

Recipes need to include seasonings, herbs, and spices (salt, pepper, basil, oregano, …) to be complete and to drive the future grocery list, but those items contribute nothing meaningful to the macro rollups the user actually tracks. Today, every recipe ingredient is folded into the daily log and counted against goals — so adding a pinch of salt either gets omitted from the recipe (losing identity and grocery info) or gets logged as a near-zero entry that adds noise.

This change introduces a first-class concept of **untracked ingredients**: real ingredients that participate in a recipe and a future grocery list, but never roll up into nutrition totals.

## What Changes

- Add an `untracked: boolean` flag (default `false`) to recipe ingredients. When `true`, the ingredient still belongs to the recipe but contributes nothing to nutrition rollups.
- Add the same `untracked: boolean` flag to curated FOODS entries so seasonings, herbs, and spices can be seeded as untracked. Untracked FOODS entries still carry a (canonically zero) `macrosPer100`; the flag is the source of truth.
- Extend the seed-key list (`backend/scripts/foods-seed-keys.ts`) to allow marking a key as untracked; expand the curated dataset with the common seasoning/herb/spice set the user cooks with.
- Carry the `untracked` flag through `IngredientSearchResult` so frontend consumers know how to render and gate results.
- **Logging behavior**: `LogRecipe` produces no `LogEntry` for untracked ingredients. Ad-hoc logging from the log drawer (Search/Recent/Quick) does not allow logging an untracked ingredient — search results from FOODS show untracked rows but disable the "log" affordance, with an inline hint explaining why.
- **AI recipe import**: extracted ingredients matched against an untracked FOODS entry inherit `untracked: true`. Unmatched ingredients are never auto-flagged untracked — the user marks them in the review UI if needed.
- **Recipe UI (manual authoring)**: when the user picks a FOODS entry that is untracked, the new ingredient row arrives with `untracked: true` already set. Every ingredient row in the manual recipe form (`recipe-ingredient-editor`) renders an explicit toggle so the user can override the inherited value — e.g. mark an OFF-sourced or otherwise tracked row as untracked, or clear the flag on a FOODS-untracked row. Untracked rows render with a clear visual treatment (badge or muted styling) in both the form and read mode, so the user can tell at a glance which items don't count toward macros. The same applies to the AI-import review screen.
- **No change** to: daily log totals math (zero contribution falls out naturally once `LogRecipe` skips them), macros math anywhere, the `LogEntry` shape, the grocery list (does not exist yet — see Impact).

No breaking changes to persisted data: existing recipes load with `untracked` absent (treated as `false`); existing FOODS entries load the same way.

## Capabilities

### New Capabilities

_None._ This change extends existing capabilities rather than introducing a new one.

### Modified Capabilities

- `recipes`: the `RecipeIngredient` shape gains an optional `untracked` flag; recipe form and read views render untracked rows distinctly; the form lets the user toggle the flag.
- `curated-foods-source`: the `FoodEntry` shape gains an optional `untracked` flag; the seed-key list format is extended to express it; the curated dataset grows to include common seasonings/herbs/spices marked as untracked; search results carry the flag through.
- `ai-recipe-import`: matched draft ingredients inherit `untracked` from their FOODS match; the review UI surfaces and lets the user toggle the flag.
- `log-recipe`: `LogRecipe` skips untracked recipe ingredients — they produce no `LogEntry` rows.

## Impact

**Code**

- `backend/src/domain/recipes/types.ts` — `RecipeIngredient` adds `untracked?: boolean`; recipe validation accepts it.
- `backend/src/domain/foods/types.ts` — `FoodEntry` adds `untracked?: boolean`.
- `backend/src/domain/foods/map-food-entry.ts` and `backend/src/domain/ingredient-search/types.ts` — `IngredientSearchResult` carries `untracked?: boolean`.
- `backend/src/domain/meal-log/log-recipe.use-case.ts` — filters out untracked ingredients before producing `LogEntry` rows.
- `backend/src/domain/ai-recipe-import/*` — matched draft ingredients adopt `untracked` from their FOODS match.
- `backend/scripts/foods-seed-keys.ts` and `backend/scripts/build-foods-data.ts` — seed key list shape gains an optional `untracked` marker; the AI prompt is told to set `untracked: true` and zero `macrosPer100` for those keys; build-time validation enforces it.
- `backend/data/foods.json` — regenerated with the expanded seasoning/herb/spice set.
- `frontend/src/features/recipes/*` — recipe form and read view render untracked rows with a distinct treatment and let the user toggle the flag.
- `frontend/src/features/log-ingredient/*` — ad-hoc logging of untracked search results is disabled with an inline hint.
- `frontend/src/features/ai-recipe-import/*` — review UI surfaces the `untracked` flag and lets the user toggle it.

**APIs**

- `POST /add-recipe`, `PATCH /recipe/:id`, `GET /recipes`, `GET /recipes/:id`: request and response shapes accept and return `untracked` on each ingredient. Backwards compatible — field is optional.
- `GET /search-ingredients` / FOODS results: response shape carries `untracked` per result.
- `POST /import-recipe-from-photos`: draft ingredient rows carry `untracked` when matched against an untracked FOODS entry.
- `POST /log-recipe`: produces fewer `LogEntry` rows when the source recipe has untracked ingredients (only the tracked ones produce entries). Behavior is otherwise unchanged.

**Data**

- Persisted recipes (JSON file) — additive field on each ingredient. Existing recipes load unchanged.
- `backend/data/foods.json` — additive field plus new entries for seasonings/herbs/spices.

**Future grocery list**

The grocery list capability does not yet exist and is not built here. The design intentionally keeps untracked ingredients first-class on the recipe so the future grocery list will pick them up alongside tracked ingredients without further data-model changes.

**No impact on**: `LogEntry` shape, daily log totals math, `recently-used-ingredients`, `bottom-navigation`, `single-user-auth`, `container-deployment`, `ingredient-search-source-toggle`.
