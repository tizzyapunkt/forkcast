## Context

Today, opening a recipe in read mode renders every ingredient row at the recipe's stored `yield`. Cooking sessions seldom match that exact portion count, and the user does not want to mentally rescale numbers while at the stove. The recipes spec already defines a normative scaling rule (`Yield scaling preserves piece quantities`) — `amount` and `pieceQuantity.amount` scale linearly while `gramsPerPiece` and `unit` stay invariant. That rule has so far only been documented; this change is its first interactive surface.

The recipe entity, the read-view component (`frontend/src/features/recipes/recipe-detail.tsx`), and the German labels file (`frontend/src/i18n/de.ts`) are the only touchpoints.

## Goals / Non-Goals

**Goals:**
- Let the user set an effective serving count in the recipe read view and see all ingredient amounts rescaled live.
- Preserve the existing scaling invariant from the recipes spec — `gramsPerPiece` and `unit` never change; `amount` and `pieceQuantity.amount` scale by the same factor.
- Keep the change purely view-side: no API surface change, no persistence, no impact on the meal log.
- Keep the UI low-friction and mobile-first — single tap interactions, no modal.

**Non-Goals:**
- No persistence of the chosen serving count (resets on navigation away — explicitly ephemeral).
- No rewriting of the cooking steps text. Step text is the author's narrative; scaling it would risk subtle bugs ("add 1 onion" → "add 2 onion" is grammatically wrong, and parsing free-form steps is out of scope).
- No change to logging behavior; logging continues to use the stored recipe at its stored `yield`.
- No change to the recipe form / edit mode.
- No "save as new recipe at this yield" affordance (could come later if there's demand).

## Decisions

**1. Where the multiplier state lives — local `useState` in `RecipeDetail`.**
The component already holds local UI state (`editing`, `confirmDelete`). The serving count is ephemeral view state with no need to survive remount. It does not belong in React Query or any URL param.
- *Alternatives considered:* URL query param so the count survives reloads. Rejected — the user explicitly views this as cooking prep, not a shareable view; the extra URL noise costs more than it buys.

**2. What the control looks like — number stepper (− / value / +), with a "reset to recipe yield" button when the value differs from the stored `yield`.**
Steppers are the cheapest mobile-first input for small integer ranges and match the rest of the app's affordances. The reset button keeps the model honest — the user can always recover the original numbers.
- *Alternatives considered:* free-form input — rejected (more keyboard, more validation). Slider — rejected (poor precision at small values, eats vertical space).

**3. Scaling is render-only, computed via a small pure helper.**
Add a `scaleIngredient(ingredient, factor)` helper (colocated with the component, or in a tiny module if reused). It returns a shallow copy with `amount` and `pieceQuantity.amount` multiplied by `factor`; `gramsPerPiece`, `unit`, `unitLabel`, `name`, `macrosPerUnit`, and `untracked` are unchanged. The component never mutates `recipe`.
- *Alternatives considered:* derive in the JSX inline — rejected because the same logic needs unit tests and would duplicate the piece-quantity branching across the render.

**4. Rounding policy — display only, never round the underlying value.**
- Mass amount (`amount` field): render with up to 1 decimal, trim trailing zeros (e.g. `300`, `75`, `12.5`).
- Piece count (`pieceQuantity.amount`): render with up to 2 decimals, trim trailing zeros (so `0.5`, `2`, `1.33` all render cleanly). The piece label (`unitLabel`) stays singular because German pluralization isn't trivial and the existing read view doesn't pluralize either.
- We never round the underlying scaled value used for downstream math (there is no downstream math — this is render-only — but the helper returns the unrounded value so future consumers don't inherit a lossy contract).

**5. Bounds — minimum 1, no hard maximum.**
Zero portions doesn't render anything useful; negative is meaningless. Above the stored yield is the entire point of the feature (4 servings of a 2-yield recipe). We do not impose a max — even 100× is a legitimate "I'm meal-prepping" case.
- *Alternatives considered:* allow fractional servings via the stepper (steps of 0.5). Rejected for v1 — keep the control integer-only for simplicity; the underlying helper accepts arbitrary factors so we can relax this later without an API change.

**6. Steps text is not scaled.**
Step strings remain verbatim. If the user wants to know how much onion to actually use, the ingredient list is the source of truth.

## Risks / Trade-offs

- **Risk:** User assumes the cooking steps also rescale ("the recipe says add 1 onion, but I'm cooking for 4 — does that mean 2 onions now?"). → **Mitigation:** rely on the ingredient list as the single source of truth; the step text uses the author's wording, the ingredient row shows the actual rescaled amount. We do not add a banner about this — the ingredient panel sitting above the steps is the visual answer.
- **Risk:** Floating-point drift in `pieceQuantity.amount` (e.g. `1 * 0.333... ≠ 0.333`). → **Mitigation:** scaled values stay in JavaScript number space; display formatting handles the trailing-digits issue. No persistence means no invariant breach.
- **Trade-off:** No persistence means the user re-picks the count every time they reopen the recipe. Acceptable — opening a recipe in cooking mode is rare, and persisting view state would feel sticky in a way that confuses logging (which is independent).

## Migration Plan

No migration. The change is additive on the read view only — pure UI. Rollback is reverting the commit.

## Open Questions

None.
