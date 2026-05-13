## Context

`RecipeIngredientEditor` (`frontend/src/features/recipes/recipe-ingredient-editor.tsx`) is the controlled editor used inside the recipe form (and AI-import review). It receives `ingredients: RecipeIngredient[]` and an `onChange` callback. Each keystroke into the amount input, piece-count input, or grams-per-piece input fires `onChange` with an updated array — so the parent form's state is authoritative and live.

Today each row shows:
- Name (tappable to replace)
- Amount input + unit (for tracked rows with no display-quantity active)
- Untracked toggle
- Optional piece-quantity row, display-quantity row, attach/detach UI, remove button

No per-ingredient kcal or macros are rendered. Whole-recipe totals are already shown by `RecipeTotalsStrip` (live, via `computeRecipeTotals`).

Recently shipped: `meal-log-display` capability surfaces per-entry macros in the daily log using `de.dailyLog.macroInline(p, c, f)` (emits `· {p}g P · {c}g K · {f}g F`). That helper is reusable here.

## Goals / Non-Goals

**Goals:**
- Render per-ingredient `{kcal} kcal · {P}g P · {C}g K · {F}g F` on every tracked row in `RecipeIngredientEditor`.
- Values must update synchronously as the user types into the amount, piece-count, or grams-per-piece inputs (no debounce — this is local form state, not a persisted entity).
- Hide the macro line entirely for untracked rows.

**Non-Goals:**
- No changes to `RecipeTotalsStrip` (already live and correct).
- No changes to the read-only `RecipeDetail` view (separate concern; the user asked specifically about adding/editing).
- No new i18n strings if the existing `de.dailyLog.macroInline` is reusable.
- No persistence, API, or domain model changes.

## Decisions

### Decision 1: Reuse `de.dailyLog.macroInline` rather than introduce a new helper

The recipe row's macro suffix uses the identical compact format (`· {p}g P · {c}g K · {f}g F`) as the daily-log entry row. Reuse keeps formatting consistent across the app and avoids duplicate i18n strings.

**Why:** Decision 1 of the prior `meal-log-display` change established this format. Cross-feature consistency outweighs the small naming awkwardness (`dailyLog.macroInline` being used outside the daily log).

**Alternative considered:** Add `de.recipeIngredientEditor.macroInline`. Rejected — premature duplication; if they need to diverge later we split then.

If the i18n key namespace bothers anyone, the helper could be renamed to a neutral location (e.g. `de.macros.inline`) in a follow-up — but that is a refactor, not part of this change.

### Decision 2: Render macros on a dedicated sub-line within the row, beneath the main name/amount row

The main row is already dense (name + amount + unit + remove button; sometimes display-quantity controls too). Adding a 4-number suffix on the same line would overflow on mobile.

Place the macro line as a small `text-xs text-muted-foreground` element directly below the name/amount row (above the untracked toggle and piece controls). This mirrors the slot-card layout choice from `meal-log-display` (second-line macro under the title) and keeps the visual rhythm consistent.

Format on the standalone line: `{kcal} kcal · {P}g P · {C}g K · {F}g F` — kcal first, then `macroInline` output. Strip the leading `· ` from the helper's output (same technique used in `slot-card.tsx`) so the line starts with kcal cleanly.

**Alternative considered:** Inline next to the amount input. Rejected — overflow on 360px viewport; the untracked badge and remove button already compete for that row.

### Decision 3: Suppress the macro line for untracked rows; do not render even zeros

Untracked rows are explicitly excluded from nutrition rollups everywhere else in the system (see `recipes` spec, "Recipe form displays live nutrition totals" requirement, untracked-toggle scenario). Rendering `0 kcal · 0g P · 0g K · 0g F` on those rows would suggest they have measured-and-found-to-be-zero nutrition; rendering them with their stored `macrosPerUnit` would be actively wrong (since the values are ignored at consume time).

**Why:** Truthful absence beats fake precision. The untracked toggle visually marks the row already; the missing macro line reinforces that signal.

### Decision 4: Rely on existing controlled-state plumbing for "live update"; no new state needed in the editor

`RecipeIngredientEditor` already calls `onChange` synchronously on every valid keystroke, which updates the parent form's state, which re-renders the editor with the new `amount`. Per-row macros are pure derivations (`macrosPerUnit * amount`), so they update on the same render tick as the input — no debounce, no callback prop, no mirror state. This is materially simpler than the `meal-log-display` solution, which had to thread a live-amount callback because `InlineAmountInput` owned a debounced PATCH.

For piece-quantity rows, `handleEditPieceCount` and `handleEditGramsPerPiece` recompute `ing.amount` synchronously before calling `onChange`, so the derived macros stay correct without any additional plumbing.

## Risks / Trade-offs

- **[Risk]** Each row gains a new line, increasing vertical density and pushing other rows lower in the list. **Mitigation:** the new line is `text-xs text-muted-foreground` — lightweight visual weight. Same style validated in daily-log slot card.
- **[Risk]** A user might be confused why a row marked "Untracked" has no macros, expecting them. **Mitigation:** the untracked badge / muted styling already communicates this; absence of macros reinforces it. No copy needed.
- **[Trade-off]** Reusing `de.dailyLog.macroInline` couples two features to one helper. **Mitigation:** explicit; if they diverge we split. Same trade-off was already accepted in `meal-log-display`.
- **[Trade-off]** Recipe-detail (read view) still won't show per-ingredient macros after this change. **Mitigation:** out of scope per user's stated intent ("when adding/editing"); easy follow-up.

## Migration Plan

No data, no API, no feature flag. Ship the UI change; rollback = revert PR.
