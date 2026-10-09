# Tasks

## 1. Grocery list by portions per recipe (backend)

- [x] 1.1 Rewrite `buildGroceryList` tests for portions per recipe (default = logged, scaling `P / logged`, untracked once per recipe, deleted recipe unchanged and unlisted, unknown recipe ignored, `recipes` in the result) and make them pass; verify with `pnpm --filter @forkcast/backend test`
- [x] 1.2 Parse `portions=<id>:<n>,…` in `GET /grocery-list/{startDate}` with `400` on invalid values; verify with an HTTP handler test
- [x] 1.3 Add `portions` to the Bring! token payload (mint validation, page uses it); verify with token and page tests including "Portions from the token apply"

## 2. Remove cooked portions

- [x] 2.1 Remove `cookedPortions` from `LogEntry`, `setCookedPortions` (use case, test, route) and its copy in `addToRecipeBatch`; verify backend tests and `vp lint` pass and `POST /set-cooked-portions` is gone
- [x] 2.2 Remove `cooked-portions-sheet.tsx`, the banner's "für N gekocht" text and control, the API client and i18n keys (de, en); verify frontend tests pass and `grep -r cookedPortions frontend/src backend/src` is empty

## 3. Set batch ingredients (backend)

- [x] 3.1 Add `replaceMany(removeIds, save)` to `LogEntryRepository`, the JSON repository (one write) and the fake; verify with a repository test that both effects land in one write
- [x] 3.2 Implement `setBatchIngredients` test-first: set/remove per identity, batch metadata from the batch, id kept for surviving identities, idempotent, `404` unknown batch, `400` invalid ingredient / duplicate identity / empty batch, all-or-nothing; verify use-case tests pass
- [x] 3.3 Expose `POST /set-batch-ingredients` with body validation; verify with an HTTP test and a curl smoke test against the running backend

## 4. Grocery sheet portions (frontend)

- [x] 4.1 Extend the grocery-list API client and query key with portions; add a "Rezepte der Woche" block with a stepper per recipe that refetches and keeps ticks; verify with `grocery-list-sheet.test.tsx` scenarios (default, change, ticks survive, reset on reopen)
- [x] 4.2 Pass the sheet's portions to the Bring! mint call; verify with a sheet test on the mint request body

## 5. Cooking session domain (frontend, no UI yet)

- [x] 5.1 Write `domain/cooking-session.ts` test-first: default selection, pot portions, pot amounts, "in n of m", recipe order and conversion rates, added rows, untracked rows, macros per portion, deleted-recipe fallback; verify unit tests pass
- [x] 5.2 Add edit-to-payload functions (change, swap with prefill and merge, add, leave out, undo from snapshot); verify unit tests cover uneven batches, unselected batches and last-row protection
- [x] 5.3 Add `setBatchIngredients` API client + mutation invalidating week-log and daily-log queries; verify with an MSW-backed test

## 6. Design handoff

- [x] 6.1 Design the cooking view, the banner entry, the swap/add amount step and the grocery portions block in Claude Design from the UX hints in `design.md`; drop the handoff as `design_handoff_cook-planned-recipe/` at the repo root and cite it in `design.md`; verify the folder exists and is not committed

## 7. Cooking view (frontend)

- [x] 7.1 Add `hooks/use-screen-wake-lock.ts` (request, re-request on visible, release); verify with a test using a stubbed `navigator.wakeLock`
- [x] 7.2 Add the `cooking` app state with URL mirroring and startup parsing, planner initial week on back, bottom nav hidden; verify with an app test that a reload URL restores the session and leaving clears it
- [x] 7.3 Add the "Kochen" action on recipe batch banners in the planner; verify with a planner test that it opens the view for the batch's recipe and week
- [x] 7.4 Add the 44 px `Button` size and a `Stepper` primitive in `components/ui/` (exported from `index.ts`), move the recipe detail and per-portion hero steppers onto it; verify with primitive tests and unchanged recipe tests
- [x] 7.5 Build `features/cooking-session/` against the handoff with tokens and primitives: portions block, macros per portion, ingredient rows with commit-on-confirm editing, swap/add via the add-food sheet's new target mode, leave out, per-row undo, untracked section, steps, all states; verify with RTL tests for the spec scenarios (de and en strings)
- [x] 7.6 Check the built screens against the handoff renders and run `/impeccable critique` and `/impeccable polish` on them; fix findings and the design hook's reports

## 8. Integration

- [x] 8.1 Run `make check`; verify it passes
- [x] 8.2 Smoke test end to end on a phone: plan Pasta twice, open Einkaufsliste at 4 portions and send to Bring!, open Kochen, change Ketchup 200 → 400 ml, undo, redo, reload mid-session; verify planner and diary show 100 ml per portion and the screen stays on (note the iOS wake lock result in `design.md`)
- [x] 8.3 If a token, primitive or layout rule changed, run `/impeccable document target frontend` (merge); if `components/ui/` changed, run `build:ui` and `/design-sync`; verify `/impeccable doctor` reports no drift for `frontend`

## Workflow follow-up

- Archive the change after review with `/opsx:archive`.
