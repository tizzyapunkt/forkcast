# forkcast — Plan

## IN PROGRESS

_Nothing in progress yet._

---

## TODO

### Frontend epic

**Stack:** Vite + React + TypeScript, Tailwind CSS, shadcn/ui, React Query (server state), local useState/useReducer (UI state), vite-plugin-pwa.
**Colors:** brand palette (primary-100/200/300, accent-100–500) from user's blog.








---

### Backlog

#### #8 Copy day / slot / week _(future)_
Copy a slot or full day's log entries to another date. Useful for meal prep patterns. Not MVP.

---

## DONE

### #20 Recently used ingredients — Recent tab in log drawer
- Backend domain: `backend/src/domain/meal-log/list-recently-used-ingredients.use-case.ts` (filters full entries, dedupes by `(name lower-cased, unit)`, latest macros win, sorted by `lastUsedAt` desc); new `RecentlyUsedIngredient` type in `meal-log/types.ts`; `findAll()` added to `LogEntryRepository` (+ `JsonLogEntryRepository`)
- Backend HTTP: `GET /recently-used-ingredients` registered in `backend/src/index.ts`, handler at `backend/src/http/meal-log/list-recently-used-ingredients.handler.ts`
- Frontend: `frontend/src/features/log-ingredient/recent-panel.tsx` (fuzzy search via `fuse.js`, threshold 0.4); `useRecentlyUsedIngredients` hook with lazy fetch; `RecentlyUsedIngredient` mirrored in `frontend/src/domain/meal-log.ts`; new `frontend/src/api/recently-used-ingredients.ts`
- Drawer: tab order Search → Recent → Quick; recents fetched only when Recent tab is mounted; back from confirm preserves the originating tab; picking a recent reuses `FullEntryConfirm` so a fresh amount is always typed
- Cache invalidation: `useLogIngredient`/`useEditLogEntry`/`useRemoveLogEntry` invalidate the recents key on success
- 8 new use-case tests (empty/quick-only/single/duplicate-latest-wins/different-units/case-insensitive/sort/mixed); 6 RecentPanel tests; 5 drawer integration tests (no-fetch on Search, single fetch on Recent select, no refetch on toggle, full-entry POST shape, Back returns to Recent)
- OpenSpec: `openspec/changes/add-recently-used-ingredients/`

### #19 US-03 Inline amount editing (full entries)
- `src/features/daily-log/inline-amount-input.tsx` — number input with `min=1`, 500 ms debounce, clamps < 1g and empty values (no PATCH), syncs to external amount changes without clobbering in-progress typing
- `src/features/daily-log/entry-row.tsx` — full entries render `InlineAmountInput` in place of the `{amount} {unit}` text; Edit button is gone for full entries, still present for quick entries
- `src/queries/use-edit-log-entry.ts` — `onMutate`/`onError` optimistic updates: snapshots cache, patches the entry and recomputes slot+day totals locally, rolls back on error, invalidates on settle
- `src/features/edit-remove/edit-entry-drawer.tsx` — drawer narrowed to quick entries only (full-entry edit path was unreachable after the inline switch)
- 5 new tests (`inline-amount-input.test.tsx`): pre-fill, debounced single PATCH, coalescing rapid edits, empty input, sub-1g value
- 2 new tests (`use-edit-log-entry.test.tsx`): optimistic cache update before server responds, rollback on 500

### #18 US-01 Sticky macro header
- `src/domain/nutrition-progress.ts` — `kcalStatus`/`macroStatus` helpers encoding the ampel thresholds (kcal: green exactly at 100 %, yellow ±[80,120], red outside; macros: green 90–110, yellow 80–120 outside green, red outside)
- `src/features/daily-log/day-totals-header.tsx` — kcal row with progress bar + badge (`X kcal offen` / `✓ erreicht` / `X kcal über Ziel`), macro row (Protein/Carbs/Fat) in ampel colors, graceful empty state when no goal is set
- `src/components/app/app-header.tsx` — `sticky top-0 z-30`, new `bottom` slot for the macro summary
- `src/app.tsx` — hoists `useDailyLog`/`useNutritionGoal`, renders `DayTotalsHeader` in the AppHeader bottom slot for the log view only (hidden on settings)
- `src/features/daily-log/daily-log-screen.tsx` — removed `DayTotals` card (duplicate of header); deleted `day-totals.tsx`
- 20 new tests (`nutrition-progress.test.ts`) covering thresholds and edge cases
- 9 new tests (`day-totals-header.test.tsx`) covering bar width, ampel classes, badge text, goal-missing fallback, rounding
- 3 new tests in `app.test.tsx`: sticky header, macro bar in log view, hidden in settings view

### #17 PWA — installable + precached shell
- `vite.config.ts` — VitePWA finalized: manifest (name, icons, maskable), workbox precache of app shell assets, `registerType: 'autoUpdate'`
- `src/main.tsx` — SW registered via `registerSW({ immediate: true })` from `virtual:pwa-register`
- `src/vite-env.d.ts` — `/// <reference types="vite-plugin-pwa/client" />` for virtual module types
- `src/index.css` — fixed `border-border` → raw CSS variable (build fix)
- `workbox-window` added as runtime dep
- `pnpm build` succeeds; 11 entries precached (JS, CSS, HTML, manifest, icons)
- Manual QA checklist: `pnpm build && pnpm preview` → DevTools Manifest ✓ → SW registered ✓ → Install prompt available

### #16 Settings — nutrition goal
- `src/features/settings/{nutrition-goal-form,settings-screen}.tsx`
- `src/app.tsx` — `useState<'log'|'settings'>` view switch; Settings ⚙ button in log view, ← Back in settings view
- Form: pre-fills from goal query, empty when 404, validates (calories positive, macros ≥ 0), shows "Saved" on success, invalidates `['nutrition-goal']`
- 7 tests: pre-fill, 404 empty, validation block, PUT + saved + invalidation, negative macro, navigation to settings, back navigation

### #15 Edit + remove log entries
- `src/features/edit-remove/{edit-entry-drawer,remove-entry-confirm}.tsx`
- `src/features/daily-log/entry-row.tsx` — Edit + Remove buttons, local `useState` for drawer/dialog open state
- Quick edit: pre-fills calories + macros, PATCHes `{type:'quick',...}`; Full edit: amount only, PATCHes `{type:'full',amount}`
- Remove: confirmation dialog, DELETE on confirm, cancel leaves entry intact
- 7 tests: quick pre-fill, quick PATCH, full field visibility, full PATCH, 400 error inline, remove confirm, remove cancel

### #14 Full entry (search) flow
- `src/features/log-ingredient/search-panel.tsx` — debounced search input (300ms), disabled when q < 2 chars, results list with calorie hint, `onSelect` callback
- `src/features/log-ingredient/full-entry-confirm.tsx` — selected result summary + amount field, logs full entry, Back/Log buttons
- `src/features/log-ingredient/log-ingredient-drawer.tsx` — Search tab wired, step machine (search → confirm → close), tab/step/selected reset on close
- 9 tests: debounce guard, results, calorie hint, onSelect, empty state, amount validation, full payload shape, onSuccess, onBack

### #13 Quick entry flow
- `src/features/log-ingredient/{use-log-ingredient-drawer,quick-entry-form,log-ingredient-drawer}.tsx`
- `src/features/daily-log/slot-card.tsx` — Add button wired to drawer, `date` prop added
- `src/features/daily-log/daily-log-screen.tsx` — passes `date` to `SlotCard`
- 7 tests: validation errors, required fields submit, optional macros, backend error stays open, drawer opens from slot, slot in payload, invalidation on success

### #12 Date navigation
- `src/features/date-nav/{date-nav.tsx,use-active-date.ts}`
- `src/app.tsx` — hosts `useActiveDate()`, passes `date` to `DailyLogScreen`, renders `DateNav` in header
- `src/components/app/app-header.tsx` — accepts `children` slot for nav
- `src/domain/date.ts` — fixed `formatISODate` to use local time (avoids UTC day-boundary shift)
- 4 tests: initial date, Prev/Next, Today reset

### #11 Daily log view
- `src/features/daily-log/{daily-log-screen,slot-card,entry-row,day-totals}.tsx`
- `src/app.tsx` — mounts `<DailyLogScreen date={today()} />`
- 8 tests: 4 slots always rendered, quick/full entry rows, day totals, goal comparison, missing-goal graceful, macrosPartial warning, skeleton, error banner

### #10 API client + React Query hooks
- `src/domain/{ingredient-search,date}.ts` — remaining domain types + date helpers
- `src/api/client.ts` — `fetchJson<T>` + `ApiError`; all endpoints flow through it
- `src/api/{daily-log,log-ingredient,edit-log-entry,remove-log-entry,nutrition-goal,search-ingredients}.ts` — one typed function per endpoint
- `src/queries/keys.ts` — `queryKeys.dailyLog(date)`, `nutritionGoal()`, `ingredientSearch(q)`
- `src/queries/use-{daily-log,nutrition-goal,log-ingredient,edit-log-entry,remove-log-entry,set-nutrition-goal,search-ingredients}.ts` — React Query hooks with invalidation rules
- `src/api/*.test.ts` + `src/queries/*.test.tsx` — 27 new tests (happy path + error paths + invalidation)

### #9 Frontend project setup
- `frontend/package.json` — workspace with Vite, React, TS, Tailwind, shadcn/ui deps, MSW, RTL, Vitest
- `frontend/vite.config.ts` — React plugin, PWA stub, `/api → localhost:3000` proxy
- `frontend/vitest.config.ts` + `src/test/{setup,harness}.tsx` + `src/test/msw/*` — Vitest + RTL + MSW test harness
- `frontend/tailwind.config.ts`, `src/index.css` — Tailwind with brand palette scaffold (hex values TBD)
- `frontend/src/{main,app}.tsx` — React root with QueryClientProvider, app shell
- `frontend/src/components/app/{app-header,error-banner,loading-skeleton}.tsx`
- `frontend/src/domain/{meal-log,nutrition}.ts` — wire-contract type stubs (full implementation in #10)
- Root `package.json` — `build`, `test`, `typecheck`, `lint`, `format` scripts added
- `lint-staged.config.mjs` — extended to cover `frontend/src/**/*.{ts,tsx}`
- `src/app.test.tsx` — smoke test: renders app header via `renderWithProviders`

### #7 OpenFoodFacts ingredient search integration
- `domain/ingredient-search/types.ts` — `IngredientSearchResult`
- `domain/ingredient-search/map-off-product.ts` — pure mapper (OFF product → domain type, divides per-100g by 100)
- `domain/ingredient-search/ingredient-search.service.ts` — port
- `infrastructure/ingredient-search/open-food-facts.service.ts` — adapter
- `http/ingredient-search/search-ingredients.handler.ts` — Hono handlers
- `GET /search-ingredients?q=`, `GET /search-ingredients/barcode/:barcode` wired in `index.ts`

### #6 Navigate between dates
Covered by `GET /daily-log/:date` — any date is valid, defaults to today. No separate backend work needed.

### #5 Edit and remove log entries
- `domain/meal-log/edit-log-entry.use-case.ts` — type-safe edit (full: amount, quick: calories/macros); throws on type mismatch or missing entry
- `domain/meal-log/remove-log-entry.use-case.ts` — remove with existence check
- `infrastructure/meal-log/json-log-entry.repository.ts` — `findById`, `update`, `remove` added
- `http/meal-log/edit-remove-log-entry.handler.ts` — Hono handlers
- `PATCH /log-entry/:id`, `DELETE /log-entry/:id` wired in `index.ts`

### #4 Set and update daily nutrition goal
- `domain/nutrition/nutrition-goal.repository.ts` — `NutritionGoalRepository` port
- `domain/nutrition/set-nutrition-goal.use-case.ts` + `get-nutrition-goal.use-case.ts`
- `infrastructure/nutrition/json-nutrition-goal.repository.ts` — JSON file adapter
- `http/nutrition/nutrition-goal.handler.ts` — Hono handlers
- `PUT /nutrition-goal`, `GET /nutrition-goal` wired in `index.ts`

### #3 View daily log with macro totals
- `domain/meal-log/get-daily-log.use-case.ts` — `getDailyLog` query
- `infrastructure/meal-log/json-log-entry.repository.ts` — `findByDate` added
- `http/meal-log/get-daily-log.handler.ts` — Hono handler
- `GET /daily-log/:date` wired in `index.ts`

### #2 Log an ingredient to a meal slot
- `domain/meal-log/log-entry.repository.ts` — `LogEntryRepository` port
- `domain/meal-log/log-ingredient.use-case.ts` — `logIngredient` command handler
- `infrastructure/meal-log/json-log-entry.repository.ts` — JSON file adapter
- `http/meal-log/log-ingredient.handler.ts` — Hono handler
- `POST /log-ingredient` wired in `index.ts`

### #1 Define core domain model
- `domain/meal-log/types.ts` — `MealSlot`, `MeasurementUnit`, `QuickIngredientEntry`, `FullIngredientEntry`, `IngredientEntry`, `LogEntry`, `DayTotals`, `SlotSummary`, `DailyLog`
- `domain/nutrition/types.ts` — `DailyGoal`
