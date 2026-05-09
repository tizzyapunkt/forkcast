## Context

The recipe ingredient editor (`recipe-ingredient-editor.tsx`) is shared between two surfaces:

- The **manual recipe form** (new + edit), reached from the Recipes screen.
- The **AI-import review screen**, where the user reviews and corrects a draft recipe extracted from photos before saving.

Both surfaces drive an `IngredientSearchService`-backed picker (`recipe-ingredient-picker.tsx`) for adding new rows. The picker returns a `RecipeIngredient` via `onPicked`; the editor appends it to the list.

Today there is no way to **replace** an existing row's ingredient. The only corrections the editor supports per row are: edit `amount`, edit `pieceQuantity` fields, attach/detach piece tracking, toggle `untracked`, and remove the row entirely. To swap a misrecognized ingredient (very common after AI import), the user must delete and re-add — which loses the amount and forces them to remember context.

This change adds a per-row "replace" action that opens the existing picker and substitutes the row in place when the user picks a different ingredient.

## Goals / Non-Goals

**Goals:**

- One-tap action on every row that opens the picker and lets the user choose a replacement.
- The amount the user already entered (or the importer extracted) is preserved across the swap.
- All other ingredient metadata (`name`, `unit`, `macrosPerUnit`, `untracked`) follows the new pick — these are intrinsic properties of the chosen catalog entry.
- `pieceQuantity` is preserved when the new unit is mass (`g`/`ml`) and dropped otherwise — the same rule the AI-import matcher already enforces.
- Discoverable on mobile without adding a new visual strip per row: tap the ingredient name to swap.
- Behavior is symmetric across the manual recipe form and the AI-import review screen (one editor, one behavior).

**Non-Goals:**

- Adding a new persistence event or audit trail for swaps. The result is an ordinary updated `RecipeIngredient` indistinguishable from one created via the existing "add" flow — the user-visible result is what matters.
- Building a separate "replace" UI component. The existing `RecipeIngredientPicker` already does the right thing (search, recent, amount step) — we just hook it up to update an indexed row instead of appending.
- Adding undo for swaps. Acceptable: if the user picks the wrong replacement, they can swap again.
- Allowing a row's `name` / `unit` / `macrosPerUnit` to be hand-edited (as opposed to swapping via the catalog). The catalog remains the source of truth for tracked ingredient identity.
- Changing how the picker behaves at the picker level — it still returns a `RecipeIngredient` via `onPicked`. The "replace vs. add" decision lives in the editor's state, not the picker.

## Decisions

### Decision 1: Replace state lives in the editor; picker stays additive

**Decision:** The editor owns a `replacingIndex: number | null` state. When `null`, picking appends a new row (current behavior). When non-null, picking mutates the row at that index in place. The picker itself is unchanged in behavior; the only addition is an optional `mode` prop that drives the dialog title text ("Zutat ersetzen" vs. "Zutat hinzufügen") so the UX context is clear.

**Rationale:** The picker should remain a thin, single-purpose component (search + amount). Add-vs-replace is a concern of the parent that owns the row list. This keeps the picker re-usable and the new behavior local to the editor.

**Alternative considered:** Pass `targetIndex` and a mutator callback into the picker, letting it perform the swap. Rejected — the picker has no business knowing about a list it doesn't own, and adding that coupling would also complicate the manual "add" flow.

### Decision 2: Tap-the-name to swap (with a small affordance), not a separate icon button

**Decision:** The ingredient name in each row becomes a button-styled tap target. A small "↻" (replace) glyph appears next to the name to communicate that the area is interactive. Mobile tap height is ≥44px (matches the existing untracked-toggle pill polish). The remove ✕ stays where it is.

**Rationale:**

- The row is already crowded on mobile (name, amount, unit, ✕). Adding a separate replace button would compress the name further or force a second visual strip per row.
- Names are the most prominent element on each row and are not currently editable — making them tappable is a natural extension and doesn't conflict with any existing affordance.
- A tiny glyph next to the name flags the row as interactive without adding a full button. Hover/focus styling on desktop reinforces the affordance; on mobile the glyph + the row-tap-to-act pattern is enough.

**Alternative considered:** A separate "Ersetzen" link below the row, parallel to "+ pro Stück". Rejected — adds a third row of UI per ingredient (after the amount row and the untracked-toggle pill), making mobile lists very tall. Tapping the name is denser and matches the new mobile-first direction of the ingredient row.

**Alternative considered:** A swap icon on the right next to ✕. Rejected — easy to mistap when intending to remove, and the name area has more horizontal slack than the action cluster on the right.

### Decision 3: Swap rules mirror the AI-import matcher's piece-quantity logic

**Decision:** When swapping, apply the same per-field rules the AI-import matcher uses for a fresh match:

| Field | On swap |
|---|---|
| `name` | Replace with the new pick's name |
| `unit` | Replace with the new pick's unit |
| `macrosPerUnit` | Replace with the new pick's macrosPerUnit |
| `amount` | **Keep** the existing value |
| `pieceQuantity` | Keep verbatim if new `unit` is `g`/`ml`; drop entirely otherwise |
| `untracked` | Replace: `true` if the new pick has `untracked: true`; absent otherwise |

If the row was in `estimateIndices` (AI-flagged as an estimated `gramsPerPiece`) and the swap drops `pieceQuantity`, the estimate marker for that index is cleared. The estimate marker is also cleared when `pieceQuantity` is preserved across the swap, because the user has just made an explicit pick and the AI estimate badge is no longer informative.

**Rationale:** Consistency. The AI-import matcher already has a tested rule set (`piece quantity preserved through mass-unit match`, `piece quantity dropped through non-mass match`). Swapping is functionally a re-match initiated by the user; reusing the same rules avoids two parallel logic paths.

### Decision 4: No mid-swap "are you sure?" prompt

**Decision:** Picking a different ingredient swaps the row immediately. No confirmation dialog. The picker has its own back/cancel semantics (the user can dismiss before completing the amount step — but the amount step is bypassed in replace mode; see Decision 5).

**Rationale:** A confirmation dialog adds a step to a one-tap workflow. Swap is reversible (the user can swap again), low-stakes, and the picker's selection step itself is a deliberate choice. We treat swap like edit — there is no "are you sure?" when editing the amount, and there shouldn't be one for swapping the ingredient.

### Decision 5: Skip the picker's amount step when replacing

**Decision:** In replace mode, picking a search result directly performs the swap (using the row's existing `amount`) and closes the picker — bypassing the picker's amount-confirmation step. The picker exposes the mode via a prop and short-circuits its own state machine accordingly.

**Rationale:** The whole point of swap is to keep the existing amount. Forcing the user through the amount step would mean re-typing the same number every time — defeating the purpose. If the user wants to change the amount after swapping, they edit it directly in the editor row (where it already sits as an inline input).

**Alternative considered:** Show the amount step but pre-fill with the existing amount. Rejected — pre-fill is friction, and the user has already entered the amount. Skipping the step is faster and matches user intent.

## Risks / Trade-offs

- **Discoverability of the tap-the-name pattern.** → Mitigated by the inline "↻" glyph next to the name (visible on every row), a hover/focus state on desktop, and the dialog title "Zutat ersetzen" once opened. We could add a subtle pulse or onboarding tip later if telemetry showed users not finding it; not pre-engineered.
- **Accidentally tapping the name when scrolling.** → The name button uses standard tap timing (no hover delay). If this becomes a real issue, we'd add a small drag-threshold check; defer until reported.
- **Swap-then-edit-piece-quantity asymmetry.** If the user swaps a row's ingredient from `g` to `tbsp`, the `pieceQuantity` is dropped (correct). They can re-attach piece tracking if the new unit is mass (`g`/`ml`); for `tbsp` they cannot, matching today's behavior. → Acceptable; same rules as the AI-import matcher and manual editor.
- **Picker title context.** The picker dialog must say "Zutat ersetzen" instead of "Zutat hinzufügen" in replace mode so the user understands what's happening. → Single new i18n string + one prop. Tested in RTL.
- **No backend test coverage needed.** The change is purely a frontend state-management refinement; the persisted shape of `RecipeIngredient` is unchanged.

## Migration Plan

No migration. The change is additive to the editor's behavior; existing recipes and persisted state are untouched. Reverting the code reverts the feature.

## Open Questions

- **Glyph choice**: "↻" (replace), "⇄" (swap), or "✎" (edit)? Will use whichever reads cleanest in the inline name context — defer to UI implementation. The visual design is small and easy to revise after seeing it in place.
- **Ein-Wort label vs. icon-only**: should we additionally show "(Ändern)" as muted text next to the name? Initial implementation uses icon-only with an `aria-label` for screen readers; revisit if discoverability is poor.
