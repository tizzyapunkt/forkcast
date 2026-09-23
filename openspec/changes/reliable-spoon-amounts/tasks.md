## 1. Backend: conversion order and the estimate (domain, TDD)

- [x] 1.1 In `convert-spoon-amount.test.ts`, add failing tests for the conversion order:
  - `g` food without density + `gramsPerSpoon` → count × estimate, reported as estimated
  - density beats the estimate
  - `ml` ignores the estimate
  - a non-spoon label ignores the estimate
  - a non-positive estimate is ignored
  - a missing count defaults to one spoon
  - rounding to one decimal

  Verify they fail with `pnpm --filter @forkcast/backend test convert-spoon-amount`.
- [x] 1.2 Extend the conversion to take the optional estimate and report whether it was used. Verify the 1.1 tests and the existing ones pass.
- [x] 1.3 In `build-matched-row.test.ts`, add failing tests:
  - Haferflocken `2 EL` with `gramsPerSpoon: 8` on a `g` entry without density gives `16` with `spoonEstimated: true` and `missingAmount: false`
  - the density and `ml` conversions give `spoonEstimated: false`
  - no estimate still gives `missingAmount`
  - an untracked row with `gramsPerSpoon` keeps its `displayQuantity` and `spoonEstimated: false`

  Verify they fail.
- [x] 1.4 Add `gramsPerSpoon?` to `OriginalDraftFields`, and `spoonEstimated` to `BuildMatchedRowFlags` and to the provenance flags type in `domain/ai-recipe-import/types.ts`. Wire the estimate through `buildMatchedRowWithFlags`. Verify the 1.3 tests and the existing suite pass.

## 2. Backend: parser normalization, schema and prompt

- [x] 2.1 In `extract-recipe-tool.test.ts`, add failing tests covering:
  - every scenario of "Parser moves spoon and ounce values off the canonical unit"
  - "Piece fields with non-mass unit dropped", which now yields a spoon measure
  - rule order: a piece label beats an enum-derived label, and literal raw-display beats both
  - `gramsPerSpoon` kept when positive next to a spoon label, and dropped otherwise
  - "Normalization leaves the verbatim line untouched": every normalization case keeps a given `sourceText` byte-for-byte

  Replace the obsolete "piece fields with non-mass unit dropped" test with the new scenario. Verify they fail.
- [x] 2.2 Add `gramsPerSpoon?` to `RawIngredient`, and implement the normalization in `parseToolInput` in the spec's order, recognizing spoon labels through `spoonVolumeMl`. Keep the parser's tolerated units (`g`/`ml` plus `tbsp`/`tsp`/`cup`/`oz`) separate from the schema enum (design Decision 1). Verify the 2.1 tests pass.
- [x] 2.3 Update `EXTRACT_RECIPE_TOOL` and `EXTRACT_RECIPE_INSTRUCTIONS` per design Decision 7:
  - `unit` enum `['g', 'ml']`
  - optional numeric `gramsPerSpoon` with its description
  - delete the "attempt … a sensible canonical conversion" sentence
  - update the raw-display worked examples

  Leave the Transcription rule block and the `sourceText` schema field from #51 unchanged, and keep the new raw-display examples on the same lines as its transcription examples (design Decision 7). Add a test asserting:
  - the enum is exactly `g`/`ml`
  - `gramsPerSpoon` is an optional number
  - the instructions no longer ask for a canonical conversion
  - `sourceText` is still the first, optional ingredient property

  Verify it passes.

## 3. Backend: unmatched rows and confirm

- [x] 3.1 In `import-recipe-from-photos.use-case.test.ts`, add failing tests:
  - an unmatched row carries `rawDisplayAmount`, `rawDisplayUnitLabel` and `gramsPerSpoon`, with no `displayQuantity`
  - a tracked Haferflocken spoon row gets `16 g`, and its provenance has `flags.spoonEstimated: true`
  - every provenance entry carries a boolean `spoonEstimated`

  - a `tbsp` row with `sourceText: "2 EL Olivenöl"` has provenance `raw` with the spoon fields and that exact `sourceText`

  Also update the unit-override tests (row and provenance) to the spec's `Joghurt 150 ml → g` example. Verify the new tests fail.
- [x] 3.2 Add the spoon fields to `UnmatchedDraftIngredient`, and carry them onto unmatched rows in the use case. Verify the 3.1 tests pass.
- [x] 3.3 In `resolution.handlers.test.ts` and `confirm-resolution.use-case.test.ts`, add failing tests for the four scenarios of "Resolving an unmatched row converts its spoon measure":
  - new food with the estimate gives `32 g`
  - synonym onto an `ml` entry gives `15 ml`
  - a non-positive or non-numeric `gramsPerSpoon` is ignored, not rejected
  - no `gramsPerSpoon` gives no amount, and the request still succeeds

  Verify they fail.
- [x] 3.4 Parse `gramsPerSpoon` (positive finite only) in `parseOriginal`, and pass it through the confirm use case to `buildMatchedRowWithFlags`. Verify the 3.3 tests pass.

## 4. Frontend: forward the spoon measure and mark estimates

- [x] 4.1 Add the optional fields:
  - `gramsPerSpoon?` to `RawIngredientProvenance`
  - spoon fields to the unmatched draft type
  - `spoonEstimated?: boolean` to the provenance flags in `domain/recipes.ts`
  - `gramsPerSpoon?` to `OriginalDraftFields` (`domain/food-resolution.ts`) and to `ResolveItem`

  Verify with `pnpm --filter @forkcast/frontend typecheck`.
- [x] 4.2 In `review-import-screen.test.tsx` (or `resolve-flow.test.tsx`), add a failing test: confirming an unmatched row that carries `2 EL` + `gramsPerSpoon: 16` sends those three values in the confirm request's `original` (MSW request capture). Verify it fails.
- [x] 4.3 Copy the spoon fields into `openItem` in `review-import-screen.tsx`, and forward `gramsPerSpoon` in `originalFields` in `resolve-pane.tsx`. Verify the 4.2 test and the existing resolve tests pass.
- [x] 4.4 In `features/recipes/ingredient-provenance.test.ts`, add failing tests:
  - a row with `flags.spoonEstimated: true` and raw `2 EL` shows `Menge aus 2 EL geschätzt`
  - `0.5 TL` renders as `Menge aus 0.5 TL geschätzt`
  - a false or missing flag shows no spoon marker
  - `formatRawIngredient` without `sourceText` renders a normalized row as `2 EL Olivenöl`, and with `sourceText` it still returns the verbatim line

  Verify they fail.
- [x] 4.5 Add the `spoonEstimated` reason to `deriveUncertaintyMarker`, using `formatPieceCount`, and add its German string to `i18n/de.ts`. Verify the 4.4 tests pass.

## 5. Verification

- [x] 5.1 Run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm format` from the repo root, and verify all are green.
- [x] 5.2 Confirm `rezepte/` is git-ignored before using its photos (`git check-ignore -q rezepte/IMG_7369.jpeg`), because the repo is public. Add it to `.gitignore` if the check fails.
- [x] 5.3 Smoke-test in Chrome against `make dev-http`, with the user logging in themselves. Import `rezepte/IMG_7369.jpeg` (½ TL Backpulver, ¼ TL Zimt, ¼ TL Flohsamenschalen, 10 ml Kokosöl) plus one photo with an `EL` of oil or nut butter. Verify:
  - no spoon row shows `Einheit tbsp → …`
  - gram foods without density get an amount plus the `Menge aus … geschätzt` marker
  - `ml` foods convert without a marker
  - an unmatched spoon row resolved as a new food arrives with an amount
  - every spoon row's "gelesen" line still shows the printed line verbatim (e.g. `½ TL Backpulver`) next to its converted amount

  Note the estimate values for a sanity check.

  Result (Haiku 4.5, IMG_7369 + IMG_7376, the latter imported 3×):
  - Every spoon line arrived on the raw-display fields; `1½ EL Sojasoße` → 22.5 ml, deterministic, no marker.
  - Estimated rows were marked; `¼ TL Flohsamenschalen` resolved as a new food → 0.8 g. That came from the AI-drafted `density: 0.6`, which took precedence over the estimate as designed.
  - Open, outside this change: Haiku sometimes gives the EL weight for a TL (`1½ TL Honig` at 21 g/TL, twice) and inflates liquids (Kokosmilch 20–30 g/EL). It also misread `¼ TL Zimt` as `½`. Catalog matching picked wrong foods (Honig → Honigmelone, Peanut-butter-Pulver → Butter).
- [x] 5.4 Run `openspec validate reliable-spoon-amounts --strict` and verify it passes.

## 6. Follow-up from the smoke test: spoon-weight plausibility guard

- [x] 6.1 In `convert-spoon-amount.test.ts` and `build-matched-row.test.ts`, add failing tests:
  - `1½ TL` with `gramsPerSpoon: 21` and `3 EL` with `30` are ignored, and the row falls back to `missingAmount` without `spoonEstimated`
  - honey at 21 g per EL and exactly 7.5 g per TL are still accepted

  Verify they fail.
- [x] 6.2 Discard estimates above `MAX_SPOON_DENSITY_G_PER_ML` (1.5) × the spoon's volume in `convertSpoonMeasure`, and update the spec deltas and design. Verify `make check` and `openspec validate reliable-spoon-amounts --strict` pass.

## 7. Rollout (manual, after deploy)

- [ ] 7.1 Run the saved-recipe audit from design → Migration Plan against the live `forkcast_data` volume. Review each hit and correct real spoon mistakes by hand in the recipe editor. Done when the list has been reviewed.
