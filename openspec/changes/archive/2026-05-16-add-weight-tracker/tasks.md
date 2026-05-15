## 1. Backend domain — types, validation, repository port

- [x] 1.1 Create `backend/src/domain/weight-log/types.ts` with the `WeightEntry` interface (`date: string`, `weightKg: number`) and a `TrendSnapshot` interface (`current`, `movingAverage7d`, `weeklyRatePercent`, `changePercent28d`, `totalChangePercent`, `firstEntryDate`, `lastEntryDate`, `totalEntries`)
- [x] 1.2 Write failing tests in `backend/src/domain/weight-log/validate-weight-entry.test.ts` covering: malformed date (`2026-13-40`), future date, non-positive weight, weight > 500, valid round-trip, rounding to 2 decimals
- [x] 1.3 Implement `validateWeightEntry(input, today)` in `backend/src/domain/weight-log/validate-weight-entry.ts` as a pure function that returns either a normalised `WeightEntry` (with `weightKg` rounded to 2 decimals) or a domain error; make 1.2 pass
- [x] 1.4 Define the `WeightLogRepository` port in `backend/src/domain/weight-log/weight-log.repository.ts` with `list()`, `upsert(entry)`, `remove(date)` — mirror the shape of `BodyProfileRepository`

## 2. Backend domain — trend computation (pure functions)

- [x] 2.1 Write a shared fixture file `backend/src/domain/weight-log/trend.fixtures.ts` with realistic test cases: 30-day dense log, 10-day sparse log, 3-entries-in-window edge case, empty log, single-entry log, log with gaps inside the trailing 7-day window
- [x] 2.2 Write failing tests in `backend/src/domain/weight-log/trend.test.ts` for `computeMovingAverage(entries, asOf, windowDays=7, minEntries=4)` covering: arithmetic mean across entries inside the window, returns `null` when fewer than 4 entries in window, excludes entries outside the window, ignores ordering of input array
- [x] 2.3 Implement `computeMovingAverage` in `backend/src/domain/weight-log/trend.ts` as a pure function with no I/O; make 2.2 pass
- [x] 2.4 Extend `trend.test.ts` with failing tests for `computeTrend(entries, asOf)` covering: all five numeric fields populated for a dense log, `weeklyRatePercent` correctness on a worked example (e.g. trailing MA 77.6 vs prior MA 78.4 → ≈ −1.02 %), `changePercent28d` returns `null` when fewer than 4 entries in the window 28 days ago, `totalChangePercent` is anchored to the earliest 7-day window with ≥ 4 entries, `current` reflects raw `weightKg` on `asOf` or `null`, populated `firstEntryDate`/`lastEntryDate`/`totalEntries` metadata, empty log returns all-null + zero totals
- [x] 2.5 Implement `computeTrend` in `backend/src/domain/weight-log/trend.ts` (pure, deterministic, accepts `asOf` as an argument — no clock access); make 2.4 pass

## 3. Backend domain — use cases

- [x] 3.1 Write failing tests in `backend/src/domain/weight-log/weight-log.use-cases.test.ts` for `logWeight` (upserts, returns the persisted entry + a fresh trend snapshot), `listWeightEntries` (sorted ascending by date, optional `from`/`to` filter, empty list when `from > to`), `removeWeight` (idempotent on missing date), and `getWeightTrend` (delegates to `computeTrend(entries, asOf)`)
- [x] 3.2 Implement `log-weight.use-case.ts`, `list-weight-entries.use-case.ts`, `remove-weight.use-case.ts`, and `get-weight-trend.use-case.ts`; make 3.1 pass
- [x] 3.3 Verify the upsert use case explicitly handles "two writes on the same date" (last write wins) with a dedicated test case

## 4. Backend infrastructure — JSON repository

- [x] 4.1 Write failing tests in `backend/src/infrastructure/weight-log/json-weight-log.repository.test.ts` covering: empty state on first read, persistence across re-instantiation, upsert by date, removal by date (idempotent), parent-dir creation in `init()`, rounding `weightKg` to two decimals on write
- [x] 4.2 Implement `JsonWeightLogRepository` in `backend/src/infrastructure/weight-log/json-weight-log.repository.ts` writing to `./data/weight-log.json` and implementing `Initializable`; make 4.1 pass
- [x] 4.3 Wire the adapter into the composition root in `backend/src/index.ts` next to `JsonBodyProfileRepository`, including it in the `bootstrap([...])` call

## 5. Backend HTTP layer

- [x] 5.1 Write failing tests in `backend/src/http/weight-log/weight-log.handler.test.ts` covering:
  - `POST /weight-log` happy path returns the entry and the trend
  - `POST /weight-log` validation failures (malformed date, future date, weight ≤ 0, weight > 500) return 400
  - `GET /weight-log` returns all entries sorted ascending, supports `from`/`to`, returns empty list when `from > to`
  - `GET /weight-log/trend` returns the trend payload; honours `asOf`; defaults to today
  - `DELETE /weight-log/:date` removes; idempotent (204 even when absent); 400 on malformed date in path
- [x] 5.2 Implement `backend/src/http/weight-log/weight-log.handler.ts` exposing the four endpoints in Hono with the same handler/composition style as `body-profile.handler.ts`; make 5.1 pass
- [x] 5.3 Mount the handler in the main HTTP composition next to the body-profile handler

## 6. Frontend — domain & data layer

- [x] 6.1 Create `frontend/src/domain/weight-log.ts` with TypeScript types mirroring the backend `WeightEntry` and `TrendSnapshot` shapes
- [x] 6.2 Copy the trend fixtures from 2.1 to `frontend/src/domain/weight-log-trend.fixtures.ts` (or import via a shared workspace path) — same corpus
- [x] 6.3 Write failing tests in `frontend/src/domain/weight-log-trend.test.ts` mirroring the backend `trend.test.ts` assertions
- [x] 6.4 Implement `computeMovingAverage` and `computeTrend` in `frontend/src/domain/weight-log-trend.ts` as pure functions; make 6.3 pass; both backend and frontend test suites must stay green against the shared corpus
- [x] 6.5 Add `frontend/src/queries/use-weight-log.ts` (React Query: `GET /weight-log`)
- [x] 6.6 Add `frontend/src/queries/use-weight-trend.ts` (React Query: `GET /weight-log/trend`)
- [x] 6.7 Add `frontend/src/queries/use-log-weight.ts` mutation (`POST /weight-log`) — on success invalidate `use-weight-log`, `use-weight-trend`, and (no-op-friendly) `use-body-profile`
- [x] 6.8 Add `frontend/src/queries/use-remove-weight.ts` mutation (`DELETE /weight-log/:date`) — same invalidations as 6.7

## 7. Frontend — feature folder scaffolding & i18n

- [x] 7.1 Create `frontend/src/features/weight-log/` folder
- [x] 7.2 Add German i18n strings under a `weightLog` namespace in `frontend/src/i18n/de.ts`: form labels ("Heutiges Gewicht", placeholder), stat-card titles, range-selector labels (`30T / 90T / 180T / 365T / Alle`), empty-state hints ("Mindestens 4 Einträge in den letzten 7 Tagen für den Trend"), validation messages, edit/delete actions, "Gewicht-Tracker" screen title, "Trailing 7d avg" hint copy

## 8. Frontend — chart component

- [x] 8.1 Write failing component tests in `frontend/src/features/weight-log/weight-chart.test.tsx` covering: renders empty state when no entries, renders dots for each raw entry, renders MA line only where MA is defined (no interpolation across gaps), responds to range-selector changes (recomputes the visible MA on the window), is responsive (SVG scales to container width)
- [x] 8.2 Implement `weight-chart.tsx` as a hand-rolled SVG component with: a responsive `viewBox`, dots for raw entries, a path for the MA line, simple axis ticks (3–5), and a range selector (`30d / 90d / 180d / 365d / all`, default `90d`); make 8.1 pass
- [x] 8.3 Verify the chart renders without overflow at 360 px viewport width in the test environment

## 9. Frontend — stat cards, history list, weight tracker screen

- [x] 9.1 Implement `weight-stats.tsx` rendering five stat cards (current weight, 7d MA, weekly rate %, 28d change %, total change %), showing `—` and a hint when the underlying value is `null`
- [x] 9.2 Implement `weight-history-list.tsx` rendering recent entries newest-first with inline edit (calls `useLogWeight`) and delete (calls `useRemoveWeight`); optimistic delete with revert on failure
- [x] 9.3 Implement `weight-tracker-screen.tsx` composing the stat cards, chart, and history list in that order
- [x] 9.4 Add a route entry / Settings link "Gewicht-Tracker" pointing to the new screen (mirror how Settings currently navigates to its sub-views)
- [x] 9.5 Component tests for `weight-tracker-screen.tsx`: navigates from Settings; stat cards display values; stat cards display `—` with hint when MA is `null`; history list edit/delete trigger the right mutations and refresh related queries

## 10. Frontend — inline quick-entry card on daily-log screen

- [x] 10.1 Implement `weight-log-card.tsx` with two states: "no entry yet for today" (prompt + numeric input) and "entry exists" (today's raw weight + current 7d MA + weekly rate + edit affordance + link to Weight Tracker screen)
- [x] 10.2 Mount `weight-log-card.tsx` on `frontend/src/features/daily-log/daily-log-screen.tsx` near the top of the screen (above or below the day-totals header — pick the position that keeps tap targets reachable on mobile without obscuring totals)
- [x] 10.3 Component tests for `weight-log-card.tsx`: renders no-entry prompt when no entry exists for today; renders weight + MA + rate when an entry exists; submission posts to the API and transitions to the "entry exists" state; the numeric input triggers a numeric mobile keyboard (inputmode/pattern attributes asserted)

## 11. Frontend — body-profile MA hint

- [x] 11.1 Modify `frontend/src/features/body-profile/body-profile-form.tsx` to subscribe to `useWeightTrend` and render a hint "Trailing 7d avg: X kg · Use this" near the `weightKg` input when `movingAverage7d` is non-null
- [x] 11.2 Wire the hint's action to set the form's `weightKg` field to the MA value (no save side-effect)
- [x] 11.3 Hide the hint entirely when `movingAverage7d` is `null`
- [x] 11.4 Component tests covering both states (hint visible + action sets form value; hint absent when MA is null)

## 12. Smoke test & polish

- [x] 12.1 Disable HTTPS in `frontend/vite.config.ts` before starting the dev server for smoke testing (Chrome browser tools require plain HTTP)
- [x] 12.2 Run `pnpm dev`, open the daily-log screen in Chrome, log today's weight from the inline card, confirm the card transitions to the "entry exists" state with MA / weekly-rate values (will be `—` on first use; backfill a few days of entries to exercise the MA path)
- [x] 12.3 Navigate to Settings → Weight tracker, exercise the chart range selector (30d / 90d / 180d / 365d / all), verify the chart re-renders correctly, edit and delete an entry from the history list and confirm the chart + stat cards update
- [x] 12.4 Open the body-profile form, verify the "Trailing 7d avg" hint appears, tap "Use this" and confirm the form's `weightKg` field updates without saving
- [x] 12.5 **Re-enable HTTPS in `frontend/vite.config.ts`** after smoke testing completes — do not leave SSL disabled
- [x] 12.6 Run `pnpm --filter @forkcast/backend test` and `pnpm --filter @forkcast/frontend test` — all green
- [x] 12.7 Verify there are no console errors or React Query warnings in the browser during the smoke test
