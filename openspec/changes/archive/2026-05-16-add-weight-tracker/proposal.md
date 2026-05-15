## Why

The user weighs in daily but has no way to see whether the current training and nutrition approach is working. Daily weight is too noisy to interpret on its own (water, food in gut, glycogen, sodium swings ± 1–2 kg), so what's needed is a smoothed trend and an objective rate-of-change indicator. Without this, the user cannot tell within a reasonable timeframe whether a deficit/surplus/recomp is actually moving the needle.

## What Changes

- Add **daily weight logging** — one weight reading per calendar date, edit/delete supported, idempotent upsert by date.
- Compute a **7-day moving average** ("trend weight") to smooth daily noise. This is the primary "real" weight the user evaluates against.
- Compute three rate-of-change indicators, all based on the 7-day MA:
  - **Weekly rate** (primary): % change of the trailing 7d MA versus the 7d MA seven days ago. The most actionable signal — target zone for a sustainable cut is ~0.5–1.0%/week.
  - **28-day change** (cycle review): % change of the trailing 7d MA versus the 7d MA twenty-eight days ago. 28 days is the standard fitness-coaching mesocycle review window — long enough for the trend to outrun daily noise (incl. monthly cycle effects), short enough to remain actionable.
  - **Total change since start** (context): % change versus the first available 7d MA.
- Add a **weight history chart** (hand-rolled SVG): raw daily entries as dots + 7d MA as a line, with a range selector (30 / 90 / 180 / 365 days / all).
- Add **inline quick entry** on the daily-log screen ("Today's weight" card) so the daily weigh-in is one tap away — friction kept minimal per the project's UX principle.
- Add a **dedicated Weight Tracker screen** reachable from Settings, containing the chart, stat cards (current weight, 7d MA, weekly rate, 28d change, total change), and a list of recent entries with edit/delete.
- Surface a **"recent 7d avg" hint on the body-profile form** with a one-tap "use this value" action, so the user's macro calculation can stay anchored to the trend rather than a single noisy reading.

## Capabilities

### New Capabilities
- `weight-log`: daily weight entries (one per date), with derived 7-day moving average and rate-of-change indicators (weekly, 28-day, total). Backed by its own JSON repository and exposed via domain-language HTTP endpoints.
- `weight-tracker-ui`: the frontend surfaces — inline quick-entry card on the daily-log screen, dedicated weight tracker screen with chart + stats + history list, and the body-profile MA hint.

### Modified Capabilities
<!-- None. The bottom-navigation spec is intentionally not modified: the weight tracker is reached via Settings, not a new top-level tab. The body-profile MA hint is additive UI and does not change any documented requirement of the macro-calculator spec. -->

## Impact

- **Backend**:
  - New domain module `backend/src/domain/weight-log/` with `WeightEntry` aggregate, repository port, pure trend-computation functions (`computeMovingAverage`, `computeTrend`), and use cases (`logWeight`, `editWeight`, `removeWeight`, `listWeightEntries`, `getWeightTrend`).
  - New `JsonWeightLogRepository` adapter writing to `./data/weight-log.json` (one-file-per-repo convention).
  - New HTTP endpoints: `POST /weight-log`, `GET /weight-log`, `DELETE /weight-log/:date`, `GET /weight-log/trend`.
  - Wired into the composition root next to the body-profile wiring.
- **Frontend**:
  - New feature folder `frontend/src/features/weight-log/` with: inline quick-entry card, weight tracker screen, SVG chart component, stat cards, history list with edit/delete.
  - New React Query hooks for log/list/trend/delete.
  - A small modification to `body-profile-form.tsx` to render the "recent 7d avg → use as weight" hint when a trend value is available.
  - A new route / settings entry "Weight tracker" that mounts the dedicated screen.
- **Dependencies**: adds `recharts` for the weight chart. We initially tried hand-rolled SVG to keep the bundle small, but it looked unfinished and lacked tooltips; recharts gives us auto-scaled axes, collision-avoiding date ticks, and free tooltips for the size cost.
- **Tests**: pure-function unit tests for the moving-average and trend computations (incl. sparse-data edge cases and the "too few entries → null" rule); use-case tests; HTTP handler tests; component tests for the form, chart range selector, and stat cards.
