## Context

The recipe domain is well-modeled (aggregate `Recipe` with `RecipeIngredient[]`), with strict separation between domain types and HTTP/UI. The frontend has a single editor (`recipe-ingredient-editor.tsx`) reused by both the manual form (`recipe-form.tsx`) and the AI-import review screen (`review-import-screen.tsx`). The read view (`recipe-detail.tsx`) already supports an ephemeral servings multiplier and ingredient scaling via `scale-ingredient.ts`. Untracked ingredients are persisted with `untracked: true` and excluded from the meal-log macro rollup at `domain/meal-log/log-recipe.use-case.ts:27`.

What's missing:
- A per-recipe macro rollup function on the frontend. No `computeRecipeTotals` exists; macro math today only happens inside the meal log on per-LogEntry data.
- A way for untracked rows to carry a recipe-text-faithful unit/amount (`1 TL`, `1 Prise`). Today they share the same `MeasurementUnit` enum (`g | ml | oz | cup | tbsp | tsp | piece`) as tracked rows and render numerically.
- Nutrition feedback during create/edit (deferred until log-time today).

Constraints worth flagging:
- Per CLAUDE.md: pragmatic DDD, hexagonal architecture, TDD-first, behavior tests over framework tests, no new tooling without concrete need.
- JSON file persistence: any schema change must be additive and back-compat. Confirmed by the existing "Backwards-compatible read of legacy ingredient" scenario in `recipes`.
- The existing yield-scaling invariant (`amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece`) must keep holding under scaling — `displayQuantity` must scale alongside `pieceQuantity.amount`.

## Goals / Non-Goals

**Goals:**
- One pure helper (`computeRecipeTotals`) used by every surface that displays totals, so the rollup logic exists in exactly one place.
- A first-class concept for "the unit the recipe actually said" on untracked rows, that round-trips through persistence and AI import without inventing a new ingredient type.
- Live, non-debounced totals feedback in the editor — recompute on every state change (recipes have ≤ a few dozen ingredients; cost is negligible).
- Inline-only UI for editing `displayQuantity` (no modal/sheet), keeping the editor scannable.
- Totals always render the same way: per-serving by default, with the total available; untracked rows always excluded from the rollup but always shown in the ingredient list.

**Non-Goals:**
- No backend-side totals endpoint. Totals are derived on the client from cached recipes.
- No change to how the meal log computes macros for logged recipes — that already excludes untracked rows.
- No textual-unit support on tracked rows. If a user wants `1 EL Olivenöl`, they pick `Olivenöl` (FOODS, ml) and rely on the existing `pieceQuantity` mechanism or accept the ml rendering. This change is scoped to untracked rows only.
- No goal-aware coloring of recipe totals (e.g. green if a recipe fits the day's remaining macros). Out of scope; the `nutrition-progress` helpers stay focused on the day view.
- No quantity unit conversion (the displayed `1 TL` is not auto-converted to grams — for untracked rows it doesn't need to be).

## Decisions

### Decision 1 — Add `displayQuantity` only to untracked rows (vs. broadening `MeasurementUnit`)

Add `displayQuantity?: { amount: number; unitLabel: string }` to `RecipeIngredient`. Domain rule: `displayQuantity` MAY only be present when `untracked === true`. Validator rejects `displayQuantity` on a tracked row.

**Rationale:** The closed `MeasurementUnit` enum is used everywhere macros are computed, including OFF/FOODS source matching, picker filtering, and meal-log rollups. Broadening it would force every consumer to handle a string fallback. Tying free-form units to the existing `untracked` flag scopes the new field to exactly the rows where macros are already ignored, so no rollup code needs a string-unit branch.

**Alternatives considered:**
- Add a separate `unit: 'custom' + unitLabel: string` variant on `MeasurementUnit` — leaks into every macro-aware consumer. Rejected.
- Reuse `pieceQuantity` with `gramsPerPiece: 0` — abuses an invariant (positive grams per piece) and pollutes the existing scenarios. Rejected.

### Decision 2 — Relax "untracked requires amount" → allow `amount = 0` as placeholder

Change the existing requirement so that untracked rows MAY persist with `amount = 0`. Tracked rows still require `amount > 0`. When `displayQuantity` is present on an untracked row, it is the source of truth for the rendered quantity; when absent, the canonical `amount + unit` is shown as today.

**Rationale:** The AI importer sometimes can't extract any amount for a seasoning (e.g. "Salz n. Geschmack"). Today this forces a synthetic amount that has no relation to the recipe. With `amount = 0` permitted, the UI can render the "+ Menge" affordance and the user can later add the textual amount they discovered while watching the video.

**Trade-off:** `amount = 0` on an untracked row is meaningless for any future feature that wants to convert untracked to tracked. Mitigation: the validator still requires a `unit` per the enum (shape stability), and converting an untracked row to tracked will surface a validation error that the user can resolve by setting an amount.

### Decision 3 — `displayQuantity.amount` participates in yield scaling

When the read view or any future planning view scales ingredients by a factor, `displayQuantity.amount` is multiplied by the same factor. `unitLabel` is invariant.

**Rationale:** Doubling a recipe should show "2 TL Salz", not "1 TL Salz". Consistent with how `pieceQuantity.amount` already scales.

**Edge:** Fractional `displayQuantity.amount` is acceptable (e.g. `0.5 TL`) and is rendered via the existing `formatPieceCount` helper.

### Decision 4 — `computeRecipeTotals` lives in `frontend/src/domain/`, returns total + per-serving

Pure function signature:
```
computeRecipeTotals(ingredients: RecipeIngredient[], yieldValue: number): {
  total: MacrosPer100;
  perServing: MacrosPer100;
}
```
Behavior: for each `ingredient` where `untracked !== true`, contributes `macrosPerUnit * amount` to the total. `perServing` is `total / max(yieldValue, 1)`. Empty input → both zero. `yieldValue ≤ 0` → defensively treated as `1`.

**Rationale:** Pure function, framework-free, TDD-friendly. Reused by `recipes-screen.tsx` (per-row line), `recipe-detail.tsx` (top strip + react to multiplier), and `recipe-form.tsx` (live strip).

**Alternatives considered:**
- A React hook (`useRecipeTotals`) — adds React coupling for no benefit. Rejected.
- Compute inside each consumer — duplication; rejected.

### Decision 5 — Live totals in the editor recompute on every state change, no debounce

`recipe-form.tsx` owns the `ingredients` state and renders a `<RecipeTotals ingredients={ingredients} yield={recipeYield} />` strip. Recipes have ≤ a few dozen ingredients; recomputing on every keystroke is cheap, and React batching covers any flicker.

**Trade-off:** Editing a numeric input triggers a recompute per keystroke. Acceptable.

### Decision 6 — On the read view, totals strip reacts to the existing servings multiplier

The read view already keeps `servings` state and uses `factor = servings / recipe.yield` to scale each ingredient row. The totals strip uses the same factor:
- Per-serving total is independent of multiplier (it's always `total / recipe.yield`).
- "Total recipe at chosen multiplier" total is `total * factor / recipe.yield * recipe.yield = total * factor` (i.e. multiplied by `factor`).

To keep the UX scannable, the strip shows two lines: `Pro Portion: X kcal · …` (invariant under multiplier) and `Bei N Portionen: Y kcal · …` (where N = chosen servings). The multiplier label updates with the chosen serving count.

**Rationale:** Aligns with how the multiplier already works for ingredient rows; "per serving" is the most useful headline number for planning.

### Decision 7 — Inline-only editor for `displayQuantity`, with two states

On an untracked row in `recipe-ingredient-editor.tsx`:
- **State A (`displayQuantity` absent)**: render the canonical `amount unit` (as today, muted) AND an inline `+ Menge` button. Tapping reveals a small inline editor (numeric input + free-text input + ✓ / ✕). Saving writes `displayQuantity`. The canonical `amount` stays at whatever it was (typically `0` after import without quantity, or some placeholder).
- **State B (`displayQuantity` present)**: render `{amount} {unitLabel}` in place of `amount unit`, and a small ✎ affordance reveals the same inline editor pre-filled with current values. The editor also exposes a "Auf Menge in g/ml zurücksetzen" link that clears `displayQuantity`.

**Rationale:** Matches the inline editing style of `pieceQuantity` already in this editor (`AttachPieceForm`); no new modal pattern.

### Decision 8 — Recipes list row gets a one-line macro tail under the name

Render the existing meta (`X Zutaten · Y Portionen`) as today, and add a second line `${kcal} kcal · ${P} P / ${C} C / ${F} F` derived from `computeRecipeTotals(ingredients, yield).perServing`. Mobile-first; keep it on the row even at narrow widths by using small text and tabular numerals.

### Decision 9 — AI import: extract optional `displayQuantity` candidates

`recipe-draft-extractor.ts` already prompts the model for ingredients with `{ name, amount, unit }` and pieceQuantity. Extend the prompt to also return an optional `{ rawAmount?: number; rawUnitLabel?: string }` per ingredient that captures the literal textual amount/unit from the recipe — useful only when the unit is outside `MeasurementUnit`. The use-case `importRecipeFromPhotos` populates `displayQuantity` on matched rows where `top.untracked === true` and `rawUnitLabel` was provided.

**Trade-off:** Slight prompt + parser complexity. The model already returns close to this — the structured-output schema gets two new optional fields.

## Risks / Trade-offs

- **[Mass duplication of totals math across surfaces]** → Single pure `computeRecipeTotals` helper; every consumer imports it.
- **[`amount = 0` accepted on untracked rows could mask real bugs elsewhere]** → Tighten read-side filters: meal-log rollup (`log-recipe.use-case.ts`) already filters untracked; any future feature that converts untracked → tracked must validate the amount before persisting (caught by validator).
- **[Live totals on every keystroke might flicker]** → Recompute is O(n) for n ≤ ~30 ingredients; React batching covers it. If perceived flicker appears in testing, wrap in `useDeferredValue`.
- **[List-row macro line may overflow on narrow screens with long recipe names]** → Truncate the name with `truncate`, place the macro line on its own row below the name (already the layout pattern in `recipes-screen.tsx`).
- **[Free-form `unitLabel` admits typos / inconsistent capitalization]** → Personal-use scope per CLAUDE.md; not normalizing is acceptable. Length capped at e.g. 24 chars in the validator.
- **[AI import schema bump might confuse the existing model prompt]** → Stay strictly additive in the prompt; new fields are explicitly optional. Existing extraction tests are untouched; one new test asserts the field flows through.

## Migration Plan

- Add `displayQuantity` to backend & frontend types; validator accepts it on untracked rows only.
- No data migration needed: every existing record loads with `displayQuantity` absent and renders as today.
- Rollback: revert the change set. Persisted recipes that ran on the new code may carry `displayQuantity` — the old validator would reject it on write but accept it on read (it's an extra field). Practically safe for the personal-use scope. If a rollback during this period is required, a one-time script can strip the field from `recipes.json`.

## Open Questions

- Should the read-view totals strip be collapsible by default? Defaulting to expanded keeps the cooking view's nutrition story visible; users who don't care can ignore it.
- Should the recipes list sort by macros (e.g. by per-serving kcal)? Out of scope for this change; existing alphabetical sort stays.
