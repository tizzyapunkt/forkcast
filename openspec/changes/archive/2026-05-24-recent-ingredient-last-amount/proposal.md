## Why

Re-logging from the Recent tab still forces the user to re-type the amount every time, even though the same ingredient is usually consumed in the same portion (e.g. always 80g of oats, always 250ml of milk). The friction is small per tap but adds up across a daily routine and pushes against forkcast's "fast, low-friction" core principle.

## What Changes

- Extend the recently-used-ingredients projection to carry the `amount` from the most recent collapsed log entry as `lastAmount`.
- Expose `lastAmount` in the `GET /recently-used-ingredients` response payload.
- Pre-fill the full-entry confirm step's amount input with `lastAmount` when the user picks an ingredient from the Recent tab, so a single confirm tap is enough to re-log.
- Continue to leave the amount input empty when the user reaches confirm via Search or Barcode (no behavior change for those paths).

## Capabilities

### New Capabilities

_None — this is an enhancement to an existing capability._

### Modified Capabilities
- `recently-used-ingredients`: the projection, HTTP response, and Recent-tab selection flow gain a `lastAmount` that pre-fills the confirm step.

## Impact

- **Backend**
  - `backend/src/domain/meal-log/types.ts` — add `lastAmount: number` to `RecentlyUsedIngredient`.
  - `backend/src/domain/meal-log/list-recently-used-ingredients.use-case.ts` — include `entry.ingredient.amount` of the latest collapsed entry.
  - `backend/src/domain/meal-log/list-recently-used-ingredients.use-case.test.ts` — extend scenarios to cover the new field.
  - `backend/src/http/meal-log/list-recently-used-ingredients.handler.ts` — pass through the new field (no shape change beyond the addition).
- **Frontend**
  - `frontend/src/domain/meal-log.ts` — mirror `lastAmount` on the frontend type.
  - `frontend/src/features/log-ingredient/recent-panel.tsx` — propagate `lastAmount` when handing the picked item to the confirm step.
  - `frontend/src/features/log-ingredient/full-entry-confirm.tsx` — accept an optional default amount and pre-fill the form input.
  - `frontend/src/features/log-ingredient/log-ingredient-drawer.tsx` — thread the default amount through to `FullEntryConfirm` only for the Recent path.
  - Existing tests for the recent panel and full-entry confirm extend to cover pre-fill behavior.
- **No API contract break** — the response is additive; existing clients ignore the new field.
- **No persistence change** — the field is derived from existing log entries on every query.
