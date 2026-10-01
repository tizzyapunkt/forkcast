## 1. Backend: persist ingredient names trimmed

- [ ] 1.1 Write failing tests in `add-recipe.use-case.test.ts` and `update-recipe.use-case.test.ts`: a name like `"  Skyr  "` is persisted as `"Skyr"`, a renamed row keeps its macros/amount, and a whitespace-only name still fails validation. Extend `normalizeIngredient` to trim `name` until green
- [ ] 1.2 Run the backend lint/typecheck/test loop from the `forkcast-dev` skill and verify it is clean

## 2. Frontend: rename action in the recipe ingredient editor

- [ ] 2.1 Add German copy to `i18n/de.ts` (`recipeIngredientEditor`: rename aria label per ingredient, name input aria label) and verify typecheck
- [ ] 2.2 Write failing tests in `recipe-ingredient-editor.test.tsx` for every "Rename an ingredient row in the recipe editor" scenario: rename keeps all other fields (incl. note, `pieceQuantity`, `untracked` + `displayQuantity`); Enter and blur commit the trimmed value; Escape cancels; empty restores; Enter doesn't submit an enclosing form; tapping the name still opens replace mode; an open note survives a rename
- [ ] 2.3 Implement the rename affordance (Pencil icon button next to the name, `renamingIndex` state, borderless inline input in place of the name button) in `recipe-ingredient-editor.tsx` until 2.2 is green
- [ ] 2.4 Add tests in `recipe-form.test.tsx` showing that a renamed row is sent in the update-recipe payload (MSW), and in the AI-import review that rename is offered and the raw-read line is unchanged; verify green

## 3. Frontend: name field in the picker's amount step for OFF/SCAN

- [ ] 3.1 Add German copy (`recipeIngredientPicker`: "Name im Rezept" label) and verify typecheck
- [ ] 3.2 Write failing tests in `recipe-ingredient-picker.test.tsx`: an OFF result shows the pre-filled name field and a shortened name ends up on the picked row; an untouched or cleared field keeps the result's name; a SCAN result shows the field; a CATALOG result doesn't; replace mode still skips the amount step
- [ ] 3.3 Extend `AmountStep` with the optional name field (only for `source` `OFF`/`SCAN`, keeping Enter-to-submit on both inputs) and apply the trimmed name in `onSubmit` until 3.2 is green

## 4. Integration check

- [ ] 4.1 Run the full frontend + backend verify loop (`forkcast-dev` skill: lint, format check, typecheck, tests) and confirm everything is green
- [ ] 4.2 In the running app, add an OFF product to a recipe with a shortened name, rename another row via the pencil, save, reopen the recipe and log it; verify the clean names show in the recipe, the daily log and "Zuletzt verwendet"
- [ ] 4.3 Run `openspec validate rename-recipe-ingredient` from the repo root and verify it passes
