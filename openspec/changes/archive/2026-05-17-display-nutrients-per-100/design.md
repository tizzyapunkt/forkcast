## Context

The picker today displays per-unit macros, e.g. `3.7 kcal / g` for oats — produced by the i18n helper `de.searchPanel.kcalPer(macrosPerUnit.calories, unit)`. The values come from `IngredientSearchResult.macrosPerUnit`, which is derived by dividing the source's per-100 values by 100 at the boundary (in `mapFoodEntry` and `mapOffProduct`). The same per-unit form is then stored in `LogEntry.ingredient.macrosPerUnit` and recipe ingredient rows because total computation is `macrosPerUnit * amount` — a single multiplication regardless of unit.

The display problem is purely cosmetic, but it sits on top of a naming inconsistency: the *type* annotating `macrosPerUnit` is `MacrosPer100` (declared in `backend/src/domain/meal-log/types.ts`). The type-name lies about its values. This change addresses both at once.

Three picker display sites exist:
- `search-panel.tsx` — search result row, single kcal value (uses `de.searchPanel.kcalPer`)
- `recent-panel.tsx` — recent items row, single kcal value (uses `de.recentPanel.kcalPer`)
- `full-entry-confirm.tsx` — confirm step, shows all four macros (uses `de.fullEntry.perUnit`)

## Goals / Non-Goals

**Goals:**
- Picker displays nutrient density in the format users recognize from nutrition labels and competing apps: per 100g for solids, per 100ml for liquids.
- Picker rows are less decimally noisy (`370 kcal / 100g` vs `3.7 kcal / g`).
- Type and value semantics agree: rename `MacrosPer100` → `MacrosPerUnit`.
- TDD: failing display tests before code changes.

**Non-Goals:**
- Changing storage shape. `LogEntry`, recipes, and `IngredientSearchResult` keep per-unit values.
- Migrating any JSON data on disk.
- Changing wire format between backend and frontend.
- Touching macro display surfaces outside the picker flow (daily log, recipe view).
- Liquid-aware unit detection in the OFF mapper — that's a separate change.
- Renaming `FoodEntry.macrosPer100` (its values genuinely are per-100).

## Decisions

### D1: Multiply at render time; do not change storage

`macrosPerUnit` continues to carry per-unit values. Display sites multiply by 100 (when unit is g/ml) at the moment of rendering.

**Why:** `total = macrosPerUnit * amount` is the hottest path in the codebase. Switching storage to per-100 would mean every total computation pays `* amount / 100`, every existing JSON file would need migration, and the on-disk shape would diverge from already-stored `LogEntry` rows. None of that earns its keep for what is fundamentally a presentation concern.

**Alternative considered:** Store per-100 everywhere. Rejected — high migration cost, no payoff beyond what render-time multiplication achieves.

### D2: Denominator label policy — `100${unit}` for g/ml only

Display rule:

| Row `unit` | Per-100 display       | Format example     |
|------------|-----------------------|--------------------|
| `g`        | yes — `value * 100`   | `370 kcal / 100g`  |
| `ml`       | yes — `value * 100`   | `47 kcal / 100ml`  |
| `piece`    | no — show per-unit    | `80 kcal / piece`  |
| `oz`, `cup`, `tbsp`, `tsp` | no — show per-unit | `Y kcal / cup` |

**Why:** `100piece` and `100cup` are not meaningful units — nutrition labels never say "per 100 pieces". For non-mass/non-volume units, per-unit *is* the natural label. The g/ml gate keeps the rule readable: "per-100 when the unit is a base mass or volume; per-unit otherwise."

In practice today, picker results from FOODS are always `g`/`ml` and OFF results are always `g`, so the fallback rarely fires for search results. But `recent-panel.tsx` mirrors historical `LogEntry` units, which can be any `MeasurementUnit`. The fallback is what keeps that surface sensible.

**Alternative considered:** Always render `100${unit}`. Rejected — produces "100piece" which is nonsense. Adding a singular/plural switch is more code for a worse outcome.

### D3: i18n helper signature change

Replace the existing helpers with denominator-aware versions:

```
de.searchPanel.kcalPer(kcal: number, unit: MeasurementUnit) → "X kcal / 100g" or "X kcal / piece"
de.recentPanel.kcalPer(kcal: number, unit: MeasurementUnit) → same shape
de.fullEntry.perUnit(unit, cals, p, cb, f) → "pro 100g — X kcal · Yg P · Zg K · Wg F" (or "pro piece — …" for non-g/ml)
```

The helpers themselves implement the D2 rule: they receive the raw per-unit value and the unit, multiply when appropriate, and emit the label. This keeps multiplication out of component JSX.

**Why:** Concentrates the per-100 rule in one place (the i18n module), so all three call sites get consistent behavior automatically and the rule is testable in isolation. Components stay declarative.

**Alternative considered:** Multiply at the call site, pass formatted values to the helper. Rejected — three call sites, three chances to drift.

### D4: Type rename `MacrosPer100` → `MacrosPerUnit`

Mechanical sweep, in a single commit:

- Declaration: `backend/src/domain/meal-log/types.ts`
- Importers (grep-driven): `backend/src/domain/ingredient-search/types.ts`, `backend/src/domain/ai-recipe-import/types.ts`, plus any frontend mirrors in `frontend/src/domain/*`
- Tests (all assertions on `macrosPerUnit` shape stay valid — only the type name changes)

`FoodEntry.macrosPer100` (the curated foods type, in `backend/src/domain/foods/types.ts`) is **not renamed** — its values truly are per-100.

**Why:** The current name is a documented footgun in CLAUDE.md territory. Doing it as part of this change avoids a second touch on the same files.

**Alternative considered:** Leave the type-name alone. Rejected — the noise is exactly what makes Change 2 (the OFF liquid-ml work) and any future macro work confusing. Clean it now.

### D5: TDD order

Per project convention, write the failing test first at each step:

1. i18n helper tests (new format with both unit categories).
2. `search-panel.test.tsx`, `recent-panel.test.tsx`, `full-entry-confirm.test.tsx` updated to assert the new format strings.
3. Implementation updated.
4. Type rename codemod last (mechanical; existing tests should pass unchanged once the name is consistent).

## Risks / Trade-offs

- **[Component tests break in flight]** → Mitigation: order the TDD steps so each test is updated immediately before the matching implementation. Run frontend `pnpm --filter @forkcast/frontend test` after each pair to keep the window of red tests narrow.
- **[Type rename touches many files]** → Mitigation: it is a pure rename — `tsc --noEmit` and the existing tests are the safety net. Do the rename as the *last* commit so any preceding work isn't entangled with codemod noise.
- **[Visual regression on units that aren't g/ml]** → Mitigation: the fallback branch (D2) keeps the existing per-unit format intact for those — no user-visible change for non-mass/volume rows. Tests should cover both branches of the helper.
- **[Confusion about why storage stays per-unit]** → Mitigation: short comment near the i18n helper(s) explaining "values are per-unit; we multiply for display". This is the kind of WHY comment that justifies its own existence (CLAUDE.md guidance).
- **[Stale snapshot tests / German number formatting]** → Mitigation: assert string content rather than full snapshots; round/floor consistently in helpers so test expectations are stable.

## Migration Plan

No data migration. No HTTP shape changes. Single PR with the four logical steps above; revert is a `git revert` since storage shape is untouched.
