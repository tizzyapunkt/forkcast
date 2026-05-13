## Why

The daily log only surfaces calories per logged entry, while the slot header tucks calories and macros into a compact secondary line. To plan against macro goals (protein/carbs/fat — not just kcal), users need to see what each individual entry contributes and what each meal slot totals. Today the per-entry macro data is already in the payload (`ingredient.macrosPerUnit * amount` for full entries, `ingredient.{protein,carbs,fat}` for quick entries) — we just don't render it.

## What Changes

- Show protein, carbs, and fat alongside calories on every meal-log entry row, computed from the ingredient's macros and amount.
- Promote the slot summary line so calories + macros are clearly readable in the slot card header (visual hierarchy, not just a compact afterthought).
- Handle quick entries that lack macro fields (`macrosPartial` case) gracefully — show calories only, no fabricated zeros.
- No API or persistence changes — the data is already returned by `GET /daily-log`.

## Capabilities

### New Capabilities
- `meal-log-display`: Rules for how the daily-log screen surfaces nutrition data — per-entry macros, slot summary line, and handling of incomplete macro data on quick entries.

### Modified Capabilities
- _(none — no existing spec defines daily-log display behavior; this change introduces the first one.)_

## Impact

- **Frontend (UI only):**
  - `frontend/src/features/daily-log/entry-row.tsx` — render macros next to calories.
  - `frontend/src/features/daily-log/slot-card.tsx` — adjust slot summary layout for prominence.
  - `frontend/src/i18n/de.ts` — likely reuse `dailyLog.macroInline` for entry rows, or add a per-entry variant.
  - Tests: `entry-row.test.tsx`, `slot-card`-level coverage in `daily-log-screen.test.tsx`.
- **Backend / API:** none.
- **Domain / persistence:** none.
