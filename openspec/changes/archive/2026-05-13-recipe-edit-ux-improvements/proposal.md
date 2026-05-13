## Why

Two friction points around recipes are slowing planning down:

1. Nutrition totals for a recipe are invisible everywhere except a logged meal. The Recipes list shows only the name and meta line, the read (cooking) view shows ingredients and steps but no rollup, and the create/edit form gives no feedback on a recipe's macros until after save → log → check. Iteratively tuning a recipe to a macro target requires a save-and-re-open loop.
2. Seasoning/herb ingredients (Salz, Pfeffer, Knoblauchpulver, …) are typically picked from a FOODS-untracked entry and end up displayed as `1 g`, `5 g`, etc. — but the recipe actually called for `1 TL`, `1 EL`, or `1 Prise`. The rendered amount is misleading when cooking from the recipe, and AI import sometimes can't extract any amount at all (e.g. when the photo lists "Salz n. Geschmack" or only the video instructions mention the amount), leaving the row in an ambiguous state.

## What Changes

- Add a pure, shared **`computeRecipeTotals(ingredients, yield)`** helper in the frontend domain. Returns `{ total: MacrosPer100; perServing: MacrosPer100 }` where untracked rows are excluded from the rollup. Used by every surface listed below so the totals story stays consistent.
- **Recipes list (`recipes-screen.tsx`)** — each row gains a compact macro line under the recipe name: per-serving `kcal · P / C / F` (e.g. `420 kcal · 32 P / 18 C / 22 F`). Computed from the cached recipe via `computeRecipeTotals`.
- **Recipe read / cooking view (`recipe-detail.tsx`)** — add a totals strip near the top showing the same metric set, with a visible toggle (or dual line) for "per serving" vs. "total recipe". Totals MUST react to the servings multiplier already on this view: changing the multiplier rescales the displayed totals using the same factor (untracked rows contribute zero regardless).
- **Recipe create / edit form (`recipe-form.tsx`)** — add a live totals strip above the action buttons (or below the ingredient editor) that updates as ingredients are added, replaced, edited, or toggled untracked.
- Add an optional **free-form display quantity** on untracked ingredient rows: `displayQuantity?: { amount: number; unitLabel: string }`. When present, the form, the read view, and the recipe list render the untracked row as `{amount} {unitLabel}` (e.g. `1 TL`, `1 Prise`, `Schuss`) instead of `{amount} {unit}`. Tracked rows are unaffected.
- Add an **inline "add quantity" affordance** on every untracked row. When `displayQuantity` is absent, the affordance reads `+ Menge` and opens a small inline editor (number + free-text unit label). When present, the same area becomes the editor for that quantity (count + label). Saving writes/updates `displayQuantity`; clearing removes it.
- **BREAKING (spec-level only, data-compatible)**: Relax the existing "Untracked still requires amount and unit" rule so that an untracked row MAY persist with the canonical `amount` left at a placeholder (the row still carries a valid `unit` per the enum for shape stability, and `amount` still must be a finite number ≥ 0). When `displayQuantity` is present it is the source of truth for display; when absent, the canonical mass/volume is shown as today. No existing recipe data becomes invalid.
- **AI import preserves textual units** for untracked rows. When the raw extraction yields an amount/unit that isn't in `MeasurementUnit` (e.g. `TL`, `EL`, `Prise`, `Schuss`) AND the matched FOODS entry is untracked, the importer populates `displayQuantity = { amount, unitLabel }` on the matched row. When neither amount nor unit could be extracted, `displayQuantity` is left absent so the UI surfaces the "Menge ergänzen" affordance.
- **Yield scaling honors `displayQuantity`** the same way it scales `amount` and `pieceQuantity.amount`: multiply `displayQuantity.amount` by the factor; `unitLabel` is invariant.

## Capabilities

### New Capabilities
<!-- none — all changes are additive requirements on existing capabilities -->

### Modified Capabilities
- `recipes`: ingredient shape gains optional `displayQuantity`; the "untracked requires amount" rule is relaxed; the recipes list row, the read view, and the form all render nutrition totals; the read view and form honor `displayQuantity` on untracked rows; yield scaling propagates `displayQuantity.amount`.
- `ai-recipe-import`: the importer populates `displayQuantity` on untracked matched rows when the raw text carried a textual unit outside `MeasurementUnit`.

## Impact

- **Frontend domain** — `frontend/src/domain/recipes.ts` (add `displayQuantity` to `RecipeIngredient`), new `frontend/src/domain/recipe-totals.ts` (pure `computeRecipeTotals`), `frontend/src/domain/scale-recipe-ingredients.ts` + `scale-ingredient.ts` (scale `displayQuantity.amount`).
- **Frontend UI** — `recipes-screen.tsx` (macro line per row), `recipe-detail.tsx` (totals strip reacting to multiplier; render `displayQuantity` on untracked rows), `recipe-form.tsx` (live totals strip), `recipe-ingredient-editor.tsx` (inline `displayQuantity` editor for untracked rows + "+ Menge" affordance), `review-import-screen.tsx` (carry `displayQuantity` through from draft to form state).
- **Backend** — `backend/src/domain/recipes/types.ts` (add `displayQuantity` to `RecipeIngredient`), `validate-ingredient-shape.ts` (validate the new field shape; relax untracked-amount rule), `add-recipe.use-case.ts` / `update-recipe.use-case.ts` request schemas pass-through, `recipes.handler.ts` HTTP schemas. JSON store is data-compatible.
- **Backend (AI import)** — `domain/ai-recipe-import/types.ts` (`RawIngredient` keeps the textual unit + amount when the unit is outside the enum), `recipe-draft-extractor.ts` (Anthropic prompt + parser preserve raw `displayQuantity` candidates), `import-recipe-from-photos.use-case.ts` (set `displayQuantity` on matched-and-untracked rows).
- **i18n** — new `de` strings for the totals strip (`Pro Portion`, `Gesamt`, `kcal`, `P/C/F`), for the macro line on the list row, for the "Menge ergänzen" affordance, and for the inline display-quantity editor labels.
- **Tests** — TDD per CLAUDE.md: domain tests for `computeRecipeTotals` (tracked sum, untracked excluded, per-serving math, empty list), validator tests for the relaxed rule + new field, use-case tests for AI import populating `displayQuantity`, RTL tests for live totals updating on every editor action, RTL tests for the multiplier rescaling totals on the read view, RTL test for the recipes list macro line.
- **No deps added.** No new API surface (existing add-recipe / update-recipe payloads gain an optional field).
- **No data migration** required — `displayQuantity` is optional and absent on every existing record.
