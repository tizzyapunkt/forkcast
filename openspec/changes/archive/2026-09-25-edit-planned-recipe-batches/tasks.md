## 1. Backend domain

- [x] 1.1 Write failing tests for `replaceBatchIngredient` in `backend/src/domain/meal-log/replace-batch-ingredient.use-case.test.ts`: swaps name/unit/macros/amount; keeps `id`, `date`, `slot`, `recipeId`, `recipeBatchId`, `recipePortions`; refreshes `loggedAt`; other batch entries unchanged; unknown id → not-found; entry without `recipeBatchId`, non-full ingredient, or `amount <= 0` → validation error with the entry unchanged
- [x] 1.2 Implement `replace-batch-ingredient.use-case.ts` on the existing `LogEntryRepository` (`findById` + `update`) until 1.1 passes
- [x] 1.3 Write failing tests for `addToRecipeBatch` in `add-to-recipe-batch.use-case.test.ts`: new entry takes `slot`/`recipeId`/`recipeBatchId`/`recipePortions` from the batch on `date` with fresh `id`/`loggedAt`; existing entries unchanged; same batch id on another date (copied day) is not touched and gets no entry; no batch on `date` → not-found; non-full ingredient or `amount <= 0` → validation error with nothing created
- [x] 1.4 Implement `add-to-recipe-batch.use-case.ts` (`findByDate` filtered by `recipeBatchId`, then `save`) until 1.3 passes
- [x] 1.5 Extend `copy-log-day.use-case.test.ts` with failing tests: clones of one source batch share one fresh `recipeBatchId` different from the source's, two source batches get two distinct fresh ids, `recipeId`/`recipePortions` preserved, ad-hoc clones carry no batch id; implement in `copy-log-day.use-case.ts` until they pass
- [x] 1.6 Extend `remove-recipe-log.use-case.test.ts` with failing tests: requires `date`; removes only that date's entries of the batch when the same id exists on another date; unknown batch on `date` → not-found; implement via `findByDate` in `remove-recipe-log.use-case.ts` until they pass
- [x] 1.7 Add a test that `listRecentlyUsedIngredients` returns the replacement food first after a replace, and confirm it passes without changing that use case

## 2. Backend HTTP

- [x] 2.1 Write failing handler tests for `POST /replace-batch-ingredient` (`200` with the updated entry, `404` unknown entry, `400` for malformed body / ad-hoc entry / non-positive amount) in `backend/src/http/meal-log/`
- [x] 2.2 Write failing handler tests for `POST /add-to-recipe-batch` (`200`/`201` with the created entry, `404` unknown batch on date, `400` for malformed body / non-positive amount)
- [x] 2.3 Extend `remove-recipe-log.handler.test.ts`: body without `date` → `400`; with `date` removes only that date's batch entries; update the handler to pass `date` until it passes
- [x] 2.4 Implement both new handlers, mapping not-found and validation errors like `remove-recipe-log.handler.ts`, until 2.1 and 2.2 pass
- [x] 2.5 Register both routes in `backend/src/index.ts` next to `/log-recipe` and `/remove-recipe-log`, below the auth middleware; verify an unauthenticated call returns `401`
- [x] 2.6 Smoke-test against a running backend: log a recipe, replace one entry, add one entry, then `GET /daily-log/{date}` shows both in the batch and `POST /remove-recipe-log` removes all of them; copy that day before removing and confirm the copy survives

## 3. Frontend data layer

- [x] 3.1 Add `frontend/src/api/` functions `replaceBatchIngredient` and `addToRecipeBatch`, plus MSW handlers for both endpoints in `frontend/src/test/msw/handlers.ts`
- [x] 3.2 Send `date` from `frontend/src/api/remove-recipe-log.ts` (the `useRemoveRecipeLog` input already carries it); update the MSW handler and verify the existing batch-remove tests pass
- [x] 3.3 Add `queries/use-replace-batch-ingredient.ts` and `queries/use-add-to-recipe-batch.ts` invalidating `dailyLog(date)`, `weekLogAll()`, `recentlyUsedIngredients()`, `favoriteIngredients()`; cover each with a hook test asserting the daily log refetches after success
- [x] 3.4 Add German copy to `frontend/src/i18n/de.ts`: replace/add aria labels, sheet titles "Zutat ersetzen — {recipe}" / "Zutat hinzufügen — {recipe}"; verify typecheck passes

## 4. Batch-targeted add-food sheet

- [x] 4.1 Write failing tests for `FullEntryConfirm` with an `onSubmitIngredient` override: confirming calls the override with the full ingredient and does not call `/log-ingredient`; without the override behavior is unchanged (existing tests stay green)
- [x] 4.2 Implement the optional `onSubmitIngredient` prop until 4.1 passes
- [x] 4.3 Write failing tests for `LogIngredientDrawer` with a `target`: only Search, Favoriten and Zuletzt tabs shown; title names action + recipe; untracked search results stay disabled; replace confirm hits `/replace-batch-ingredient`; add confirm hits `/add-to-recipe-batch`; replace pre-fills the amount for a same-unit pick and not for a different-unit pick; closing without confirming sends nothing
- [x] 4.4 Implement the `target` prop in `log-ingredient-drawer.tsx` until 4.3 passes, with existing drawer tests still green

## 5. Affordances in the shared entry list

- [x] 5.1 Write failing `EntryList` tests: rows inside a batch show "Zutat „{name}“ ersetzen", ad-hoc and legacy rows do not; the banner shows "Zutat zu „{recipe}“ hinzufügen"; activating either opens the sheet in the matching mode; after a replace/add the row renders inside the batch group
- [x] 5.2 Implement: optional `onReplace` on `EntryRow` (icon button, `iconSm`), add button on the `BatchGroup` banner, `BatchGroup` owning the drawer `target` state, until 5.1 passes
- [x] 5.3 Add a planner-screen test that a batch in an expanded day exposes both affordances and a replace updates the day's totals, confirming planner parity via the shared list

## 6. Verification

- [x] 6.1 Run backend and frontend test, lint, typecheck and format per the forkcast-dev skill; all green
- [x] 6.2 Smoke-test in Chrome at 375 px width: in the diary and in the planner, replace an ingredient and add one to a batch; both stay in the group, totals update, the other view shows the same, and the row's three controls fit without wrapping. In the planner, copy a day with a batch, remove the batch on the copy, and confirm the source day keeps it
