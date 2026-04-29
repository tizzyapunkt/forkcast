## 1. Backend — recipes domain (TDD)

- [x] 1.1 Add `Recipe`, `RecipeIngredient` types to `backend/src/domain/recipes/types.ts` (reuse `MeasurementUnit`, `MacrosPer100` shapes; do NOT import from `meal-log` — duplicate the value-object types into the recipes context to keep it independent)
- [x] 1.2 Add `RecipeRepository` port at `backend/src/domain/recipes/recipe.repository.ts` (`save`, `findAll`, `findById`, `update`, `remove`)
- [x] 1.3 Write failing tests + implement `addRecipe` use case (validation: non-empty name, yield ≥ 1, ≥ 1 ingredient; sets `id`, `createdAt`, `updatedAt`)
- [x] 1.4 Write failing tests + implement `listRecipes` use case (sorted A→Z by name, case-insensitive)
- [x] 1.5 Write failing tests + implement `getRecipe` use case
- [x] 1.6 Write failing tests + implement `updateRecipe` use case (partial updates; same per-field validation; advances `updatedAt`)
- [x] 1.7 Write failing tests + implement `deleteRecipe` use case (no cascade)

## 2. Backend — recipes infrastructure & HTTP

- [x] 2.1 Implement `JsonRecipeRepository` at `backend/src/infrastructure/recipes/json-recipe.repository.ts` (mirror `JsonLogEntryRepository`)
- [x] 2.2 Register `JsonRecipeRepository` in `bootstrap.ts` so `./data/recipes.json` is initialized
- [x] 2.3 Write failing tests + implement HTTP handlers under `backend/src/http/recipes/`: add (`POST /add-recipe`), list (`GET /recipes`), get (`GET /recipes/:id`), update (`PATCH /recipe/:id`), delete (`DELETE /recipe/:id`)
- [x] 2.4 Wire the five recipes routes in `backend/src/index.ts`

## 3. Backend — meal-log: recipeId field

- [x] 3.1 Add optional `recipeId?: string` to `LogEntry` in `backend/src/domain/meal-log/types.ts`
- [x] 3.2 Update `JsonLogEntryRepository` so loads tolerate entries without `recipeId` and roundtrip them unchanged (write a regression test loading a fixture without the field)
- [x] 3.3 Confirm existing meal-log handlers and use cases pass `recipeId` through unchanged on edit/remove (no functional change, but write a test asserting `recipeId` survives `PATCH /log-entry/:id`)

## 4. Backend — log-recipe use case + HTTP

- [x] 4.1 Write failing tests for `logRecipe(recipeRepo, logEntryRepo, command)` covering: integer yield + integer portions, non-integer portions, missing recipe, non-positive portions, atomic write
- [x] 4.2 Implement `logRecipe` in `backend/src/domain/meal-log/log-recipe.use-case.ts` — loads the recipe, scales each ingredient `amount = a * (portions / yield)`, copies `name`/`unit`/`macrosPerUnit` verbatim, attaches `recipeId`, persists all rows in a single repository operation (add `saveMany` to `LogEntryRepository` if needed for atomicity)
- [x] 4.3 Write failing tests + implement HTTP handler `POST /log-recipe` (`backend/src/http/meal-log/log-recipe.handler.ts`) — `400` on validation, `404` on missing recipe, `200` with `LogEntry[]` on success
- [x] 4.4 Wire `POST /log-recipe` in `backend/src/index.ts`

## 5. Frontend — recipes domain types & API client

- [x] 5.1 Add `frontend/src/domain/recipes.ts` with `Recipe` and `RecipeIngredient` types (mirror backend; reuse `MeasurementUnit` / `MacrosPer100` from `domain/meal-log.ts` for now — they're literal-shape duplicates and fine to share at the FE layer)
- [x] 5.2 Add `frontend/src/domain/recipes.ts` `recipeId` field to `LogEntry`
- [x] 5.3 Extend `frontend/src/api/` with `addRecipe`, `listRecipes`, `getRecipe`, `updateRecipe`, `deleteRecipe`, `logRecipe` client functions

## 6. Frontend — React Query hooks

- [x] 6.1 `useRecipes()` in `frontend/src/queries/use-recipes.ts` (list; cache key `['recipes']`)
- [x] 6.2 `useRecipe(id)` in `frontend/src/queries/use-recipe.ts`
- [x] 6.3 `useAddRecipe()`, `useUpdateRecipe()`, `useDeleteRecipe()` mutations with cache invalidation of `['recipes']` and `['recipe', id]`
- [x] 6.4 `useLogRecipe()` mutation with cache invalidation of `['daily-log', date]`
- [x] 6.5 Tests for each hook following the existing `use-*.test.tsx` pattern

## 7. Frontend — Recipes screen

- [x] 7.1 Failing tests + implement `RecipesScreen` (`frontend/src/features/recipes/recipes-screen.tsx`): list, alphabetic, "New recipe" button, empty state
- [x] 7.2 Failing tests + implement `RecipeForm` (`recipe-form.tsx`): name, yield (number stepper), ingredient list (reuses `useSearchIngredients` and the inline-amount-input pattern), step list (free-text rows, add/remove/reorder), validation
- [x] 7.3 Failing tests + implement `RecipeDetail` (`recipe-detail.tsx`): read view (cooking instructions), Edit button → form, Delete button with confirm
- [x] 7.4 Failing tests + implement `RecipeIngredientEditor` (`recipe-ingredient-editor.tsx`): ingredient row with name + unit + amount + macros, deletion, plus an "add ingredient" affordance that opens the existing search/recent flows scoped to the recipe form

## 8. Frontend — Recipes tab in the log drawer

- [x] 8.1 Failing tests + implement `RecipePanel` (`frontend/src/features/log-ingredient/recipe-panel.tsx`): list of recipes (reuses `useRecipes`), client-side name filter, empty state pointing to the Recipes screen, `onSelect(recipe)` callback
- [x] 8.2 Failing tests + implement `RecipeConfirm` (`recipe-confirm.tsx`): portions input (default 1, stepper, ≥ 0.0001), shows scaled ingredient preview + estimated total macros, Back + Log buttons
- [x] 8.3 Modify `LogIngredientDrawer` to include the Recipes tab (order: Search → Recent → Recipes → Quick), extend the step union with `'recipe-confirm'`, route Recipes-tab selection through `RecipeConfirm`, and call `useLogRecipe` on submit. Update existing drawer tests for the new tab order.

## 9. Frontend — recipe hint in the daily log

- [x] 9.1 Failing tests + modify `EntryRow` (`frontend/src/features/daily-log/entry-row.tsx`) to render a recipe-source visual hint when `entry.recipeId` resolves to a recipe in the cached `useRecipes` list. Hint disappears when the recipeId no longer resolves.
- [x] 9.2 Verify edit/remove flows on a recipe-sourced entry preserve `recipeId` (covered by an FE integration test simulating an amount edit and confirming the hint stays)

## 10. Frontend — bottom navigation

- [x] 10.1 Failing tests + implement `BottomNav` (`frontend/src/components/app/bottom-nav.tsx`): three tabs (Log, Recipes, Settings) with `lucide-react` icons, active-tab highlight, fixed-bottom layout, `aria-current` on the active tab
- [x] 10.2 Modify `App` (`frontend/src/app.tsx`) to extend `view` with `'recipes'`, render `<BottomNav>`, route `'recipes'` to `RecipesScreen`, remove the settings gear from the header, and add bottom padding to `main` so content clears the nav
- [x] 10.3 Update `app.test.tsx` for the new view set, the absence of the gear, and presence of the bottom nav
- [x] 10.4 Verify drawer + bottom nav interaction. Spec scenario refined: drawer overlay sits above the nav; user dismisses the drawer first, after which the nav is tappable. Test asserts the layered behavior.

## 11. Polish & verification

- [x] 11.1 Run full test suite (`pnpm -r test`) — backend + frontend green
- [x] 11.2 Run lint/format (`pnpm -r lint`, `pnpm -r format` or project equivalents) — clean
- [x] 11.3 Manual smoke in browser passed. Verified: bottom nav with 3 tabs, drawer tab order (Search→Recent→Recipes→Quick), portions-scaled batch logging (1 of 2 yield halved both ingredients correctly), "FROM OATS BOWL" hint on each row, edit-amount preserved the hint, recipe rename updated the hint live to "FROM OATS & SKYR BREAKFAST", recipe delete removed the hint while leaving the log entries intact.
- [x] 11.4 Update `CLAUDE.md` only if a *new* convention emerged. None did — implementation followed existing conventions; no edit required.
