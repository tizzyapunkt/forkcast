## Why

When the user opens a recipe to cook, the ingredient amounts shown reflect the recipe's stored `yield`, but real cooking sessions rarely match that exact portion count. Reaching for a calculator (or eyeballing) to scale ingredients for "tonight I'm cooking for 4" is exactly the kind of friction forkcast exists to remove. The system already has a documented scaling rule for portion-based logging — surface it in the recipe read view so cooking prep is fast and low-friction.

## What Changes

- Add a servings multiplier control to the recipe read view (cooking view) that lets the user pick the number of effective servings to display.
- The control defaults to the recipe's stored `yield`. Changing it rescales every ingredient row's `amount` and `pieceQuantity.amount` using the existing scaling rule (`gramsPerPiece` and `unit` invariant; the macros story is unaffected because we only render).
- The multiplier is ephemeral, view-only state — it does NOT mutate the persisted recipe, does NOT affect logging, and is not persisted across navigations.
- The cooking-step text is left untouched (steps still read "add 1 onion" verbatim — they reference the recipe author's narrative, not the scaled numbers).
- Untracked rows scale identically to tracked rows in the rendered amount; their visual styling is unchanged.

## Capabilities

### New Capabilities
<!-- None — this extends an existing capability. -->

### Modified Capabilities
- `recipes`: The Recipes UI — edit and delete requirement gains a servings-multiplier control on the read (cooking) view that rescales rendered ingredient amounts. The existing "Yield scaling preserves piece quantities" requirement already specifies the scaling math; the UI side gains its first interactive entry point to it.

## Impact

- Frontend: `frontend/src/features/recipes/recipe-detail.tsx` gains a servings selector and a small render-time scaling helper. `frontend/src/i18n/de.ts` gains labels for the control. A unit/integration test covers the scaling behavior across tracked rows, untracked rows, and piece-quantity rows.
- Backend: no changes. The scaling rule lives in the domain spec but the read view applies it client-side at render time; no new endpoints, no persisted state, no migration.
- Dependencies: none.
