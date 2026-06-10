## Why

CLAUDE.md frames forkcast as **planning-first** — "plan meals a week in advance" — yet no weekly
planner exists. The diary (`DiaryScreen`) only shows one day at a time, so planning the week means
stepping the date forward day by day. The redesign adds a **Planner** screen (the selected `Liste`
layout) that shows the whole week at once with per-day and per-week calorie/macro rollups against the
user's goals.

The key modelling decision (settled with the product owner): **the planner is not a separate plan
entity.** A "planned meal" is just a meal-log entry for a future date+slot. The planner is a **weekly
view over the same `LogEntry` data the diary already uses** — it *reads* a whole week and *writes* into
explicit days, using the same add-food sheet and the same persisted store. Planning a meal for next
Tuesday = creating a `LogEntry` for next Tuesday; when Tuesday arrives the diary already shows it. This
keeps one source of truth and makes the planner and diary stay in sync for free.

## What Changes

- **New `weekly-meal-plan` capability** (frontend Planner screen + a backend read model):
  - A backend **week-log query** — `GET /week-log/{startDate}` returns the seven consecutive days from
    `startDate`, each as a `DailyLog` (slots + per-day totals), plus the week's aggregate and daily
    averages. This is a CQRS read model purpose-built for the planner; it reads the existing log store,
    adds no new persisted shape.
  - A **Planner screen** (the `Liste` layout): the current week as a 7-day accordion (one day expanded
    at a time), with prev/next **week navigation**. Each day shows total kcal + macros tinted against
    the nutrition goal (Neutral tone — no Alarm-Rot), a progress bar, and its meal slots; the header
    shows **Ø kcal/Tag**, **Ø Makros/Tag**, and **{n}/7 Tage geplant**.
  - **Add / remove planned meals on any day**: a "+" on each day/slot opens the existing **add-food
    sheet** targeting that date+slot; adding creates `LogEntry`(s) on that date exactly like the diary;
    each entry has a remove control. Changes reflect in both the planner and the diary (shared data).
  - **Copy a planned day to the next day** (the `Liste` "Tag kopieren"): clone all of one day's entries
    onto the following day, behind a confirm. Backed by a `POST /copy-log-day` command.
- **Bottom navigation gains a Planner tab** — four tabs in the order **Tagebuch · Planen · Rezepte ·
  Einstellungen** (the planner is reachable as a top-level destination, per the design).

Out of scope (selected-design constraints): the `Agenda` and `Raster` planner layouts are ruled out and
not built. The weight tracker stays reachable via Settings (unchanged).

## Capabilities

### New Capabilities
- `weekly-meal-plan`: the weekly planner — a week-log read model over existing log entries, the `Liste`
  planner view with per-day/per-week rollups against goals, add/remove of planned meals on explicit
  days via the add-food sheet, and copy-day.

### Modified Capabilities
- `bottom-navigation`: the bar gains a **Planner** tab (now four tabs: Log, Planner, Recipes, Settings)
  so the planner is reachable as a primary destination.

## Impact

- **Backend (meal-log)** — new `get-week-log.use-case.ts` (`getWeekLog(repo, startDate)` → 7 `DailyLog`s
  + week aggregate, reusing the existing per-day rollup logic from `get-daily-log.use-case.ts`) and
  `copy-log-day.use-case.ts` (`copyLogDay(repo, fromDate, toDate)` → clone each entry with a fresh
  `id`/`loggedAt` and `date = toDate`, `saveMany`). New HTTP handlers `GET /week-log/:startDate` and
  `POST /copy-log-day`. The `LogEntryRepository` already exposes `findByDate` and `saveMany`; a
  `findByDateRange` MAY be added for efficiency but is optional.
- **Frontend (planner)** — `api/week-log.ts`, `queries/use-week-log.ts` + `queryKeys.weekLog(startDate)`,
  a `use-copy-log-day` mutation; `features/planner/planner-screen.tsx` (Liste accordion), week-nav state,
  a `DayBar` progress component, slot blocks, and entry chips. Reuse the add-food sheet
  (`LogIngredientDrawer`) pointed at the target date+slot, and the existing log/remove mutations.
- **Frontend (shell)** — `app.tsx` adds the `planner` view; `bottom-nav.tsx` adds the Planen tab
  (`AppView` gains `'planner'`, 4-column grid, lucide `CalendarDays` icon).
- **Cache coherence** — log writes (log-ingredient, log-recipe, remove, edit, copy-day) MUST invalidate
  the `week-log` query key (prefix match) in addition to `daily-log(date)`, so the planner and diary stay
  consistent.
- **Domain (frontend)** — reuse `DayTotals` and the existing nutrition-goal/`nutrition-progress` helpers
  for per-day rollups vs goals; add a small week-aggregate/`tone` helper (Neutral thresholds) with tests.
- **i18n** — new `de.planner` namespace: `Wochenplan`, week-nav labels, `Ø kcal/Tag`, `Ø Makros / Tag`,
  `{n}/7 Tage geplant`, `Tag gesamt`, `leer`, `Tag kopieren`, `{Wochentag} kopieren`, slot labels
  (reuse `slotLabelsDe`), weekday names; `nav.planner` = "Planen".
- **Tests** — TDD per CLAUDE.md: backend use-case tests for `getWeekLog` (7-day window, per-day + week
  totals, empty days) and `copyLogDay` (clone with fresh ids, atomic, date rewritten); frontend tests for
  the week-aggregate/tone helper, the planner view (accordion, week nav, rollups vs goal, add/remove via
  the sheet, copy-day confirm), the 4-tab nav, and cache invalidation keeping planner⇄diary in sync.
- **No data migration** — the planner reads/writes existing `LogEntry` records; no schema change.
