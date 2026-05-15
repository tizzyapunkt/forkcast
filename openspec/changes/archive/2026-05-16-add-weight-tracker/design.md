## Context

forkcast tracks daily nutrition against user-defined macro/calorie goals. The macro goals are derived from a `BodyProfile` aggregate (introduced in `add-macro-calculator`) that stores a **single** `weightKg` value — the current snapshot used in the Ten Haaf & Weijs REE formula. There is no history of weight over time, and no signal back to the user about whether the chosen nutrition strategy is producing the intended weight change.

The user weighs in daily — typically first thing in the morning under standardised conditions — but reading day-to-day weight in isolation is unreliable: swings of 1–2 kg from water, food in gut, sodium, glycogen, and (for women) the menstrual cycle routinely obscure the actual trend. Standard practice in evidence-based nutrition is to (a) smooth daily readings with a moving average and (b) evaluate change as a **percentage of body weight per unit time** — typically per week (actionable) and per 28-day mesocycle (reviewable).

Forkcast currently has no chart anywhere in the codebase. No charting library is installed.

## Goals / Non-Goals

**Goals:**
- Capture one weight reading per calendar date with friction comparable to the existing meal-log flow (open app → enter weight → done in under five seconds).
- Compute a **trend weight** (7-day moving average) and three rate-of-change indicators that map directly to evidence-based fitness coaching language (weekly rate, 28-day change, total change), so the user can answer "is my approach working?" within a sensible review window.
- Visualise raw entries + the moving average on a single chart with a range selector, mobile-first.
- Surface the trend value back into the macro-calculator flow so the user's macros can stay anchored to the smoothed trend instead of a single noisy morning reading.
- Persist robustly via the same one-file-per-repo JSON convention used for body-profile, nutrition-goal, log-entries, and recipes — no new persistence machinery.

**Non-Goals:**
- No automatic write-through from the weight log to `BodyProfile.weightKg`. The body-profile form gets a *suggestion* button, not silent sync — the user owns the decision when to refresh macros.
- No body-fat %, no measurements (waist/hip/etc.), no progress photos. v1 is scalar weight only.
- No alerts / coaching ("you're losing too fast"). The numbers speak for themselves; the user is an informed adult.
- No goal periodisation, refeeds, diet breaks. Same scope philosophy as the macro calculator.
- No multi-user separation beyond the existing single-user auth.
- No data export / CSV download in v1. Easy to add later if needed.
- No timezone handling beyond `YYYY-MM-DD` strings produced by the client. The app is single-user, single-locale; dates are local civil dates.

## Decisions

### Trend indicators: 7-day moving average + weekly / 28-day / total deltas

The 7-day moving average is the de-facto standard "trend weight" in serious weight-tracking (Hacker's Diet → Libra → Happy Scale). One full week captures both weekend and weekday eating patterns and absorbs the bulk of daily noise. Shorter (3-day) is jittery; longer (14-day) lags too much to be actionable.

Rate-of-change definitions (all computed on the **7d MA**, never on raw daily readings):

- **Weekly rate %** = `(MA7(today) − MA7(today − 7d)) / MA7(today − 7d) × 100`
- **28-day change %** = `(MA7(today) − MA7(today − 28d)) / MA7(today − 28d) × 100`
- **Total change %** = `(MA7(today) − MA7(firstAvailableWindow)) / MA7(firstAvailableWindow) × 100`

**Why the weekly rate is the primary indicator:** rate-of-change-per-week is the language used in evidence-based nutrition coaching. Sustainable fat-loss target is roughly 0.5–1.0 %/week of body weight; faster than that typically costs lean mass. Anything slower at meaningful intake levels means the deficit isn't real. One single number, one interpretation rule.

**Why 28 days as the secondary review window:**
- It's the standard "mesocycle review" length in periodised training programs (Renaissance Periodization, Mike Israetel, Helms et al.) — long enough for the trend to outrun daily noise plus a menstrual cycle, short enough to remain actionable.
- A calendar month varies (28–31 days); fixing it at 28 keeps the indicator comparable week-over-week.
- The product spec asked for "a timeframe that makes sense" — 28 days is that answer, with the weekly rate as the more actionable companion.

**Why also expose total change:** lets the user see cumulative progress over a cut/bulk cycle without doing the math, and serves as a sanity-check that the moving averages are anchored to a real starting point.

**Alternatives considered:**
- *Raw delta in kg.* Rejected as primary — body-weight-relative % is the apples-to-apples coaching metric; raw kg is exposed in the UI as a secondary line but not as the headline number.
- *EMA (exponentially-weighted moving average) à la Hacker's Diet.* More mathematically elegant; users find it harder to reason about ("why is my trend still high when I weighed in light today?"). Stick with the simple-mean MA7 — easier to explain, easier to test, and good enough.
- *14-day MA / 30-day rate.* Slower to react; loses the "is my current week on track?" signal. Rejected.

### Sparse-data handling

Real users miss weigh-ins. The computation must not require seven consecutive days.

- `MA7(d)` is defined as **the mean of all weight entries with date in `[d − 6, d]` inclusive**, **provided the window contains ≥ 4 entries**. Fewer than 4 entries → MA is `null` (insufficient data). The threshold of 4 trades off noise vs. data availability; with 3 or fewer points the average is dominated by individual days.
- All trend indicators that depend on a missing MA endpoint return `null`. The UI renders `—` and a one-line explanation.
- The "first available window" for the total-change indicator is the earliest 7-day window with ≥ 4 entries.
- Daily chart points are drawn at their actual dates (no interpolation). The MA line is drawn only across dates where MA is defined; a gap in the MA line is acceptable and informative.

### Domain model & persistence

New aggregate `WeightEntry`:

```ts
interface WeightEntry {
  date: string;     // YYYY-MM-DD, the natural key. One entry per date — upsert.
  weightKg: number; // > 0, ≤ 500 sanity bound.
}
```

Persisted as `./data/weight-log.json` (a JSON array, append-or-upsert by `date`). One file per repo, mirroring `./data/body-profile.json`, `./data/log-entries.json`, etc.

Repository port `WeightLogRepository` exposes:
- `list(): Promise<WeightEntry[]>` — full history, sorted ascending by date.
- `upsert(entry: WeightEntry): Promise<void>` — idempotent by date.
- `remove(date: string): Promise<void>` — no-op if absent.

Implements `Initializable` (creates parent dir if absent), registered in the `bootstrap([...])` array exactly like `JsonBodyProfileRepository`.

**Why upsert by date** (not append-only): the user might log an estimated weight in the morning and correct it later. Date is the natural unit of identity; making the entry idempotent removes a class of bugs ("I see 14 entries for last Tuesday").

**Why a separate JSON file** (not embedded in `body-profile.json`): the body profile is a single record; the weight log is a growing list. Mixing them complicates atomic writes and balloons the read cost of unrelated reads.

### Trend computation: pure functions in the domain layer

Two top-level pure functions in `backend/src/domain/weight-log/trend.ts`:

```ts
function computeMovingAverage(
  entries: WeightEntry[],
  asOf: string,
  windowDays = 7,
  minEntries = 4,
): number | null

function computeTrend(
  entries: WeightEntry[],
  asOf: string,
): {
  current: number | null;        // raw weight on `asOf` if present
  movingAverage7d: number | null;
  weeklyRatePercent: number | null;
  changePercent28d: number | null;
  totalChangePercent: number | null;
  firstEntryDate: string | null;
  totalEntries: number;
  lastEntryDate: string | null;
}
```

Both are deterministic, side-effect-free, and exhaustively unit-tested. `asOf` defaults to "today" at the use-case layer; the pure functions take it as input so the tests can replay any history without faking time.

The HTTP layer does **no** computation; it calls `computeTrend` and serialises the result. The frontend has a **client-side mirror** of `computeTrend` (same algorithm, copied) so the chart and stats update instantly as the user types — same approach as `compute-preview.ts` in body-profile. Both implementations share a `trend.test.ts` test corpus to guarantee they don't drift.

### API surface (domain language)

Following the existing pattern (verb-oriented under a resource-style root):

- `POST /weight-log` — body `{ date, weightKg }`, upserts. Returns the entry and the updated trend.
- `GET /weight-log?from=YYYY-MM-DD&to=YYYY-MM-DD` — list entries; optional date filter. Default: all entries.
- `DELETE /weight-log/:date` — removes the entry for that date (idempotent — 204 even if absent, to keep the client simple).
- `GET /weight-log/trend?asOf=YYYY-MM-DD` — compute the trend as of the given date (defaults to today). Returns the `computeTrend` payload above.

The chart pulls `GET /weight-log` (raw list) + `GET /weight-log/trend` together via React Query. The frontend computes the per-point MA itself so the chart can re-smooth instantly when the range selector changes; the backend `/trend` endpoint is the authoritative "headline numbers" source.

### Frontend: feature folder layout

```
frontend/src/features/weight-log/
  weight-log-card.tsx          // inline quick-entry card for the daily-log screen
  weight-tracker-screen.tsx    // the dedicated screen
  weight-chart.tsx             // hand-rolled SVG line+dot chart
  weight-chart.test.tsx
  weight-stats.tsx             // the four headline stat cards
  weight-history-list.tsx      // recent entries with edit / delete
  trend.ts                     // pure mirror of backend trend.ts
  trend.test.ts                // shared corpus with backend
```

The chart is **a single React component** rendering raw SVG: a viewBox, a path for the MA line, circles for raw entries, two axis lines with three to five tick labels, and a thin "today" guideline. ~150 LoC. No animation v1. The range selector is a row of buttons (`30d / 90d / 180d / 365d / all`). Tapping a button changes the visible window — both the chart and the moving-average computation recompute on the visible window (so the MA "warms up" cleanly when changing range; this matters for the "all" view starting from sparse early data).

### Where in the app

The user weighs in once a day — typically right after waking, before opening the food log for the day. So the weight entry is **paired with the day**, not buried in settings. Concretely:

- **Daily-log screen**: a thin `WeightLogCard` sits above (or just below) the day-totals header. States:
  - No entry yet for today → "Tap to log today's weight" with a numeric input on tap.
  - Entry exists → shows `78.4 kg · 7d avg 78.2 kg (−0.4 %/wk)` and a small edit affordance.
  - Tapping the card's "Open weight tracker" link navigates to the dedicated screen.
- **Weight Tracker screen**: dedicated screen reachable from Settings → "Weight tracker". Layout (top to bottom): stat cards row, chart with range selector, history list with edit/delete.
- **Body-profile form**: if the backend trend response includes a current MA, render a small hint row near the `weightKg` input: `"Trailing 7d avg: 78.2 kg · Use this"` — clicking the link sets the form's weight to that value (without saving). Hidden if MA is `null`.

**Why not add a top-level "Weights" tab to the bottom nav:** the existing `bottom-navigation` spec is explicit that there are *exactly three tabs* (Log / Recipes / Settings). The MVP doesn't justify renegotiating that contract; the inline card + Settings entry gets daily entry in one tap on the screen the user already opens to log food.

### Chart: recharts

The chart uses [`recharts`](https://recharts.org). The hand-rolled SVG version we started with rendered correctly but looked unfinished — sparse axes, awkward tick placement on narrow viewports, no hover tooltips. Recharts gives us robust auto-scaled axes, collision-avoiding date ticks, a clean grid, and free hover tooltips for the bundle-size cost.

Implementation:
- `<ResponsiveContainer>` for fluid width.
- Two `<Line>` series: one with invisible stroke + visible dots for raw entries, one with a stroked line + no dots for the 7-day moving average.
- `connectNulls={false}` on both — gaps in the MA (sparse windows) stay as gaps, never interpolated.
- Custom tooltip component reading `payload[0].payload` to show date + raw weight + MA.
- Time-scale X axis with `minTickGap={32}` so tick labels never overlap on small screens.

**Alternative considered:** `visx` primitives — would have saved bundle weight but required hand-writing tooltips and axis-collision logic. Not worth it for the size of this chart. **uPlot** — fastest of the bunch but imperative/canvas, awkward inside React.

**Test note:** `<ResponsiveContainer>` measures its container, which jsdom doesn't simulate. Tests mock it with a fixed-size div and assert against `data-raw-count` / `data-has-ma` attributes the component exposes for that purpose.

### Validation rules (Zod, shared shape between backend and frontend)

- `date`: `YYYY-MM-DD`, parseable as a real date, not in the future (server clamps to today's date as a soft guard; UI prevents future selection).
- `weightKg`: positive, ≤ 500. Two decimals max (rounded server-side).

### i18n

All new strings added to `frontend/src/i18n/de.ts` under a `weightLog` namespace. Phrases include: form labels, stat-card titles, range-selector labels, empty-state hints, validation messages, the "Use this trailing avg" hint on the body-profile form.

## Risks / Trade-offs

- **Risk:** sparse data produces null MAs, leading to a UI dominated by `—`. **Mitigation:** the empty/sparse states get explicit copy ("Log at least 4 days in the last week to see your trend"). The chart still renders raw points so the user sees their entries even before the MA is meaningful.
- **Risk:** the user has multiple weigh-ins per day (e.g. tests a scale). **Mitigation:** explicit upsert-by-date; the last write wins. Documented in the use-case test.
- **Risk:** the client-side mirror of `computeTrend` drifts from the backend. **Mitigation:** identical test corpus (`trend.test.ts` lives in both packages and asserts against the same fixture JSON). A failed shared test breaks both builds. Same pattern used by `compute-preview.ts` in body-profile.
- **Risk:** body-profile weight and the weight log drift (user logs daily weights but never refreshes macros). **Mitigation:** the "Use this trailing avg" hint surfaces the discrepancy at the moment the user is on the macro form. Not solved silently — the user owns the decision.
- **Risk:** chart edge cases on small viewports (e.g. very dense 1-year view on a 360 px screen). **Mitigation:** the SVG viewBox + responsive width fixes geometry; dot radius scales down at higher densities. The 30/90 day views are the primary use case and are spacious.
- **Risk:** time-zone bugs (UTC vs local). **Mitigation:** all dates are local-civil `YYYY-MM-DD` strings produced on the client. The backend stores them verbatim and never converts.
- **Trade-off:** adding recharts to the bundle (~95 KB gzipped) for a single chart. Accepted because the hand-rolled SVG version (which we tried first) looked plain and would have grown bugs as we added tooltips and smart tick placement.

## Migration Plan

No data migration. The `BodyProfile.weightKg` field stays exactly as it is; no schema change there. The new `./data/weight-log.json` is created on first write (empty file otherwise). Existing users see an empty Weight Tracker until they log their first entry.

Rollback is delete the new feature folders and the data file. No coupling to other state.

## Open Questions

- None blocking. Future revisions to consider once the feature is in use: hover tooltips on the chart, optional auto-sync from latest weight to `BodyProfile.weightKg`, body-fat % field, CSV export.
