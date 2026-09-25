## 1. Cooked portions (meal-log)

- [x] 1.1 Add optional `cookedPortions` to `LogEntry` in backend and frontend domain types; verify typecheck and that existing log-entry repository tests still roundtrip entries without it
- [x] 1.2 Write failing tests for `setCookedPortions` (`backend/src/domain/meal-log/set-cooked-portions.use-case.test.ts`): sets the value on every entry of the batch on `date` only; rejects values below `recipePortions`, non-positive or non-finite values; not-found for an unknown batch on `date`; implement until green
- [x] 1.3 Extend `add-to-recipe-batch.use-case.test.ts`: the new entry takes the batch's `cookedPortions`; update the use case until green
- [x] 1.4 Extend `copy-log-day.use-case.test.ts`: a copied batch keeps `cookedPortions`; verify green
- [x] 1.5 Add a `get-daily-log` test proving `cookedPortions` does not change any totals
- [x] 1.6 Add `POST /set-cooked-portions` handler with tests (`200`, `400`, `404`), register it below the auth middleware in `backend/src/index.ts`

## 2. Grocery list query (shopping)

- [x] 2.1 Create `backend/src/domain/shopping/types.ts` (`GroceryList`, `GroceryItem`, `PieceHint`) and verify typecheck
- [x] 2.2 Write failing tests for the pure contribution fold: case-insensitive merge, units kept apart, round-up, dates ascending and deduplicated, untracked only when all contributions are untracked, ordering tracked→untracked then alphabetical; implement until green
- [x] 2.3 Write failing tests for `buildGroceryList` against fakes of `LogEntryRepository`, `RecipeRepository` and the catalog fake covering every `grocery-list` spec scenario (ad-hoc, cooked scaling, default cooked, swapped/added entries, untracked tail once per batch, deleted recipe, piece hint with `mittel` and fallback to the first piece, quick entries skipped and counted, week bounds, empty week); implement until green
- [x] 2.4 Add `GET /grocery-list/:startDate` handler with tests (`200` shape, `400` malformed date) and register it in `backend/src/index.ts` below the auth middleware
- [x] 2.5 Smoke-test against a running backend: plan a week with a recipe cooked for 2, an ad-hoc entry and a quick entry; the endpoint returns the expected amounts, untracked items and skip count

## 3. Frontend data layer

- [x] 3.1 Add `api/grocery-list.ts`, `api/set-cooked-portions.ts`, MSW handlers, and `queryKeys.groceryList(startDate)`
- [x] 3.2 Add `queries/use-grocery-list.ts` (`staleTime: 0`) and `queries/use-set-cooked-portions.ts` invalidating `dailyLog(date)`, `weekLogAll()` and all grocery lists; hook test asserts the daily log refetches after setting
- [x] 3.3 Add German copy (`groceryList` block: title with week range, untracked heading, skipped note, empty state, Kopieren, copied confirmation; banner "für {n} gekocht", stepper labels) and verify typecheck

## 4. Cooked-portions control on the batch banner

- [x] 4.1 Write failing `EntryList` tests: banner shows "für N gekocht" only when cooked differs from logged; the stepper cannot go below logged portions; confirming sends `/set-cooked-portions` with the batch's date; implement in `entry-list.tsx` until green
- [x] 4.2 Add a planner-screen test that the control is available on a planner batch and the diary shows the same value (shared list)

## 5. Einkaufsliste sheet

- [x] 5.1 Write failing tests for `features/grocery-list/grocery-list-sheet.tsx`: loads the list for the given `startDate`; tracked then untracked section; amount, piece hint and weekday abbreviations per item; skipped note; empty state with Kopieren disabled; all items start checked; untick then Kopieren writes only checked lines in the specified format and shows the confirmation; clipboard failure shows an error; reopening resets ticks
- [x] 5.2 Implement the sheet until 5.1 passes
- [x] 5.3 Write a failing planner-screen test: the header's Einkaufsliste button opens the sheet for the week currently shown, including after navigating to the next week; wire it up until green

## 6. Verification

- [x] 6.1 Run backend and frontend test, lint, typecheck and format per the forkcast-dev skill; all green
- [x] 6.2 Smoke-test in Chrome at 375 px: plan next week in the planner, set a recipe to "für 2 gekocht", open Einkaufsliste, check amounts and the Gewürze section, untick an item, copy, and paste the result into a note to confirm the format
