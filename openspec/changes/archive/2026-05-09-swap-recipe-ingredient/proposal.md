## Why

When a recipe is imported from photos, the AI sometimes matches an extracted ingredient to the wrong catalog entry — e.g. the recipe says "sunflower oil" but the matcher picks "Olivenöl", or the recipe says "Hähnchenbrust" but the matcher picks "Gebratene Hähnchenbrust". Today, the only way for the user to fix this is to **delete the row and add it again from scratch** via the existing "Zutat hinzufügen" picker. The user has to remember the original amount, find the right catalog entry, and re-enter the amount — needless friction on what should be a one-tap correction.

The same friction applies to manual recipe authoring whenever the user picks the wrong row from search.

## What Changes

- Add a **"replace ingredient" action on every row** of the recipe ingredient editor (`recipe-ingredient-editor.tsx`). Tapping it opens the existing ingredient picker in a "replace" mode targeting that row.
- When the user picks a new ingredient:
  - **Keep**: the row's `amount` (numeric value).
  - **Replace**: `name`, `unit`, `macrosPerUnit`, and `untracked` (inherited from the new pick — `true` if the new pick is a FOODS-untracked entry, otherwise absent).
  - **`pieceQuantity` handling**: keep verbatim when the new pick's unit is `g` or `ml` (mass-tracked); drop entirely otherwise. Matches the existing AI-import matcher's piece-quantity rules.
  - **Estimate marker**: if the row had been flagged as an AI-estimated `gramsPerPiece` and the swap drops `pieceQuantity`, the estimate marker is cleared.
- The action is reachable from one tap on the row's ingredient name (the name becomes a button-styled tap target with a small "↻" or "ändern" affordance so it's discoverable). Mobile-first: ~44px tap height, no extra layout strip per row.
- Behavior applies in **both** surfaces that use the editor:
  - The recipe-form editor (manual authoring + AI-import review screen — same component).
  - This is intentional: building once at the editor level keeps manual and import flows symmetric.
- **No change** to: `add-recipe` / `update-recipe` payload shapes (the swap happens entirely in form state and produces an ordinary updated `RecipeIngredient`), the picker component, the recipe persistence model, the daily log, or any backend behavior.

No breaking changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `recipes`: the "Recipes UI — list and create" requirement gains a "replace ingredient via picker" behavior with the rules above. The "Recipes UI — edit and delete" requirement inherits the same behavior in edit mode (the form is shared).
- `ai-recipe-import`: the "Review UI shows piece quantity and weight together" / "Review UI surfaces and allows toggling the untracked flag" requirements gain a "replace ingredient via picker" behavior on every matched row in the review screen — the user does not need to delete-and-re-add to correct a mismatch.

## Impact

**Code**

- `frontend/src/features/recipes/recipe-ingredient-editor.tsx` — add a per-row "replace" action; manage a `replacingIndex` local state; wire the existing `RecipeIngredientPicker` so that picking with a non-null `replacingIndex` mutates the row in place rather than appending.
- `frontend/src/features/recipes/recipe-ingredient-picker.tsx` — small change so the dialog title reflects "replace" vs. "add" context (existing translation keys + one new key).
- `frontend/src/features/ai-recipe-import/review-import-screen.tsx` — no logic change required (the editor handles it). Verify the existing `estimateIndices` cleanup still works correctly when a swap drops `pieceQuantity` (clear the estimate marker for that index).
- `frontend/src/i18n/de.ts` — add a German label for the replace affordance and a "replace" picker title.

**APIs / persistence**

- None.

**Tests**

- New RTL coverage on `recipe-ingredient-editor`: replace picks update name/unit/macros/untracked and keep amount; piece-quantity dropped when new unit is non-mass; mixing replace with the existing ✕ remove still works.
- AI review test asserts that opening the picker via the replace action and choosing a different FOODS entry (including a tracked → untracked pick) updates the row correctly.

**No impact on**: backend code, backend tests, the curated FOODS dataset, the search service, or any other capability.
