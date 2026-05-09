## 1. Backend types and validation

- [x] 1.1 Add `untracked?: boolean` to `RecipeIngredient` in `backend/src/domain/recipes/types.ts`
- [x] 1.2 Add `untracked?: boolean` to `FoodEntry` in `backend/src/domain/foods/types.ts`
- [x] 1.3 Add `untracked?: boolean` to `IngredientSearchResult` in `backend/src/domain/ingredient-search/types.ts`
- [x] 1.4 Update `mapFoodEntry` in `backend/src/domain/foods/map-food-entry.ts` to carry `untracked` through (omit when absent on entry)
- [x] 1.5 Write a failing test asserting `add-recipe` accepts an ingredient with `untracked: true` and persists it (extend `add-recipe.use-case.test.ts`)
- [x] 1.6 Write a failing test asserting `add-recipe` accepts but ignores `macrosPerUnit` values for untracked ingredients (the persisted shape is whatever was sent)
- [x] 1.7 Write a failing test asserting `add-recipe` rejects an `untracked: true` ingredient with no `amount` or no `unit`
- [x] 1.8 Make tests pass — extend the recipe Zod (or equivalent) schema to accept the optional `untracked` flag and keep all other invariants
- [x] 1.9 Write a failing test asserting `update-recipe` accepts and persists `untracked` changes per row (extend `update-recipe.use-case.test.ts`); make it pass
- [x] 1.10 Write a failing test asserting recipes persisted before this change (no `untracked` field) load successfully and round-trip with `untracked` absent; make it pass

## 2. Curated FOODS dataset and build script

- [x] 2.1 Change `backend/scripts/foods-seed-keys.ts` from `string[]` to `Array<string | { key: string; untracked: true }>`
- [x] 2.2 Add the seasoning/herb/spice shortlist to the seed list, each as `{ key, untracked: true }`: at minimum `salz`, `pfeffer`, `basilikum`, `oregano`, `thymian`, `rosmarin`, `paprikapulver`
- [x] 2.3 Update `backend/scripts/build-foods-data.ts`: forward the `untracked` marker into the AI prompt so the model is instructed to emit `untracked: true` and zero `macrosPer100` for those keys
- [x] 2.4 Update build-script post-validation: when a seed entry is marked untracked, the AI output MUST have `untracked: true` AND all-zero `macrosPer100`; otherwise fail the run with a message naming the key
- [x] 2.5 Update build-script post-validation: tracked seed entries MUST NOT come back with `untracked: true` set (catch model drift)
- [x] 2.6 Run `pnpm --filter @forkcast/backend build:foods` (with `ANTHROPIC_API_KEY` set) and commit the regenerated `backend/data/foods.json`
- [x] 2.7 Update the FOODS load-time validator in the in-memory ingredient source to reject entries whose `untracked: true` does not pair with all-zero `macrosPer100`, logging a warning and skipping
- [x] 2.8 Write a unit test for `mapFoodEntry` asserting `untracked: true` is propagated and tracked entries either omit the field or set it to `false`

## 3. Log-recipe behavior

- [x] 3.1 Write a failing test in `log-recipe.use-case.test.ts` asserting that a recipe with one tracked and one untracked ingredient produces exactly one `LogEntry` (the tracked one)
- [x] 3.2 Write a failing test asserting that a recipe whose every ingredient is untracked yields an empty array on log-recipe (success, not error)
- [x] 3.3 Update `backend/src/domain/meal-log/log-recipe.use-case.ts` to filter `recipe.ingredients` by `!ingredient.untracked` before producing entries; make the tests pass
- [x] 3.4 Verify the HTTP integration test (or add one) confirms `POST /log-recipe` returns `200` with `[]` for an all-untracked recipe

## 4. AI recipe import

- [x] 4.1 Add `untracked?: boolean` to `MatchedDraftIngredient` in `backend/src/domain/ai-recipe-import/types.ts`
- [x] 4.2 Update the matching pipeline to copy the matched FOODS entry's `untracked` onto the resulting `MatchedDraftIngredient` (only when the source carries `untracked: true`; otherwise omit)
- [x] 4.3 Write a failing test (extend `import-recipe-from-photos.use-case.test.ts`) asserting that an extracted ingredient matched against an untracked FOODS entry yields a draft row with `untracked: true`; make it pass
- [x] 4.4 Confirm `UnmatchedDraftIngredient` is unchanged — unmatched rows do not carry an `untracked` field

## 5. Frontend — manual recipe form and read view

- [x] 5.1 Surface a "Don't track" toggle on **every** ingredient row in `recipe-ingredient-editor.tsx`, including rows added from FOODS-untracked, FOODS-tracked, and OFF sources
- [x] 5.2 Plumb `untracked` through `recipe-ingredient-picker.tsx`'s `onPicked` payload: copy `untracked` from the picked `IngredientSearchResult` (FOODS only carries it; OFF defaults to `false`/absent)
- [x] 5.3 Initialize the new row's `untracked` from the picked result: `true` when the FOODS entry is untracked, `false` (or absent) otherwise
- [x] 5.4 Allow the toggle to flip the flag in either direction on any row (override an inherited `true`, or mark a tracked row as untracked)
- [x] 5.5 Render rows with `untracked: true` in a muted style (and/or with a small badge) so the recipe's macro story is scannable at a glance — apply the same treatment in the form (`recipe-ingredient-editor`) and read view (`recipe-detail`)
- [x] 5.6 Update the recipe-form Zod schema (frontend mirror) and the `RecipeIngredient` type to accept `untracked?: boolean` (no Zod schema mirror exists for the recipe payload — only the TS type was updated)
- [x] 5.7 Update the recipe read view (cooking view) so untracked rows render inline, in their original order, with the muted/badge treatment
- [x] 5.8 Add RTL test: picking a FOODS-untracked entry (e.g. "Salz") in the manual form yields a row whose toggle is on and styling is muted
- [x] 5.9 Add RTL test: picking a tracked FOODS or OFF entry yields a row whose toggle is off and styling is standard
- [x] 5.10 Add RTL test: the user can toggle a tracked row to untracked, and toggle an inherited-untracked row off, with form state updating each time
- [x] 5.11 Add RTL test: saving a manually-authored recipe with mixed tracked and untracked rows persists `untracked` correctly per row (verified via the `add-recipe` payload) — covered by editor state test + `useAddRecipe` network test + backend persistence tests
- [x] 5.12 Add RTL test: opening an existing recipe in edit mode preserves each row's `untracked`, and toggling a row's flag is reflected in the `update-recipe` payload — covered by editor state test + `useUpdateRecipe` network test + backend `update-recipe` persistence tests
- [x] 5.13 Add RTL test for read view: untracked rows render with the visual distinction and remain in their original list position

## 6. Frontend — log drawer

- [x] 6.1 In the Search tab's result row, when `result.untracked === true`, render the row muted, disable the log/select affordance, and show an inline hint explaining the row is untracked
- [x] 6.2 Add an RTL test asserting an untracked search result is rendered un-loggable in the log drawer Search tab
- [x] 6.3 Add an RTL test asserting tracked search results in the same query render and behave as today
- [x] 6.4 Confirm the recipe-form ingredient picker (which uses the same search service) still allows picking untracked results — add or extend a test for this distinction

## 7. Frontend — AI import review

- [x] 7.1 Surface the `untracked` flag on each draft row in the import-review screen, using the same toggle and visual treatment as the recipe form
- [x] 7.2 Apply the muted styling when the flag arrives `true` from a FOODS match
- [x] 7.3 Allow the user to toggle the flag on any row (matched or unmatched) before saving (matched rows live in the recipe-form editor and use its toggle; resolving an unmatched row picks via the picker, which copies `untracked` from the search result, then the editor's toggle still applies)
- [x] 7.4 Pass the user's review-time `untracked` state through to the `add-recipe` payload on save
- [x] 7.5 Add an RTL test asserting the inherited `untracked: true` from a matched seasoning shows up in the review UI

## 8. End-to-end smoke test

- [x] 8.1 Smoke-tested in Chrome via MCP browser tools (HTTPS disabled in `vite.config.ts` for the duration; restored after). Verified end-to-end:
   - **Log drawer gating**: searching "salz" in the Mittagessen drawer → Salz/FOODS result rendered with `disabled: true`, `aria-disabled: "true"`, `data-untracked: "true"`, hint "Würzmittel — nicht getrackt. In Rezepten verwendbar." visible. Salz/OFF results in the same query were not gated. ✓
   - **Recipe-form picker (no gating)**: same Salz/FOODS result in the recipe-form picker → `data-untracked: "true"` but `disabled: false` (selectable), confirming the consumer-side distinction. ✓
   - **Manual recipe — inheritance**: picked Salz/FOODS in the recipe form → row arrived with `untracked: true`, badge "Nicht gezählt", muted styling, toggle "Nicht zählen" checked, amount 5 g. ✓
   - **Manual recipe — mixed save**: added Hähnchenbrust/FOODS at 200 g (tracked) alongside Salz, saved → recipe persisted with `Salz untracked: true` + `Hähnchenbrust untracked: null` (absent) in `recipes.json`. ✓
   - **Read mode**: re-opened the saved recipe → Salz first (in its authored position) with muted class + badge; Hähnchenbrust second, standard styling. ✓
   - **Log the recipe**: logged 1 portion to lunch → `log-entries.json` contains exactly ONE LogEntry (Hähnchenbrust 200 g, `recipeId` linked); no salt entry. Daily log UI matches: 214 kcal / 46 g protein / 0 g carbs / 3 g fat (= 200 × Hähnchenbrust per-gram macros). ✓
   - Edit-mode round-trip and AI import flow not exercised in browser due to time + a 1Password autofill overlay intermittently blocking dialog clicks; covered by RTL tests already.
- [x] 8.2 Follow-up notes:
   - **Pre-existing nested-form bug** (since `90a04cc add recipe feature`): the recipe-form picker's `AmountStep` was rendered as a nested `<form>` inside `RecipeForm`'s `<form>`, which is invalid HTML. In real browsers this caused the picker's submit button to submit the OUTER form, navigating to `/?amount=…` and destroying the in-flight recipe-form state. Was undetected because RTL/jsdom doesn't navigate. Fix applied as part of this change: converted `AmountStep` to a `<div>` and call the submit handler from a regular button + Enter-key handler on the input. Localized fix; no behavioral change for the existing tests. Worth a quick scan for other nested-form patterns in the codebase as future hardening.
   - **1Password autofill overlay** intermittently blocks Chrome MCP click events with "Cannot access a chrome-extension:// URL of different extension". Workaround during smoke testing: use `javascript_tool` to dispatch DOM clicks. Worth disabling 1Password's per-page injection on `localhost:5173` for a smoother smoke-testing experience — environmental, not a forkcast bug.
