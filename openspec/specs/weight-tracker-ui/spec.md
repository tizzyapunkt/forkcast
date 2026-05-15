# weight-tracker-ui

## Purpose

Expose the `weight-log` capability through the frontend: an inline quick-entry card on the daily-log screen so the daily weigh-in stays one tap away, a dedicated Weight Tracker screen reachable from Settings with stat cards / chart / history list, and a hint on the body-profile form that lets the macro calculator stay anchored to the smoothed trend instead of a single noisy reading.

## Requirements

### Requirement: Inline quick-entry card on the daily-log screen
The daily-log screen SHALL render a `WeightLogCard` near the top of the screen that lets the user log today's weight without navigating away. The card MUST show different states depending on whether today's entry exists.

- If no entry exists for today, the card MUST show a prompt ("Log today's weight") and expose a numeric input that submits to `POST /weight-log` with `date = today`.
- If an entry exists for today, the card MUST show: today's raw weight, the current 7-day moving average (or `—` when `null`), and the weekly rate (or `—` when `null`). The card MUST expose an affordance to edit today's entry.
- The card MUST always expose a link to the dedicated Weight Tracker screen.

The numeric input MUST accept a decimal weight (e.g. `78.4`) and trigger the device's numeric keyboard on mobile.

#### Scenario: No entry yet for today
- **WHEN** today is `2026-05-15` and no entry exists for that date
- **THEN** the card shows the "Log today's weight" prompt and an input

#### Scenario: Entry exists for today
- **WHEN** today is `2026-05-15` and an entry `{ date: "2026-05-15", weightKg: 78.4 }` exists
- **THEN** the card shows `78.4 kg` alongside the 7-day average and the weekly rate

#### Scenario: Submitting from the card
- **WHEN** the user types `78.4` into the card's input and confirms
- **THEN** the card calls `POST /weight-log` with `{ date: <today>, weightKg: 78.4 }` and updates its display to the "entry exists" state on success

#### Scenario: Card always offers navigation to the dedicated screen
- **WHEN** the card is rendered in any state
- **THEN** an affordance labelled "Weight tracker" navigates to the Weight Tracker screen

### Requirement: Dedicated Weight Tracker screen
The frontend SHALL provide a dedicated screen reachable from the Settings tab labelled "Weight tracker". The screen MUST contain, in this top-to-bottom order: a row of stat cards, a chart with a range selector, and a list of recent entries with edit/delete affordances.

The stat-card row MUST show: current weight, 7-day moving average, weekly rate %, 28-day change %, and total change %. Each card MUST display `—` when the underlying value is `null` and SHOULD include a short explanatory hint in that case (e.g. "Log at least 4 days in the last week").

#### Scenario: Entry from Settings
- **WHEN** the user opens the Settings tab and taps "Weight tracker"
- **THEN** the Weight Tracker screen is rendered

#### Scenario: Stat cards with full data
- **WHEN** the user has 30 days of dense daily entries
- **THEN** all five stat cards show numeric values

#### Scenario: Stat cards with sparse data
- **WHEN** the user has only 2 entries in the trailing 7 days
- **THEN** the 7-day MA card shows `—` with the hint "Log at least 4 days in the last week" and the weekly-rate / 28-day / total cards also show `—`

### Requirement: Weight history chart
The Weight Tracker screen SHALL render a chart that visualises raw daily entries as dots and the 7-day moving average as a continuous line. The chart MUST:

- Honour a range selector with the buttons `30d`, `90d`, `180d`, `365d`, `all`. The default selection MUST be `90d`.
- Draw the MA line only across dates where `MA7` is defined; gaps are acceptable and MUST NOT be interpolated.
- Re-compute the visible MA on the visible window so the average warms up cleanly within the selected range.
- Render an empty-state message ("No weight entries yet") when no entries exist in the visible window.
- Be responsive: the chart MUST scale to the container width on mobile and desktop without overflow.

#### Scenario: Default range is 90 days
- **WHEN** the user navigates to the Weight Tracker screen
- **THEN** the chart's `90d` button is selected and the chart shows entries from the last 90 days

#### Scenario: Changing range
- **WHEN** the user taps the `30d` button
- **THEN** the chart re-renders to show only entries from the last 30 days and the MA line is recomputed accordingly

#### Scenario: Empty state
- **WHEN** the user has logged no entries
- **THEN** the chart shows the empty-state message instead of axes and points

#### Scenario: Gap in MA
- **WHEN** there is a stretch of dates where fewer than 4 entries exist in the trailing 7-day window
- **THEN** the MA line is not drawn across that stretch; the raw dots still appear

### Requirement: History list with edit / delete
The Weight Tracker screen SHALL include a list of recent entries (newest first) showing date and `weightKg`. Each row MUST expose an edit affordance and a delete affordance.

- Edit MUST open an inline input pre-filled with the current value; confirming the edit MUST call `POST /weight-log` with the same date (upsert).
- Delete MUST call `DELETE /weight-log/:date`. The list MUST optimistically remove the row and revert if the request fails.
- After any mutation succeeds, the chart, stat cards, and history list MUST all reflect the new state.

#### Scenario: Edit entry
- **WHEN** the user taps "Edit" on the `2026-05-14` row, changes the value from `78.5` to `78.3`, and confirms
- **THEN** the API receives `POST /weight-log` with `{ date: "2026-05-14", weightKg: 78.3 }` and the row updates to show `78.3`

#### Scenario: Delete entry
- **WHEN** the user taps "Delete" on the `2026-05-14` row and confirms
- **THEN** the API receives `DELETE /weight-log/2026-05-14`, the row is removed from the list, and the chart no longer shows that point

#### Scenario: Mutation invalidates related queries
- **WHEN** any edit or delete succeeds on the Weight Tracker screen
- **THEN** the trend stat cards refresh to reflect the new computation

### Requirement: Body-profile form surfaces the trailing 7-day average
The body-profile form SHALL display a hint near the `weightKg` input showing the current trailing 7-day moving average when it is non-null, with a one-tap action to copy that value into the form's `weightKg` field. The hint MUST NOT trigger any save action by itself — it only updates the form's in-memory value.

When the trend's `movingAverage7d` is `null`, the hint MUST NOT be rendered.

#### Scenario: MA available, user applies it
- **WHEN** the body-profile form is mounted and the current trend response includes `movingAverage7d = 78.2`
- **THEN** the form renders a hint "Trailing 7d avg: 78.2 kg · Use this" and tapping the action sets the form's `weightKg` field to `78.2` without saving

#### Scenario: MA unavailable
- **WHEN** the current trend response has `movingAverage7d = null`
- **THEN** the body-profile form does not render the hint
