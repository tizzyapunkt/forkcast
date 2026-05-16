## Why

The previous change (`extend-foods-from-unmatched-imports`) tightened the extractor so the ingredient `name` field carries only the food noun — prep modifiers like "fein gehackt", "geschält", "in Scheiben" are pushed into recipe `steps`. That works when the source recipe repeats the prep in its step list, but plenty of recipes don't: the modifier sits inline on the ingredient line and nowhere else. Stripping it silently loses information, and the user notices only on save (or doesn't notice at all). We need a clean home for that prep info that doesn't pollute the matchable name.

## What Changes

- Add an optional `note?: string` field to the recipe ingredient row (`Recipe.ingredients[i].note`). Free-text, trimmed, non-empty when present, capped at a sane length (60 chars). Persisted by `add-recipe` / `update-recipe`. Absent on existing recipes — backward-compatible reads.
- Extend the AI extractor's `extract_recipe` tool schema to include an optional `note` field on each ingredient. Update the system prompt so the model puts the prep modifier in `note` instead of (or in addition to) `steps`. Leading qualifiers that change food identity (e.g. "Zuckerfreier Ahornsirup") stay on `name` as today.
- Thread `note` through the AI import pipeline: `RawIngredient` and both `MatchedDraftIngredient` / `UnmatchedDraftIngredient` variants gain `note?: string`. Matching does not touch the note — it rides along verbatim from extractor → draft → save.
- Render `note` as a subtitle on the ingredient row in the **recipe form** (both create and edit) and the **review-import screen**. Inline rendering: `<name> · <note>` on the primary line is rejected; `<note>` on a secondary line under the name keeps the layout consistent with the existing displayQuantity subtitle.
- Make `note` editable on the recipe form for existing recipes (a small text input on the row, alongside amount/unit).
- Do **not** surface `note` in the meal-log entry display, the grocery list, or anywhere downstream of the recipe — it's a recipe-authoring affordance, not a runtime concept.

## Capabilities

### New Capabilities
<!-- None — both touched capabilities already exist. -->

### Modified Capabilities
- `recipes`: add `note?: string` to the `RecipeIngredient` shape, persist it through `add-recipe` / `update-recipe`, accept it on backward-compatible reads.
- `ai-recipe-import`: add `note` to the extractor tool schema and the matching pipeline so prep modifiers survive from photo → draft → saved recipe.

## Impact

- Backend
  - `backend/src/domain/recipes/types.ts` — add `note?: string` to `RecipeIngredient`.
  - `backend/src/domain/recipes/validate-ingredient-shape.ts` — accept and validate the optional field (trim, non-empty when present, max length).
  - `backend/src/domain/recipes/add-recipe.use-case.ts` / `update-recipe.use-case.ts` — no behavioral change; the field flows through the existing validation path.
  - `backend/src/infrastructure/recipes/json-recipe.repository.ts` — no code change required; the field serializes via the type.
  - `backend/src/domain/ai-recipe-import/types.ts` — add `note?: string` to `RawIngredient`, `MatchedDraftIngredient`, `UnmatchedDraftIngredient`.
  - `backend/src/infrastructure/ai-recipe-import/extract-recipe-tool.ts` — add `note` to the ingredient sub-schema and tighten the instructions accordingly.
  - `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.ts` — pass `note` through `matchIngredient` to both matched and unmatched draft rows. `normalizeIngredientName` is unchanged (it operates on `name`).
- Frontend
  - `frontend/src/domain/recipes.ts` — mirror the type change.
  - `frontend/src/features/recipes/recipe-ingredient-editor.tsx` — render the note as a subtitle row and add an inline edit input.
  - `frontend/src/features/recipes/recipe-form.tsx` — thread `note` through the form state and the save payload.
  - `frontend/src/features/ai-recipe-import/review-import-screen.tsx` — render the note as a subtitle on each draft row; pass it into the save payload.
- Spec
  - `openspec/specs/recipes/spec.md` — extended via delta under `openspec/changes/add-ingredient-note/specs/recipes/spec.md`.
  - `openspec/specs/ai-recipe-import/spec.md` — extended via delta under `openspec/changes/add-ingredient-note/specs/ai-recipe-import/spec.md`.
- Data
  - No migration. Existing recipes simply lack `note` on their ingredient rows — the schema accepts that.
- No new dependencies, no new env vars, no new endpoints.
- Risk: an over-eager extractor could shovel non-prep info into `note` (e.g. brand names, supplier notes). Mitigated via tight prompt instructions and a max-length cap. Worst case the user edits or clears the note on review.
