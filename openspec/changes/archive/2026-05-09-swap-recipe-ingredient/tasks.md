## 1. i18n strings

- [x] 1.1 Add German strings to `frontend/src/i18n/de.ts`:
   - `recipeIngredientPicker.titleReplace: 'Zutat ersetzen'`
   - `recipeIngredientEditor.replaceAria: (name: string) => 'Zutat „${name}“ ersetzen'`

## 2. Picker — replace mode

- [x] 2.1 Add an optional `mode?: 'add' | 'replace'` prop (default `'add'`) to `RecipeIngredientPicker`. The component's `onPicked` signature stays the same.
- [x] 2.2 In `'replace'` mode, render the dialog title using `de.recipeIngredientPicker.titleReplace` instead of `titlePick`.
- [x] 2.3 In `'replace'` mode, when the user picks a search result, skip the AmountStep entirely. Added a separate `onPickResult?: (result: IngredientSearchResult) => void` callback (chosen for type honesty over a placeholder amount); the parent builds the next `RecipeIngredient` using its own row state.
- [x] 2.4 Existing `'add'` mode still works (verified by all pre-existing tests still passing).

## 3. Editor — replace state and row mutation

- [x] 3.1 Added `replacingIndex: number | null` local state to `RecipeIngredientEditor`.
- [x] 3.2 The ingredient name is rendered as a button-styled tap target with a `↻` glyph; 40px tall on mobile (h-10), 36px on `sm+`.
- [x] 3.3 Tapping sets `replacingIndex = idx` and opens the picker via `isPickerOpen = pickerOpen || replacingIndex !== null`.
- [x] 3.4 The picker receives `mode={pickerMode}` (`'replace'` when `replacingIndex !== null`) and an `onPickResult` handler.
- [x] 3.5 `handleReplace(index, result)` mutates the row in place per the rules (keep amount; replace name/unit/macros; keep pieceQuantity iff new unit is g/ml; set untracked iff result.untracked is true).
- [x] 3.6 `handleReplace` clears the estimate marker via `onEstimateAcknowledged?.(index)` whenever the index was in `estimateIndices`, regardless of pieceQuantity outcome.
- [x] 3.7 `closePicker()` resets both `pickerOpen` and `replacingIndex` to fresh state — dismissing without picking leaves rows untouched.

## 4. Editor — accessibility & visual

- [x] 4.1 The name button's `aria-label` is `de.recipeIngredientEditor.replaceAria(ing.name)`.
- [x] 4.2 Used `↻` (replace glyph) at `text-xs` aligned to the text baseline.
- [x] 4.3 Name button: `hover:bg-muted/40 active:bg-muted/60 focus-visible:ring-2`; glyph in `text-muted-foreground/50` so it doesn't dominate.
- [x] 4.4 Untracked rows already get `text-muted-foreground` on the row `<li>`, so the name button and glyph inherit the muted styling — verified visually in the previous mobile pass.

## 5. Tests — RTL: editor

- [x] 5.1 Picker opens with the replace title when a row name is tapped.
- [x] 5.2 Replace tracked → tracked: `name`/`unit`/`macrosPerUnit` replaced, `amount` kept, no `untracked`.
- [x] 5.3 Replace tracked → FOODS-untracked: `untracked: true` inherited.
- [x] 5.4 Replace untracked → tracked: `untracked` cleared.
- [x] 5.5 Replace preserves `pieceQuantity` when new unit is mass (g/ml).
- [x] 5.6 Replace drops `pieceQuantity` when new unit is non-mass (tbsp).
- [x] 5.7 Cancel-the-picker leaves the row unchanged.
- [x] 5.8 Replacing one row does not affect any other row.
- [x] 5.9 Replace skips the picker's amount-confirmation step (no amount input shown after picking).

## 6. Tests — RTL: AI-import review

- [x] 6.1 Swapping a matched row in the AI review keeps the AI-extracted amount, replaces the rest.
- [x] 6.2 An AI-estimated `gramsPerPiece` row no longer shows the estimate badge after a swap.
- [x] 6.3 Saving the recipe after a swap sends the swapped row in the `add-recipe` payload (verified via MSW capture).

## 7. Smoke test in Chrome

- [x] 7.1 Smoke-tested in Chrome at iPhone-12 viewport (390×844). Verified end-to-end:
   - Edit-mode of the existing "Hähnchen mit Salz" recipe rendered with `↻` glyph next to each ingredient name on mobile.
   - Tapped Hähnchenbrust → picker opened with title **"Zutat ersetzen"** (replace title, not the add title).
   - Searched "lachs", picked Lachsfilet/FOODS → row updated to `Lachsfilet · 200 g` immediately, no amount step shown, edit mode preserved.
   - Saved → recipe-detail (read mode) shows `Salz · 5 g` (untracked badge intact) and `Lachsfilet · 200 g`.
   - `recipes.json` shows the persisted ingredients with the swap (Lachsfilet replacing Hähnchenbrust at amount 200, unit g, untracked null).
- [x] 7.2 Follow-up notes:
   - **Pre-existing nested-form bug — second wave**: clicking a `<button>` (default `type=submit`) inside `SearchPanel`/`RecentPanel` result rows or the picker's tab buttons submits the parent recipe `<form>` (the same kind of form-in-form HTML invalidity fixed for `AmountStep` previously). First swap attempt silently saved the *pre-swap* recipe and exited edit mode. Fix applied: explicit `type="button"` on every result-row button, recent-panel button, and picker tab button. Worth a global audit of `<button>` elements without explicit type elsewhere in the codebase as future hardening.
   - **Glyph discoverability**: `↻` next to each name reads cleanly on mobile and provides a clear visual hint that the area is tappable. No further onboarding needed for now.
   - **Recipe-name awareness**: the recipe's own `name` ("Hähnchen mit Salz") is unaffected by an ingredient swap, which is correct (the user can rename it separately if needed).
