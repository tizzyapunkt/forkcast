## 1. Recipe ingredient editor — Gewicht·Stück·Frei measurement-mode control (TDD)

- [x] 1.1 Add a pure helper + tests for mode derivation and mode-switch seeding —
  `frontend/src/features/recipes/measurement-mode.ts` (`modeOf`, `seedMode`, `isMassUnit`) +
  `measurement-mode.test.ts` (14 tests).
- [x] 1.2 Add failing RTL cases in `recipe-ingredient-editor.test.tsx`: mode derivation, mode bodies,
  mode-switch seeding, Stück disabled on non-mass unit, only-active-body, live recompute.
- [x] 1.3 Implement `ModeSegments` + per-mode bodies inside `recipe-ingredient-editor.tsx`, replacing the
  mass input + `+ pro Stück`/`AttachPieceForm` + `Nicht zählen` pill. Transition `color` only.
- [x] 1.4 Keep the editor suite green (37 tests) + migrate the two other suites that drove the old
  affordances (`recipe-form.test.tsx`, `review-import-screen.test.tsx`) to the segmented control. 64 green.

## 2. Recipe form — Pro-Portion hero card + co-located servings stepper (TDD)

- [x] 2.1 Added cases in `recipe-form.test.tsx`: hero is first block under Name; servings is a stepper in
  the hero; totals update on add / Frei-switch / amount-edit / stepper change; total-invariant footer.
- [x] 2.2 Built `per-portion-hero.tsx` (eyebrow, per-serving kcal + macros, co-located servings stepper,
  "Gesamt … für N Portion(en)" footer) and wired it to the top of `recipe-form.tsx`, replacing the bare
  yield `<input>` and the mid-form `RecipeTotalsStrip`.
- [x] 2.3 `recipe-form` green (10); fixed the `recipes-screen` create-form assertion to the hero stepper.

## 3. Recipe detail + editor — header back-arrow (TDD)

- [x] 3.1 Added cases: `recipe-detail.test.tsx` — chevron-left back-arrow calls onBack; editor opens with a
  "Rezept bearbeiten" title + back-arrow that cancels, and no "×".
- [x] 3.2 Detail header is now a two-row layout with a `ChevronLeft` back-arrow left of the title; the form
  gained a `title` prop rendering a `ChevronLeft` back-arrow that calls `onCancel` (create passes
  "Neues Rezept", edit passes "Rezept bearbeiten").
- [x] 3.3 Detail/form/screen suites green (34).

## 4. Add-food sheet — tab-hiding on sub-steps + header back-arrow (TDD)

- [x] 4.1 Drove back via a drawer-level header back-arrow (`ChevronLeft`, aria "Zurück") rendered when
  `step.kind !== 'search'`; made the sub-step forms' `onBack` optional so their footer back button only
  renders outside the sheet (the isolated `full-entry-confirm.test` keeps it).
- [x] 4.2 Added drawer cases: amount sub-step hides the tab bar + shows the header back-arrow; back
  restores the tabs; quick chip sets the Menge. Existing "back returns to Recipes/Recent tab" cases kept.
- [x] 4.3 Tabs + tab bodies render only at `step.kind === 'search'`; dropped the title suffix so the title
  persists; back-arrow → `handleBack` returns to the originating tab and restores the tabs.
- [x] 4.4 AmountStep (`full-entry-confirm.tsx`) gained quick chips (25/50/100/150/200) and the dynamic
  "{n} {unit} erfassen" label; kept name + per-unit line, live summary, and serving-size pre-fill.
- [x] 4.5 Log-ingredient suite green (73).

## 5. Shell — bottom nav hidden on recipe sub-screens (TDD)

- [x] 5.1 Added an `app.test.tsx` case: nav hidden inside the create editor; visible on the list; restored
  on back.
- [x] 5.2 `RecipesScreen` gained an `onSubScreenChange(active)` callback (fires when `view.mode !== 'list'`);
  `app.tsx` hides `<BottomNav>` and drops `pb-16` while a recipe sub-screen is active.
- [x] 5.3 App suite green (7).

## 6. i18n

- [x] 6.1 Added German strings inline as each group landed: mode labels `Gewicht`/`Stück`/`Frei`, Frei
  caption + placeholders, `perPiecePrefix`; hero `totalForServings` + servings prefix/suffix; AmountStep
  `logAmount`/`quickAmountAria`; back-arrow arias (`recipeForm.backAria`, `logIngredient.back`);
  editor titles. All copy German; reused existing keys where present.

## 7. Visual polish (non-spec — implementation fidelity)

- [x] 7.1 Added `--header-grad` + a `.bg-header` utility to `index.css` and applied it to `app-header.tsx`
  (replacing flat `bg-primary-300`); hero uses an `accent/10 → card` gradient fill; segmented active segment
  is white + `shadow-sm`.
- [x] 7.2 Added a global `prefers-reduced-motion: reduce` guard in `index.css`.

## 8. End-to-end verification

- [x] 8.1 `pnpm --filter @forkcast/frontend test` — full green (401 tests / 59 files); backend untouched
  (545 green).
- [x] 8.2 `pnpm --filter @forkcast/frontend lint` — clean; `tsc --noEmit` clean; `pnpm build` succeeds.
- [x] 8.3 Smoked in Chrome (HTTPS disabled in `vite.config.ts`) at **desktop and 402px mobile** width:
  (a) Gewicht→Stück→Frei seeding + live hero recompute (172→0 kcal on Frei) ✓; (b) Pro-Portion hero at top
  with working servings stepper ✓; (c) editor header back-arrow restores list + nav ✓; (d) add-food sheet
  AmountStep hides tabs + header back-arrow + quick chips + "100 g erfassen" label + back restores tabs ✓;
  (e) bottom nav hidden in the editor ✓. All screens reflow cleanly at phone width.
- [x] 8.4 `openspec validate redesign-recipe-editor-and-add-food --strict` — change is valid.
