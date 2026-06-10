## Why

A design pass (the `design_handoff_forkcast` package) reworks the two most-used authoring
surfaces — the **Recipe Editor** and the **Add-food sheet** — to be faster and less ambiguous.
The behaviours and data model already exist (`pieceQuantity`, `untracked`, `displayQuantity`,
`note`, live totals, the servings multiplier, the recipe portions confirm step are all shipped);
what changes is **how the user drives them**:

1. The recipe ingredient editor exposes piece/untracked through **three separate, ambiguous
   controls** today — a standalone mass input, a `"+ pro Stück"` opt-in that reveals an attach
   form, and a `"Nicht zählen"` pill toggle. A user has to know that "by piece" and "don't track"
   are different mechanisms. The redesign replaces all three with **one segmented mode control**:
   **Gewicht · Stück · Frei**. Exactly one mode is active per row; the body below it shows only the
   inputs that mode needs.
2. The recipe form's nutrition feedback (the totals strip) sits in the middle of the form and the
   servings count is a bare number input near the top. The redesign promotes totals to a **Pro-Portion
   hero card at the very top of the form**, with the **servings stepper co-located inside it**, so the
   per-portion macro story and the divisor that drives it live together and recompute live.
3. The Add-food sheet keeps its **tab bar visible** while the user is on an amount/portions
   sub-step, and the back affordance is a footer button inside each form. The redesign **hides the
   tab bar on any sub-step** and moves the back affordance to a **header back-arrow left of the
   title** that returns to the list and restores the tabs — the same arrow pattern is adopted on the
   Recipe Detail and Recipe Editor headers (replacing the text `← Zurück` link and the old `×`).
4. The **bottom navigation stays visible** on recipe detail/editor today; the redesign **hides it on
   those sub-screens** for focus.

These are changes to **user-visible behaviour** (a new measurement-mode control with defined
mode-switch seeding, the sub-step tab-hiding flow, nav-hiding on recipe sub-screens), so they go
through OpenSpec before implementation.

The colour system is **not** part of this change: the indigo/lavender/pink-white palette already
lives in `frontend/src/index.css` as CSS variables matching the design tokens. Pixel-level visual
polish (header gradient, hero-card fill, segmented-control styling) is implementation detail, not a
capability change, and carries no spec delta.

## What Changes

- **New unified measurement-mode control** on every recipe ingredient row: a segmented
  `Gewicht · Stück · Frei` toggle. Mode is **derived** from the row (`pieceQuantity` → Stück;
  else `untracked` → Frei; else Gewicht), exactly one is active, and switching modes **seeds
  sensible defaults** (→ Stück seeds `pieceQuantity {amount:1, unitLabel:'Stück', gramsPerPiece:
  current amount || 50}`; → Frei seeds `untracked: true` and clears `pieceQuantity`; → Gewicht
  clears `pieceQuantity` and `untracked`). The control replaces the separate `"+ pro Stück"`
  attach affordance and the `"Nicht zählen"` pill toggle. The persisted shape and all validation
  for `pieceQuantity`/`untracked`/`displayQuantity` are unchanged.
- **Pro-Portion hero card** moves to the **top of the recipe form** with the **servings stepper
  co-located** in it; per-portion kcal + macros and the `Gesamt … für N Portion(en)` footer
  recompute live as ingredients/servings change. The bare yield `<input>` becomes the hero's
  stepper.
- **Header back-arrow** (chevron-left, inline left of the heading, no `×`) on the Recipe Detail and
  Recipe Editor — replacing the current text `← Zurück` link and the editor's close `×`.
- **Add-food sheet sub-step flow** (new capability `add-food-sheet`): the sheet shell (tabs
  Suche/Zuletzt/Rezepte/Schnell), the **catalog-food AmountStep** (which had no capability home),
  and the cross-cutting **sub-step tab-hiding + header back-arrow that restores tabs**. The recipe
  **RecipePortionStep** is the same sub-step shell, with its logging behaviour owned by `log-recipe`.
- **Bottom navigation hidden on recipe sub-screens** (detail/editor).

## Capabilities

### New Capabilities
- `add-food-sheet`: the add-food bottom sheet shell — tab set, the catalog-food AmountStep, and the
  sub-step navigation (entering a sub-step hides the tab bar; a header back-arrow restores it).

### Modified Capabilities
- `recipes`: the recipe-form ingredient row gains the unified `Gewicht · Stück · Frei` measurement-mode
  control (replacing the separate piece-attach and untracked-toggle affordances); the live totals
  strip becomes a **Pro-Portion hero card at the top of the form** with a co-located servings stepper;
  the Recipe Detail and Editor adopt the header back-arrow.
- `bottom-navigation`: the bar is **hidden on recipe detail/editor sub-screens** (added as an
  exception to "visible on every primary screen").
- `log-recipe`: the recipe portions confirm step is reframed as a sheet-level **RecipePortionStep
  sub-step** that hides the tab bar and uses the shared header back-arrow (per `add-food-sheet`);
  the logging behaviour (`LogRecipe`) is unchanged.

## Impact

- **Frontend (recipes)** — `recipe-ingredient-editor.tsx` (replace the mass-input / `+ pro Stück`
  AttachPieceForm / `Nicht zählen` pill with one `ModeSegments` control + a per-mode `ModeBody`,
  preserving the existing `pieceQuantity`/`untracked`/`displayQuantity`/`note` handlers and the
  per-row macro sub-line), `recipe-form.tsx` (move `recipe-totals-strip` into a top Pro-Portion hero;
  swap the yield `<input>` for the existing stepper pattern co-located in the hero), `recipe-detail.tsx`
  (header back-arrow left of title), `recipes-screen.tsx` (header back-arrow on the editor header slot).
- **Frontend (add-food sheet)** — `log-ingredient-drawer.tsx` (hide the tab bar when
  `step.kind !== 'search'`; move the back affordance from per-form footer buttons into a header
  back-arrow left of the title that restores tabs), and the shared `bottom-sheet.tsx`/a header
  subcomponent gains an `onBack` back-arrow slot. `recipe-ingredient-picker.tsx` already hides its
  tabs on the amount step — reuse that pattern.
- **Frontend (shell)** — `app.tsx` / `recipes-screen.tsx`: lift a "recipe sub-screen active" signal so
  `BottomNav` can hide on recipe detail/editor (no router exists; coordinate via state).
- **i18n** — reuse existing keys where present (`recipes.*`, `recipeForm.*`, `recipeTotals.perServingLabel`
  = "Pro Portion", `recipeIngredientEditor.*`, `logIngredient.*`); add keys for the three mode labels
  (`Gewicht`/`Stück`/`Frei`), the Frei caption, the Stück body labels (`pro Stück ≈`, piece-name
  placeholder), the AmountStep ("{n} {unit} erfassen", quick-chip amounts), and the back-arrow aria
  labels.
- **Backend** — **none.** All ingredient fields and validation already exist; the redesign is a
  frontend re-composition. No new endpoints, no schema change, no data migration.
- **Tests** — TDD per CLAUDE.md: RTL tests for the segmented control (mode derivation, each mode body,
  mode-switch seeding, totals reacting), recipe-form hero placement + servings stepper, the add-food
  sheet tab-hiding + header back-arrow restoring tabs, and nav-hiding on recipe sub-screens.
