## Why

The ingredient picker currently shows nutrient density per single unit — e.g. "3.7 kcal / g" for oats, "0.011 kcal / g" for the protein of milk. These per-gram numbers are noisy (lots of decimals) and don't match how every other nutrition app (fddb, yazio, MyFitnessPal) or the nutrition label on a package presents the data: per 100g for solids, per 100ml for liquids. Users coming from those apps mentally do the ×100 conversion every time they read a row, which is friction the picker should absorb.

A second, smaller motivation: the codebase carries a misleading type name. The TypeScript type `MacrosPer100` is what `IngredientSearchResult.macrosPerUnit` and `LogEntry.ingredient.macrosPerUnit` annotate — but those fields store per-unit values (mapped by dividing by 100 at the boundary). The type-name lies about its values. While we're touching this area for display reasons, rename the type to `MacrosPerUnit` so type and value semantics agree.

## What Changes

- Picker rows in `search-panel.tsx`, `recent-panel.tsx`, and `full-entry-confirm.tsx` MUST display nutrient values per 100 of the row's unit (e.g. "370 kcal / 100g" for oats, "47 kcal / 100ml" for milk).
- The denominator label MUST be `100${unit}` derived from `IngredientSearchResult.unit` (so `100g`, `100ml`, `100piece`, etc.).
- The i18n helpers `de.searchPanel.kcalPer` and `de.recentPanel.kcalPer` are updated (or replaced) to accept per-100 values and a `100${unit}` label.
- **Storage shape is unchanged.** `IngredientSearchResult.macrosPerUnit`, `LogEntry.ingredient.macrosPerUnit`, and recipe ingredient rows continue to carry per-unit values. The ×100 multiplication happens only at render time.
- **Type rename (non-breaking refactor):** `MacrosPer100` → `MacrosPerUnit` across backend and frontend. The on-disk JSON shape, HTTP wire shape, and the curated `FoodEntry.macrosPer100` field stay the same (the latter genuinely is per-100).

## Capabilities

### New Capabilities

- `nutrient-display-format`: Defines the canonical display format for nutrient density in ingredient picker UIs (per-100 with unit-aware denominator) and the rule that storage shape and display shape are decoupled.

### Modified Capabilities

<!-- None. No existing capability spec defines picker display format, so this is a brand-new behavioral spec. Storage-shape behavior in recently-used-ingredients and recipes is unaffected. -->

## Impact

**Frontend (display):**
- `frontend/src/features/log-ingredient/search-panel.tsx` — picker results row format
- `frontend/src/features/log-ingredient/recent-panel.tsx` — recent items row format
- `frontend/src/features/log-ingredient/full-entry-confirm.tsx` — confirm step macro readout
- `frontend/src/i18n/de.ts` — `kcalPer` helpers for searchPanel and recentPanel
- Tests for each of the above

**Type rename (mechanical, non-behavioral):**
- `backend/src/domain/meal-log/types.ts` (`MacrosPer100` declaration)
- `backend/src/domain/ingredient-search/types.ts` (importer)
- `backend/src/domain/ai-recipe-import/types.ts` (importer)
- Any other backend/frontend modules importing `MacrosPer100`
- All tests referencing the name

**Not impacted:**
- Persistence (JSON files keep current shape)
- HTTP wire format (field names unchanged)
- `FoodEntry.macrosPer100` (still per-100, by design)
- OFF mapper / FOODS mapper logic
- Daily-log, recipe view, and any other macro display surfaces outside the picker flow
