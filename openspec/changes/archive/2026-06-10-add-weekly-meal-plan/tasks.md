## 1. Backend — week-log read model (TDD)

- [x] 1.1 Added `get-week-log.use-case.test.ts` (5 tests): seven consecutive days, month-boundary crossing,
  per-day rollup equals `getDailyLog`, empty days zeroed, week aggregate + averages = sum/7.
- [x] 1.2 Implemented `get-week-log.use-case.ts` (`getWeekLog` reusing `getDailyLog`) + `date-range.ts`
  (`addDaysIso`); added `WeekLog`/`MacroAverages` to `meal-log/types.ts`. Kept seven `findByDate` calls
  (shares per-day repo reads; no new repo method needed).
- [x] 1.3 Added `get-week-log.handler.ts` (`GET /week-log/:startDate`, 400 on bad date) + registered the
  route; handler test covers 200 (7 days) + 400.
- [x] 1.4 Backend tests green.

## 2. Backend — copy-day command (TDD)

- [x] 2.1 Added `copy-log-day.use-case.test.ts` (4 tests): clones with fresh id/loggedAt + `date = toDate`,
  preserves slot/ingredient/recipeId, source unmutated, empty-source no-op, additive (never removes).
- [x] 2.2 Implemented `copy-log-day.use-case.ts` (`copyLogDay` → `findByDate` + re-stamp + `saveMany`).
- [x] 2.3 Added `copy-log-day.handler.ts` (`POST /copy-log-day`, ISO-date validation) + registered;
  handler test covers 201 + 400.
- [x] 2.4 Backend suite green (13 new tests; lint clean).

## 3. Frontend — week-log query + cache coherence (TDD)

- [x] 3.1 Added `api/week-log.ts` (`getWeekLog` + `copyLogDay`), `queryKeys.weekLog`/`weekLogAll`,
  `use-week-log.ts`; mirrored `WeekLog`/`MacroAverages` in `domain/meal-log.ts`.
- [x] 3.2 All four log mutations + the new `use-copy-log-day.ts` invalidate `weekLogAll()` alongside the
  daily-log key; tests assert `useLogRecipe` and `useCopyLogDay` invalidate `['week-log']`.
- [x] 3.3 Added `mondayOf` to `domain/date.ts`; planner derives weekday/date labels from the ISO dates.
- [x] 3.4 Frontend suite green.

## 4. Frontend — planner rollups + tone helper (TDD)

- [x] 4.1 Added `week-rollup.test.ts` (6 tests): `dayTone` Neutral thresholds (empty/under/onTarget/over,
  never Alarm-Rot) + `plannedDaysCount`/`dayHasEntries`.
- [x] 4.2 Implemented `features/planner/week-rollup.ts`; green.

## 5. Frontend — Planner screen (Liste) (TDD)

- [x] 5.1 Added `planner-screen.test.tsx` (6 tests): seven sections, current day expanded + slots, header
  range/avg/planned-days, goal line + "leer", week nav, add-sheet open, copy-day confirm→POST.
- [x] 5.2 Built `planner-screen.tsx` (Liste accordion + `DaySection`, slot rows, entry chips, progress
  bar) using `useWeekLog`/rollup/`useNutritionGoal`; Monday-based week nav.
- [x] 5.3 Planner screen green (6).

## 6. Frontend — add/remove on a day + copy-day (TDD)

- [x] 6.1 Covered in `planner-screen.test.tsx` (add opens the sheet for date+slot; copy-day confirm→POST)
  and `use-copy-log-day.test.tsx` (cache coherence).
- [x] 6.2 Wired "+" → `LogIngredientDrawer(date, slot)`, entry remove → `use-remove-log-entry`,
  "Tag kopieren" → confirm → `use-copy-log-day(fromDate, fromDate+1)`.
- [x] 6.3 Green.

## 7. Frontend — Planner nav tab (4 tabs) (TDD)

- [x] 7.1 Added `app.test.tsx` cases: four tabs incl. Planen; tapping Planen renders "Wochenplan".
- [x] 7.2 `AppView` gained `'planner'`; `bottom-nav.tsx` is 4-col with the Planen tab (`CalendarDays`);
  `app.tsx` renders `<PlannerScreen>`.
- [x] 7.3 Green.

## 8. i18n

- [x] 8.1 Added `de.planner` (title, week-nav arias, avg/planned-days, leer, copy-day strings, month +
  weekday names) and `nav.planner` = "Planen"; reused `slotLabelsDe`. All copy German.

## 9. End-to-end verification

- [x] 9.1 Backend 558 green, frontend 415 green.
- [x] 9.2 Both lint clean; frontend `tsc --noEmit` clean; `pnpm build` succeeds.
- [x] 9.3 Smoked in Chrome at 402px mobile width: Planen tab → Liste week view with today expanded; per-day
  totals vs goal (Neutral tone) + progress bar; added a quick entry to a day via the reused add-food sheet →
  day total, week Ø, and "{n}/7 Tage geplant" updated live (cache coherence); entry chip + remove cleared it
  live. Week-range label + copy-day confirm covered by RTL.
- [x] 9.4 `openspec validate add-weekly-meal-plan --strict` — valid.
