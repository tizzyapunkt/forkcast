## 1. i18n helpers (per-100 rule)

- [x] 1.1 Write failing tests for `de.searchPanel.kcalPer(value, unit)`: `(3.7, 'g') → "370 kcal / 100g"`, `(0.47, 'ml') → "47 kcal / 100ml"`, `(80, 'piece') → "80 kcal / piece"`, `(2, 'cup') → "2 kcal / cup"`
- [x] 1.2 Write failing tests for `de.recentPanel.kcalPer(value, unit)` with the same input/output pairs as 1.1
- [x] 1.3 Write failing tests for `de.fullEntry.perUnit(unit, cals, p, cb, f)`: for `('g', 3.7, 0.13, 0.66, 0.07)` produce `"pro 100g — 370 kcal · 13g P · 66g K · 7g F"`; for `('ml', 0.47, 0.034, 0.05, 0.018)` produce `"pro 100ml — 47 kcal · 3g P · 5g K · 2g F"`; for `('piece', 80, 4, 12, 2)` produce `"pro piece — 80 kcal · 4g P · 12g K · 2g F"`
- [x] 1.3b Write failing tests for `de.recipeIngredientPicker.perUnit(unit, cals, p, cb, f)` with the same input/output expectations as 1.3 (scope-extended at apply time to keep all picker surfaces consistent)
- [x] 1.4 Implement the four helpers in `frontend/src/i18n/de.ts` (searchPanel.kcalPer, recentPanel.kcalPer, fullEntry.perUnit, recipeIngredientPicker.perUnit). Centralize the g/ml multiply-by-100 rule in a single internal function used by all four. Round displayed values consistently (`Math.round` matches the existing `MacroChip` rounding)
- [x] 1.5 Verify all helper tests pass; run `pnpm --filter @forkcast/frontend test`

## 2. Search panel (search-panel.tsx)

- [x] 2.1 Update `search-panel.test.tsx` to assert the new `"X kcal / 100g"` / `"X kcal / 100ml"` strings on the rendered rows (replace any prior assertions on the per-unit format)
- [x] 2.2 Confirm `search-panel.tsx:177` still calls `de.searchPanel.kcalPer(result.macrosPerUnit.calories, result.unit)` — no JSX changes required since the helper now owns the rule
- [x] 2.3 Run `pnpm --filter @forkcast/frontend test -- search-panel` and ensure green

## 3. Recent panel (recent-panel.tsx)

- [x] 3.1 Update `recent-panel.test.tsx` to assert the new `"X kcal / 100g"` / `"X kcal / 100ml"` / `"X kcal / piece"` strings
- [x] 3.2 Confirm `recent-panel.tsx:71` still calls `de.recentPanel.kcalPer(recent.macrosPerUnit.calories, recent.unit)`
- [x] 3.3 Run `pnpm --filter @forkcast/frontend test -- recent-panel` and ensure green

## 4. Full-entry confirm (full-entry-confirm.tsx)

- [x] 4.1 Update `full-entry-confirm.test.tsx` to assert the new `"pro 100g — …"` / `"pro 100ml — …"` / `"pro piece — …"` string on the per-unit readout (line ~77)
- [x] 4.2 Confirm `full-entry-confirm.tsx:77` still passes `(result.unit, m.calories, m.protein, m.carbs, m.fat)` — no JSX changes required
- [x] 4.3 Verify the total-line below (`MacroChip` with `m.calories * amount` etc.) is **unchanged** — it shows the total for the entered amount, not per-unit
- [x] 4.4 Run `pnpm --filter @forkcast/frontend test -- full-entry-confirm` and ensure green

## 4b. Recipe-ingredient picker (recipe-ingredient-picker.tsx)

- [x] 4b.1 Confirm `recipe-ingredient-picker.tsx:158` still passes `(result.unit, ...macrosPerUnit fields)` — no JSX changes required since the helper now owns the rule
- [x] 4b.2 `recipe-ingredient-picker.test.tsx` asserts no display strings on the per-unit row; no test updates needed beyond confirming green
- [x] 4b.3 Run `pnpm --filter @forkcast/frontend test -- recipe-ingredient-picker` and ensure green

## 5. Type rename `MacrosPer100` → `MacrosPerUnit`

- [x] 5.1 Rename the type declaration in `backend/src/domain/meal-log/types.ts` (`export interface MacrosPer100` → `export interface MacrosPerUnit`)
- [x] 5.2 Update all backend importers and references: `backend/src/domain/ingredient-search/types.ts`, `backend/src/domain/ai-recipe-import/types.ts`, plus any others surfaced by `grep -rn "MacrosPer100" backend/src`
- [x] 5.3 Update frontend mirrors in `frontend/src/domain/meal-log.ts` and `frontend/src/domain/ingredient-search.ts` (or wherever the type is re-exported/duplicated), plus any frontend references via `grep -rn "MacrosPer100" frontend/src`
- [x] 5.4 Confirm `FoodEntry.macrosPer100` in `backend/src/domain/foods/types.ts` is **not** renamed (it really is per-100)
- [x] 5.5 Run `pnpm --filter @forkcast/backend typecheck` and `pnpm --filter @forkcast/frontend typecheck`
- [x] 5.6 Run full test suites: `pnpm --filter @forkcast/backend test` and `pnpm --filter @forkcast/frontend test`

## 6. Manual smoke test

- [x] 6.1 Disable HTTPS in `vite.config.ts` per the project smoke-testing convention
- [x] 6.2 Start the dev server: `pnpm dev`
- [x] 6.3 Open the log drawer in the browser and pick an ingredient from search — verify a `g`-unit row shows `"X kcal / 100g"`, an `ml`-unit row (FOODS liquid, e.g. milk) shows `"X kcal / 100ml"`
- [x] 6.4 Open the recent panel — verify the same format applies; if any historical entry uses `piece`, verify it falls back to `"X kcal / piece"`
- [x] 6.5 In the full-entry confirm step, verify the per-unit readout shows `"pro 100g — …"` (or `100ml`) and that the totals line still reflects the typed amount
- [x] 6.6 Re-enable HTTPS in `vite.config.ts`

## 7. Wrap-up

- [x] 7.1 Run lint: `pnpm --filter @forkcast/frontend lint` and `pnpm --filter @forkcast/backend lint`
- [x] 7.2 Run format: `pnpm --filter @forkcast/frontend format` and `pnpm --filter @forkcast/backend format`
- [ ] 7.3 Commit in logical chunks: (a) i18n helpers + tests, (b) component test updates, (c) type rename
