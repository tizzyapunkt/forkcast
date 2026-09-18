## 1. Backend: capture the verbatim line (TDD)

- [x] 1.1 In `extract-recipe-tool.test.ts`, add failing parser tests matching the spec scenarios:
  - `sourceText` is kept and trimmed
  - empty or whitespace-only values are dropped
  - values over 200 characters are dropped while name, amount, piece fields and note are kept
  - a missing value is fine
  - a piece row with `sourceText` still resolves `amount`/`unit`/`pieceQuantity` exactly as before

  Verify they fail with `pnpm --filter @forkcast/backend test extract-recipe-tool`.
- [x] 1.2 Add `sourceText?: string` to `RawIngredient` in `domain/ai-recipe-import/types.ts`, and parse it in `parseToolInput` (trim, drop empty, drop if over 200 characters). Verify the 1.1 tests pass.
- [x] 1.3 Add `sourceText` as the **first** ingredient property in `EXTRACT_RECIPE_TOOL`. Keep it optional, not in `required`. Its description should say it is a verbatim transcription that is exempt from the naming, quantification and note rules.
- [x] 1.4 Add a "Transcription rule" block to `EXTRACT_RECIPE_INSTRUCTIONS`. It covers always populating the field, no normalizing, translating, unit conversion, fraction resolving or estimates, stripping only list markers, the same line on both rows when one line splits, and joined lines across images. Include worked examples for `1 mittelgroße Zwiebel, gewürfelt`, `2 EL Olivenöl`, `½ TL Kreuzkümmel` and `Salz und Pfeffer`. Verify with a test that asserts the schema exposes `sourceText` as an optional string listed first, and that the instructions mention verbatim transcription.
- [x] 1.5 In `import-recipe-from-photos.use-case.test.ts`, add tests for:
  - `provenance.ingredients[i].raw.sourceText` equals the extractor's value on both matched and unmatched rows
  - no draft ingredient row carries `sourceText`

  Verify they pass. No use-case code change is expected, because `raw` is passed through and rows are built field by field. If a test fails, fix the leak.
- [x] 1.6 In `anthropic-recipe-draft-extractor.test.ts`, assert that the info log line doesn't contain a `sourceText` value (observability requirement: no recipe text in logs). Verify it passes.

## 2. Frontend: formatter and shared raw line (TDD)

- [x] 2.1 Add `sourceText?: string` to `RawIngredientProvenance` in `frontend/src/domain/recipes.ts`. Verify with `pnpm --filter @forkcast/frontend typecheck`.
- [x] 2.2 Create `features/recipes/ingredient-provenance.test.ts` with failing `formatRawIngredient` cases, one per spec fallback scenario:
  - `sourceText` wins verbatim over amount, unit and piece data
  - piece row without `sourceText` gives `1 Zwiebel`, with no `150` and no duplicated name
  - `{ amount: 2, unitLabel: "Zehe" }` + `Knoblauch` gives `2 Zehe Knoblauch`
  - raw display quantity beats a canonical conversion: `2 EL Olivenöl`, not `30 ml`
  - a mass-stated row gives `200 g Mehl`
  - a name-only row gives just the name

  Verify they fail.
- [x] 2.3 Reorder `formatRawIngredient` per design Decision 4: `sourceText`, then piece (using `formatPieceCount`, with the name dropped when it folds equal to `unitLabel`), then raw display, then canonical amount, then name. Update its doc comment. Verify the 2.2 tests pass.
- [x] 2.4 Extract a `RawReadLine` component in `features/recipes/`. It takes the formatted text and the row name, and renders the existing `gelesen: „…"` copy, aria-label and subdued truncated style. Switch `recipe-ingredient-editor.tsx` to use it. Verify the existing raw-line tests in `recipe-ingredient-editor.test.tsx` and `review-import-screen.test.tsx` still pass unchanged.

## 3. Frontend: raw line on unmatched rows

- [x] 3.1 In `review-import-screen.test.tsx`, add failing tests:
  - a matched piece row whose provenance has `sourceText: "1 mittelgroße Zwiebel, gewürfelt"` shows that text and not `150 g` in its raw line
  - an unmatched row whose provenance has `sourceText: "2 Stangen Zitronengras, angedrückt"` shows it in the unmatched panel

  Verify they fail.
- [x] 3.2 In `review-import-screen.tsx`, pair each `UnmatchedEntry` with `draft.provenance?.ingredients[index]` inside `collectUnmatched`, and render a `RawReadLine` on the panel row when provenance is present. Verify the 3.1 tests pass.
- [x] 3.3 In `resolve-pane.test.tsx`, add failing tests:
  - in import context with a `rawLine` on the item, the header shows it
  - without `rawLine`, or in create context, no raw line renders

  Verify they fail.
- [x] 3.4 Add `rawLine?: string` to `ResolveItem`, and render a `RawReadLine` in the import-context item header of `resolve-pane.tsx`. In `review-import-screen.tsx`, set `rawLine` on `openItem` from the entry's provenance through `formatRawIngredient`. Verify the 3.3 tests pass. Also add one test in `review-import-screen.test.tsx` that opens the sheet for the unmatched row and sees its raw line.

## 4. Verification

- [x] 4.1 Run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm format` from the repo root, and verify all are green.
- [x] 4.2 Smoke-test in Chrome with Vite HTTPS disabled. Import a real recipe photo that has a counted food with a size word (e.g. `1 mittelgroße Zwiebel`), a spoon measure (`2 EL …`), a fraction glyph (`½`) and at least one unmatched ingredient. Verify:
  - matched and unmatched rows and the resolve sheet header show the printed line verbatim
  - no raw line shows an estimated gram total
  - the saved recipe is unchanged in shape

  Note any paraphrasing by the model for prompt tuning.
- [x] 4.3 Run `openspec validate verbatim-ingredient-read --strict` and verify it passes.
