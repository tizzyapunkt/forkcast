## Context

The recipe domain is mature. `RecipeIngredient` already carries `pieceQuantity`, `untracked`,
`displayQuantity`, and `note`; the backend validates all of them; the frontend already has
`computeRecipeTotals`, `scaleIngredient`, a working servings stepper (on the read view), per-row macro
sub-lines, and a recipe portions confirm step in the log drawer. The design package
(`design_handoff_forkcast/`) is a re-composition of these existing parts, **not** new domain modeling.

Two surfaces change:

- **Recipe ingredient editor** (`recipe-ingredient-editor.tsx`). Today weight / piece / untracked are
  three independent controls: the default mass `<input>`, a `"+ pro Stück"` button that opens an inline
  `AttachPieceForm` (count / unitLabel / gramsPerPiece), and a `"Nicht zählen"` pill toggle that reveals
  the optional `DisplayQuantityForm`. The redesign consolidates these into **one segmented control**
  (`Gewicht · Stück · Frei`) with a per-mode body, where mode is *derived* from the row's data rather
  than stored.
- **Add-food sheet** (`log-ingredient-drawer.tsx`, rendered in the custom `BottomSheet`). Its sub-step
  state machine already exists (`{kind:'search'} | {kind:'confirm', result} | {kind:'recipe-confirm',
  recipe}`); the `recipe-ingredient-picker.tsx` already demonstrates the tab-hiding pattern. The
  redesign applies tab-hiding to the drawer and lifts the back affordance into the sheet header.

The palette is already wired (`index.css` CSS variables match `fc-tokens.css`); the only visual deltas
are the header gradient, the hero-card fill, and the segmented-control styling — implementation detail.

Constraints (CLAUDE.md): pragmatic DDD/hexagonal, **TDD-first**, behaviour tests over framework tests,
no new tooling without concrete need, no router (sub-views are local `useState` view-machines).

## Goals / Non-Goals

**Goals:**
- One segmented measurement-mode control per ingredient row that is unambiguous and reuses the existing
  `pieceQuantity`/`untracked`/`displayQuantity` mechanics underneath — no new persisted fields.
- Defined, predictable mode-switch seeding so switching modes never loses or corrupts the row.
- A Pro-Portion hero at the top of the form that makes the per-portion number the headline and keeps the
  servings stepper next to it.
- A single, consistent back affordance (header chevron-left, no `×`) across Recipe Detail, Recipe Editor,
  and the Add-food sheet sub-steps; the sub-step flow hides the tab bar and restores it on back.
- Bottom nav out of the way on recipe sub-screens.

**Non-Goals:**
- **No backend changes.** No new endpoints, no schema or validation change, no data migration.
- No change to how recipes/log entries are persisted or how macros are computed (`computeRecipeTotals`,
  `LogRecipe`, untracked-exclusion all stay).
- No re-theme work in this spec (palette already matches; pixel polish is implementation).
- The `Menü` dropdown measurement variant, the `Agenda`/`Raster` planner, and the `Alarm-Rot` tone are
  **ruled out** and not built (Tweaks panel is a prototyping aid only).
- The weekly planner is a **separate change** (`add-weekly-meal-plan`).

## Decisions

### Decision 1 — Mode is derived, not a stored field
`modeOf(row)` = `row.pieceQuantity ? 'piece' : row.untracked ? 'free' : 'weight'`. No `mode` field is
added to `RecipeIngredient`; the segmented control reads this derivation and writes the underlying
fields. This keeps the persisted shape and all backend validation untouched.

**Rationale:** the three modes map one-to-one onto existing fields. A stored `mode` would duplicate
state that can disagree with the data. Mirrors the design prototype's `modeOf`/`gramsOf` helpers.

### Decision 2 — Mode-switch seeding (the core interaction contract)
Switching the active segment patches the row deterministically:
- **→ Gewicht:** clear `pieceQuantity`; set `untracked: false` (and drop `displayQuantity`). The row's
  `amount` + `unit` are preserved.
- **→ Stück:** set `untracked: false`, clear `displayQuantity`; seed `pieceQuantity = { amount: 1,
  unitLabel: 'Stück', gramsPerPiece: current amount || 50 }` and set `amount = 1 * gramsPerPiece`
  (preserving the existing `amount === pieceQuantity.amount * pieceQuantity.gramsPerPiece` invariant).
  If a `pieceQuantity` already exists it is kept verbatim. **Stück is only offered when `unit` is `g`/`ml`**
  (the existing piece invariant); on other units the segment is disabled.
- **→ Frei:** set `untracked: true`, clear `pieceQuantity`. The Frei body's amount/unit inputs map onto
  `displayQuantity` **only when the unit label is non-empty** (so the existing "displayQuantity needs a
  non-empty unitLabel" validation holds); an empty unit means no `displayQuantity` and the canonical
  `amount`/`unit` is shown, muted.

**Rationale:** matches the prototype's `setMode` defaults while respecting the stricter backend
validation already in place (`displayQuantity.unitLabel` must be non-empty; piece needs a mass unit).

### Decision 3 — Per-mode body reuses existing handlers
Each mode body is a thin re-layout over handlers that already exist in `recipe-ingredient-editor.tsx`:
- **Gewicht:** the mass `amount` input + unit + the existing per-row macro sub-line.
- **Stück:** the existing piece controls (count stepper, piece-name input, grams-per-piece input) with
  their recompute rules (`editing count` and `editing gramsPerPiece` recompute `amount`; the estimate
  badge logic is unchanged).
- **Frei:** the untracked state + the existing `DisplayQuantityForm` fields surfaced inline as amount +
  free-text unit, plus the caption "Zählt nicht in die Nährwerte — nur als Hinweis im Rezept."

No new domain helpers are introduced; this is a JSX re-composition guarded by the derived mode.

### Decision 4 — Segmented control: transition `color` only
Per the README's explicit warning (and contradicting the prototype's own CSS): the active segment's
white background + `--shadow-card` must change **instantly**; only `color` is transitioned. Animating
`background`/`box-shadow` toward `transparent`/`none` sticks in some engines and reads as a broken
toggle. Implement with a Tailwind/utility transition limited to `color`.

### Decision 5 — Pro-Portion hero at top; servings stepper co-located
`recipe-form.tsx` renders the totals as a hero card directly under the Name field (subtle
`linear-gradient(180deg, --accent-soft, --card)` fill): eyebrow "Pro Portion" + the existing
`RecipeTotalsStrip` math as a big kcal number + macro dots + `Gesamt … für N Portion(en)` footer. The
bare yield `<input>` is replaced by the **existing stepper pattern** (already in `recipe-detail.tsx`),
placed in the hero's header as "Ergibt [−N+] Portionen". Per-portion = `total / max(1, servings)`,
recomputed live (no debounce; recipes have ≤ a few dozen rows).

**Rationale:** reuses `computeRecipeTotals` and the existing stepper; no new math. Placement is the only
behavioural change worth specifying (the form previously had totals mid-form and yield as a plain input).

### Decision 6 — One back-arrow pattern, lifted into headers
A chevron-left icon button, inline to the left of the heading (negative left margin to align to the
content edge), replaces: the Recipe Detail's text `← Zurück`, the Recipe Editor's close `×`, and the
Add-food sheet's per-form footer `Zurück` buttons. In the sheet it lives in the header and is only
rendered while a sub-step is open (`onBack` truthy); clicking it clears the sub-step and restores the
tab bar. `BottomSheet` (pure chrome today) gains an optional header with a `title` + `onBack` + `right`
slot, or a small shared `SheetHeader` is introduced — whichever keeps both consumers
(`log-ingredient-drawer`, `recipe-ingredient-picker`) consistent.

### Decision 7 — Add-food sub-step = tab bar hidden, rendered at sheet level
The tabs + tab bodies render only while `step.kind === 'search'`; the amount/portions sub-steps render
in the else branch (so the tab bar is absent), exactly like `recipe-ingredient-picker.tsx` already does
for its pick step. State already supports this — the change is the conditional wrapper + the header
back-arrow. Closing/cancel resets sub-step state after the slide-out (~300 ms) so the next open starts
clean.

### Decision 8 — Nav-hiding via lifted state (no router)
`RecipesScreen` owns a `view` machine (`list | create | import | detail`). It already knows when a
recipe sub-screen is active. Lift a boolean (e.g. via an `onSubScreenChange` callback or by moving the
nav-visibility decision into `app.tsx` keyed off the recipes sub-view) so `app.tsx` hides `<BottomNav>`
on recipe detail/editor (and the create/import sub-views, which are equally "inside a recipe"). The
`<main>` bottom padding is dropped while the nav is hidden so content isn't clipped.

## Risks / Trade-offs

- **[Rewiring the editor control risks regressing piece/untracked/note behaviour]** → Keep the existing
  handlers; only the control surface changes. The existing `recipe-ingredient-editor.test.tsx` suite
  (piece recompute, untracked toggle, displayQuantity add/edit/clear, note add/edit/clear) must stay
  green; new tests cover the segmented control on top.
- **[Mode-switch seeding could violate the piece/displayQuantity invariants]** → Seeding is specified to
  keep `amount === count * gramsPerPiece` and to only write `displayQuantity` with a non-empty
  `unitLabel`. Validator already rejects violations; tests assert the seeded shapes round-trip.
- **[Stück on a non-mass unit]** → Disable the Stück segment unless `unit` is `g`/`ml` (matches the
  existing pieceQuantity rule); surface why via a disabled-state hint.
- **[Adding a header/`onBack` to `BottomSheet` could affect other consumers]** → Make the header opt-in
  (only renders when `title`/`onBack`/`right` provided); the ingredient picker keeps its current header
  or adopts the shared one without behaviour change.
- **[Nav-hiding without a router]** → Drive it from the existing recipes view-machine state; covered by an
  RTL/state test ("nav hidden on detail/editor, visible on list").

## Migration Plan

- Pure frontend re-composition + i18n additions. No backend, no persisted-shape change, **no data
  migration** — every existing recipe and log entry renders unchanged.
- Rollback = revert the change set; persisted data is untouched and remains valid against the unchanged
  backend.

## Open Questions

- Should the disabled Stück segment (non-mass unit) show a tooltip/hint, or silently disable? Default:
  disable with a short inline hint; revisit if it confuses.
- Do we fold the Add-food sheet header into `BottomSheet` or introduce a shared `SheetHeader`? Either is
  fine; pick whichever keeps the picker and the drawer DRY during implementation.
