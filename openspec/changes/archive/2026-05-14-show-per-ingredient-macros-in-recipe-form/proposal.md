## Why

When building or editing a recipe, the form already shows whole-recipe totals at the top (`RecipeTotalsStrip`) but each ingredient row only displays an amount input — no calories, no macros. To dial in a recipe against a macro target, users currently have to mentally back-compute each ingredient's contribution or rely on the totals strip changing. The data is already in hand (`macrosPerUnit * amount`), so surfacing it per row is a small, high-value addition. As with the meal log, values must update live as the user changes the amount, piece count, or grams-per-piece — no debounce, no save round-trip — because `RecipeIngredientEditor` is fully controlled by the parent form.

## What Changes

- Render per-ingredient calories and macros (`{kcal} kcal · {P}g P · {C}g K · {F}g F`, integer-rounded) on each tracked ingredient row in `RecipeIngredientEditor`.
- Values are computed from the row's current `amount` × `macrosPerUnit`. Because the editor is fully controlled, the display updates synchronously on every keystroke into the amount input, piece-count input, or grams-per-piece input.
- Hide the per-ingredient line entirely for untracked ingredients (`untracked === true`) — they don't contribute to nutrition rollups and would be misleading to display.
- No API, persistence, or domain model changes. No change to the existing `RecipeTotalsStrip`.

## Capabilities

### New Capabilities
- _(none)_

### Modified Capabilities
- `recipes`: extend with a requirement that the recipe form's per-ingredient row surfaces live calories+macros for tracked ingredients and suppresses them for untracked ones.

## Impact

- **Frontend (UI only):**
  - `frontend/src/features/recipes/recipe-ingredient-editor.tsx` — add a small macro line inside each ingredient `<li>` for tracked rows.
  - `frontend/src/i18n/de.ts` — reuse `de.dailyLog.macroInline` (already shipped) or, if needed, a recipe-scoped helper; prefer reuse.
  - Tests: extend `recipe-ingredient-editor.test.tsx` with TDD scenarios for tracked/untracked rows and for live updates as the user types amount/piece-count/grams-per-piece.
- **Backend / API / domain / persistence:** none.
