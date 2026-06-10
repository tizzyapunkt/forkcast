## Context

The meal log is well-modelled and persisted server-side as `LogEntry[]` in a JSON store
(`json-log-entry.repository.ts`), read by date via `getDailyLog(repo, date)` which buckets entries into
the four slots and rolls up `DayTotals`. Writes go through `log-ingredient`, `log-recipe`,
`edit-log-entry`, and `remove-log-entry`, each keyed by `date` + `slot`. The frontend reads a day via
`useDailyLog(date)` (`queryKeys.dailyLog(date)`) and renders it in the diary; the add-food sheet
(`LogIngredientDrawer`) already takes a `date` + `slot` and logs into it.

There is **no planner** today. The product owner settled the model: the planner is **a weekly view over
the same log data** — "fetching data for the whole week and setting data for the explicit days." So
there is no `MealPlan` aggregate, no `planned` flag, no separate store. A planned meal *is* a `LogEntry`
on a (possibly future) date.

Constraints (CLAUDE.md): pragmatic DDD / hexagonal, **CQRS** (queries purpose-built for the UI), TDD-first,
no speculative infrastructure, JSON persistence (additive only — though here nothing new is persisted).

## Goals / Non-Goals

**Goals:**
- A planner that shows the whole week with per-day and per-week kcal/macro rollups against the user's goal.
- One source of truth: planner and diary read and write the same `LogEntry` store and stay in sync.
- Reuse the existing add-food sheet and log mutations for "set data on explicit days" — no parallel write
  path.
- A purpose-built **week-log read model** so the planner gets the week in one shaped response.

**Non-Goals:**
- No separate plan entity, `planned` flag, or plan-vs-actual reconciliation. A plan *is* the log.
- No `Agenda`/`Raster` layouts (ruled out); only `Liste`.
- No `Alarm-Rot` deficit tone (ruled out); Neutral tone only.
- No change to how a single day is logged or rolled up (`getDailyLog`, `LogRecipe`, totals math reused).
- The recipe-editor / add-food redesign is a **separate change** (`redesign-recipe-editor-and-add-food`).

## Decisions

### Decision 1 — Planner = weekly view over `LogEntry`, no new entity
A "planned meal" is a `LogEntry` for a date+slot. The planner reads a 7-day window and writes into
explicit days via the existing log commands. No `MealPlan` aggregate, no migration.

**Rationale:** the product owner's framing. Keeps one source of truth; the diary and planner are the same
data at different zoom levels. Eliminates plan-vs-actual drift.

### Decision 2 — Backend week-log read model (`GET /week-log/{startDate}`)
Add `getWeekLog(repo, startDate)` returning `{ startDate, days: DailyLog[7], totals, averages }` where each
`days[i]` is the existing `getDailyLog` result for `startDate + i`, `totals` is the week sum, and
`averages` is `totals / 7`. A handler exposes `GET /week-log/:startDate` (mirrors `GET /daily-log/:date`).

**Rationale:** CQRS — a read shaped for the planner. Reuses the per-day rollup verbatim, so per-day numbers
match the diary exactly. One request instead of seven.

**Alternative considered:** have the frontend call `useDailyLog` seven times (shared cache with the
diary, zero extra invalidation). Rejected as the *primary* path because the product owner chose a backend
API and CQRS favours a purpose-built read; but cache coherence is still handled (Decision 4) so the
planner and diary never disagree.

### Decision 3 — Week starts on Monday; `startDate` is the Monday ISO date
The `Liste` design shows Mo–So. The planner computes the Monday of the active week and requests that as
`startDate`. Week navigation moves `startDate` by ±7 days. A small date helper (reusing
`frontend/src/domain/date.ts`) computes the Monday and the day labels; the backend treats `startDate` as
an opaque ISO date and returns the seven days from it (Monday-ness is a frontend convention).

### Decision 4 — Writes invalidate both `daily-log` and `week-log`
The planner uses `queryKeys.weekLog(startDate)`; the diary uses `queryKeys.dailyLog(date)`. Every log
write (log-ingredient, log-recipe, edit, remove, copy-day) MUST invalidate the `['week-log']` key
(prefix match, all weeks) in addition to `dailyLog(date)`. So adding a meal in the planner refreshes the
diary's day and vice versa.

**Rationale:** they're the same data; invalidating both keeps the two views coherent. Prefix-invalidating
all week-log queries is simplest and safe (only the active week is mounted).

### Decision 5 — Add via the existing add-food sheet, pointed at the target day
"Set data on explicit days" reuses `LogIngredientDrawer` with `date = day.date`, `slot`. No new write
command for adding/removing — the planner is a second caller of the same flow. (This composes with the
`add-food-sheet` redesign but does not depend on it; the planner works against the current sheet too.)

### Decision 6 — Copy-day as an atomic backend command
"Tag kopieren" clones a day onto the next via `copyLogDay(repo, fromDate, toDate)`: read `fromDate`'s
entries, re-stamp each with a fresh `id` + `loggedAt` and `date = toDate`, `saveMany` (atomic). Exposed as
`POST /copy-log-day { fromDate, toDate }`. Copy is **additive** (it does not clear `toDate` first), matching
the prototype; the confirm dialog states this.

**Rationale:** atomic and reuses `saveMany`; a client-side replay would be N requests and non-atomic.

### Decision 7 — Reuse rollup + goal helpers; Neutral tone only
Per-day kcal/macros come straight from the reused `DayTotals`. The day's tint vs the nutrition goal uses
a small `tone(dayKcal, goalKcal)` helper with **Neutral** thresholds (no Alarm-Rot): empty → neutral,
near-goal → success, well-over → a muted warning, else accent — but never the loud red. Week averages =
week totals ÷ 7; "{n}/7 Tage geplant" counts days with ≥ 1 entry.

### Decision 8 — Planner is a fourth top-level nav destination
`AppView` gains `'planner'`; `BottomNav` becomes four tabs (Tagebuch · Planen · Rezepte · Einstellungen),
4-column grid, `CalendarDays` icon. This is why Change B carries a small `bottom-navigation` MODIFIED
delta even though the README's table only lists the planner under "new capability" — making the planner
reachable necessarily touches the nav. The weight tracker stays under Settings.

## Risks / Trade-offs

- **[Two query keys for the same data could drift]** → Decision 4: every write invalidates both keys; an
  integration test asserts add-in-planner shows up in the diary day and vice versa.
- **[Seven days fetched on every week change]** → One shaped `/week-log` request per week; React Query
  caches per `startDate`. Cheap for a single-user home-server app.
- **[Copy-day duplicates if pressed twice]** → It is additive by design (matches the prototype); the
  confirm dialog says so. A future "replace target day" option is out of scope.
- **[Week-start convention]** → Fixed to Monday on the frontend; the backend is convention-agnostic
  (returns 7 days from `startDate`), so changing the convention later is a frontend-only edit.
- **[Logging a future date]** → The log store already accepts any ISO date; nothing special is needed.
  Recently-used and other date-agnostic features are unaffected.

## Migration Plan

- Backend: add two use cases + two handlers (read + copy). No schema change; the JSON store is reused.
- Frontend: add the planner feature, the fourth nav tab, and the week-log query + cache invalidation.
- **No data migration** — existing `LogEntry` records are the planner's data as-is.
- Rollback = revert the change set; the log store and diary are untouched.

## Open Questions

- Should "{n}/7 Tage geplant" count any day with ≥ 1 entry, or only days that meet some completeness bar
  (e.g. all slots non-empty)? Default: ≥ 1 entry (matches the prototype's `plannedDays`).
- Should copy-day offer "replace" in addition to "append"? Deferred; v1 appends per the selected design.
