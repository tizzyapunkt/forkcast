## 1. Backend — domain & projection

- [x] 1.1 Add required `lastAmount: number` to `RecentlyUsedIngredient` in `backend/src/domain/meal-log/types.ts`.
- [x] 1.2 Extend `list-recently-used-ingredients.use-case.test.ts` (TDD — write failing tests first) covering: single entry carries amount; later duplicate overrides earlier amount; same-name different-units carry independent amounts; case-insensitive collapse keeps the latest amount.
- [x] 1.3 Update `list-recently-used-ingredients.use-case.ts` to copy `amount` from the latest collapsed entry into the projection, making the new tests pass.

## 2. Backend — HTTP

- [x] 2.1 Verify (and add a handler test if missing) that `GET /recently-used-ingredients` round-trips the new `lastAmount` field in `backend/src/http/meal-log/list-recently-used-ingredients.handler.ts`. _Handler is a one-line `c.json(recents)` pass-through; no shape change is needed and a handler test would be testing Hono itself (excluded per CLAUDE.md)._

## 3. Frontend — domain & query type

- [x] 3.1 Mirror `lastAmount: number` on `RecentlyUsedIngredient` in `frontend/src/domain/meal-log.ts`.
- [x] 3.2 Adjust `frontend/src/api/recently-used-ingredients.ts` and `frontend/src/queries/use-recently-used-ingredients.ts` only if they enforce a runtime shape — pass through the new field otherwise. _No change needed; both use generic `fetchJson<RecentlyUsedIngredient[]>` and pass the field through unchanged._

## 4. Frontend — recent-panel selection payload

- [x] 4.1 Update `recent-panel.test.tsx` (TDD) to assert that selecting a recent item calls `onSelect` with `lastAmount` carried through to the confirm step.
- [x] 4.2 Extend `recent-panel.tsx` so the selection callback delivers the `lastAmount` alongside the existing `IngredientSearchResult` shape (either via an augmented selection payload or a sibling argument — design.md leaves the carrier open as long as `FullEntryConfirm` receives a `defaultAmount` only on the Recent path).

## 5. Frontend — confirm step pre-fill

- [x] 5.1 Update `full-entry-confirm.test.tsx` (TDD) to cover: pre-filled value renders when `defaultAmount` is provided; submitting unchanged persists the pre-filled amount; editing then submitting persists the edited amount; absent `defaultAmount` keeps the input empty.
- [x] 5.2 Add an optional `defaultAmount?: number` prop to `FullEntryConfirm` and pass it as the form's default value (do not include source-aware branching inside the component).

## 6. Frontend — drawer wiring

- [x] 6.1 Update `log-ingredient-drawer.test.tsx` (or `recent-panel.test.tsx` integration coverage) to assert that the Recent → confirm path renders the input pre-filled, while Search → confirm renders it empty.
- [x] 6.2 In `log-ingredient-drawer.tsx`, track the picked `lastAmount` alongside the existing `step` state for the Recent path only, and pass it to `FullEntryConfirm` as `defaultAmount`. Leave the Search and Barcode paths untouched.

## 7. Verification

- [x] 7.1 Run `pnpm --filter @forkcast/backend test` and `pnpm --filter @forkcast/frontend test` — all green.
- [x] 7.2 Smoke test in Chrome: log "Oats / g" 80 g, reopen the log drawer on a different slot, switch to Recent, pick "Oats", confirm the amount is pre-filled with `80`, submit, and verify the new entry appears with amount 80.
- [x] 7.3 Confirm via the same smoke that Search → confirm still opens with an empty amount input.
- [x] 7.4 `pnpm --filter @forkcast/backend lint` and `pnpm --filter @forkcast/frontend lint` — no new warnings.
