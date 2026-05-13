## Context

The daily log screen (`frontend/src/features/daily-log/`) renders one card per meal slot. Today:

- `slot-card.tsx` shows the slot's kcal total and a compact inline macro line (`· 30g P · 50g K · 12g F`) in the header — only when macros are present and non-zero.
- `entry-row.tsx` renders a single entry: name, optional recipe hint, optional amount input, and **only kcal** on the right side. Macro data is fully available on the entry payload (`ingredient.macrosPerUnit * amount` for `full`, `ingredient.{protein,carbs,fat}` for `quick`).
- Backend (`get-daily-log.use-case.ts`) already computes per-slot and per-day `DayTotals` including macros and a `macrosPartial` flag. No backend change is required.

Constraint: mobile-first, single-column, narrow viewport. Entry rows are dense; adding four numbers without restraint will visually crowd the row.

## Goals / Non-Goals

**Goals:**
- Surface protein/carbs/fat per entry on the daily log.
- Make per-slot kcal+macro totals visually clear (not just a footnote).
- Stay within the existing data already returned by `GET /daily-log`.
- Handle quick entries lacking macros without printing fabricated zeros.

**Non-Goals:**
- No changes to API shape, persistence, or domain model.
- No new aggregation logic — backend totals are already correct.
- No redesign of the slot card's chrome (border, padding, add button) or of `inline-amount-input` interaction.

## Decisions

### Decision 1: Render per-entry macros inline using the existing `de.dailyLog.macroInline(p, c, f)` helper

Reuse `de.dailyLog.macroInline` (currently used by `slot-card`) to format the macro suffix on `entry-row`. One i18n function, one visual style for "macros next to kcal."

**Why:** Keeps the visual language consistent across entry row and slot header. No new copy strings. Already rounds to integers.

**Alternative considered:** A new `entryRow.macroInline` with shorter glyphs (e.g. `30/50/12`). Rejected — inconsistent with slot header would be more confusing than gaining a few px.

### Decision 2: Per-entry macros render only when complete (full entry, or quick entry with all three macro fields)

For `full` entries macros are always derivable. For `quick` entries the macro fields are optional (`protein?`, `carbs?`, `fat?`); when any is missing show **kcal only** on that row — no `0` placeholders. This matches the `macrosPartial` philosophy already in `DayTotals`.

**Why:** A `0` next to a quick entry like "Coffee" reads as "this has zero protein" when in fact macros were never entered. Truthful absence is better than fake precision.

### Decision 3: Slot total layout — promote macros to a second line under the slot title

Today the slot total renders inline on the title row: `Breakfast    340 kcal · 30g P · 50g K · 12g F   +`. On narrow viewports this either wraps awkwardly or pushes the `+` button. Move the macro line to a second row directly under the slot title, kcal stays on the right of the title row.

**Why:** Improves legibility on mobile, gives macros visual weight equal to kcal without crowding the action button. Preserves the existing inline formatting helper.

**Alternative considered:** Keep everything inline and shrink the font. Rejected — readability is already tight.

### Decision 4: Quick entries without macros do not affect slot total macro display logic

`slot-card.tsx` already guards on `!totals.macrosPartial`. Keep that exactly. If any quick entry in the slot lacks macros, the slot's macro line is suppressed (kcal still shown). This is current behavior — no change.

## Risks / Trade-offs

- **[Risk]** Adding three numbers per entry row could overflow on narrow viewports for long ingredient names. **Mitigation:** Right-side cluster uses a single inline string (kcal + macro suffix); `flex-shrink-0` on the right cluster pushes truncation to the name column. Verify via smoke test on a mobile viewport.
- **[Risk]** Users used to seeing only kcal per entry may find the row visually noisier. **Mitigation:** Macros use the existing smaller/muted style (`text-xs text-muted-foreground`) — already validated visually on the slot header.
- **[Trade-off]** Reusing `dailyLog.macroInline` ties entry-row and slot-header formatting together. If we later want them to diverge, we'll need to split the helper. Acceptable — premature split would be over-engineering.

## Migration Plan

No data, no API, no flag. Ship the UI change. Rollback = revert the PR.
