## 1. Backend — domain read model

- [x] 1.1 Add `findAll(): Promise<LogEntry[]>` to `LogEntryRepository` interface in `backend/src/domain/meal-log/log-entry.repository.ts`
- [x] 1.2 Implement `findAll` in `JsonLogEntryRepository` (`backend/src/infrastructure/meal-log/json-log-entry.repository.ts`) returning all stored entries
- [x] 1.3 Add domain type `RecentlyUsedIngredient { name, unit, macrosPerUnit, lastUsedAt }` in `backend/src/domain/meal-log/types.ts`
- [x] 1.4 Write failing tests `backend/src/domain/meal-log/list-recently-used-ingredients.use-case.test.ts` covering: empty history, only-quick history, single full entry, duplicate latest-wins, same-name-different-unit-distinct, case-insensitive name dedupe, sorted by `lastUsedAt` desc
- [x] 1.5 Implement `ListRecentlyUsedIngredients` use case in `backend/src/domain/meal-log/list-recently-used-ingredients.use-case.ts` (filters `type === 'full'`, dedupes by `(name.toLowerCase(), unit)`, keeps latest macros, sorts by `lastUsedAt` desc) until tests pass
- [x] 1.6 Refactor for readability; keep test behavior intact

## 2. Backend — HTTP

- [ ] 2.1 ~~Write failing handler test~~ — skipped: project has no HTTP handler tests; CLAUDE.md says "trust the framework". Domain coverage is sufficient.
- [x] 2.2 Implement `makeListRecentlyUsedIngredientsHandler` in `backend/src/http/meal-log/list-recently-used-ingredients.handler.ts`
- [x] 2.3 Register `app.get('/recently-used-ingredients', ...)` in `backend/src/index.ts`
- [ ] 2.4 ~~Confirm handler test passes against the registered route~~ — skipped (see 2.1)

## 3. Frontend — API + query layer

- [x] 3.1 Add `RecentlyUsedIngredient` type to `frontend/src/domain/` (mirror backend shape)
- [x] 3.2 Add `getRecentlyUsedIngredients()` to `frontend/src/api/client.ts` calling `/api/recently-used-ingredients`
- [x] 3.3 Add React Query hook `useRecentlyUsedIngredients({ enabled })` in `frontend/src/queries/use-recently-used-ingredients.ts` using key `['recently-used-ingredients']`
- [x] 3.4 In `useLogIngredient` (and the edit/remove mutations if applicable), invalidate `['recently-used-ingredients']` on success so the list reflects new history

## 4. Frontend — fuzzy search dependency

- [x] 4.1 `pnpm --filter @forkcast/frontend add fuse.js`
- [x] 4.2 Confirm bundle size impact is acceptable (<20 KB gzipped delta)

## 5. Frontend — Recent tab UI

- [x] 5.1 Write failing test for `RecentPanel` component: lists items from the hook, renders empty state when list is empty, fuzzy-filters on input change, calls `onSelect` with a synthesized `IngredientSearchResult` shape
- [x] 5.2 Implement `frontend/src/features/log-ingredient/recent-panel.tsx` (search input + list, fuzzy via `fuse.js`, threshold ~0.4)
- [x] 5.3 Synthesize a stable client-side `offId` (e.g. `recent:${name}|${unit}`) when shaping the picked recent into `IngredientSearchResult` so it slots into the existing confirm step

## 6. Frontend — Drawer wiring

- [x] 6.1 Update `Tab` union in `log-ingredient-drawer.tsx` to `'search' | 'recent' | 'quick'`
- [x] 6.2 Render the tab bar in order Search → Recent → Quick; default selected tab stays `'search'`
- [x] 6.3 Mount `<RecentPanel>` for `tab === 'recent' && step === 'search'`, with `useRecentlyUsedIngredients({ enabled: open && tab === 'recent' })` so the request fires on tab-select, not on drawer-open
- [x] 6.4 Wire `onSelect` to the existing `handleSelect`/`step: 'confirm'` flow so amount entry reuses `FullEntryConfirm`
- [x] 6.5 Ensure `handleBack` from confirm returns to the Recent tab (not Search) when the selection originated from Recent — preserve `tab` while resetting `step` and `selected`

## 7. Frontend — drawer-level tests

- [x] 7.1 Test: opening drawer on Search tab fires zero `/recently-used-ingredients` requests (use MSW spy)
- [x] 7.2 Test: switching to Recent tab fires exactly one request and renders the list
- [x] 7.3 Test: switching back-and-forth within the same drawer session does NOT refetch (cache reused)
- [x] 7.4 Test: picking a recent ingredient → submit → POST `/log-ingredient` body matches the picked `name`/`unit`/`macrosPerUnit` and the typed amount
- [x] 7.5 Test: Back from confirm after a Recent pick lands on the Recent tab, not Search

## 8. Verification

- [x] 8.1 `pnpm --filter @forkcast/backend test` green
- [x] 8.2 `pnpm --filter @forkcast/frontend test` green
- [ ] 8.3 `pnpm dev` and manual smoke test: log a fresh ingredient via Search; close and reopen drawer, switch to Recent, confirm it appears at the top; type a partial/typoed query and confirm fuzzy match; pick it and log a full entry; verify the daily log reflects the new entry — **deferred to user**: cannot run interactive browser smoke tests from this session
- [x] 8.4 Update `PLAN.md`: move this work from TODO/Backlog into DONE with a one-line summary referencing key files
