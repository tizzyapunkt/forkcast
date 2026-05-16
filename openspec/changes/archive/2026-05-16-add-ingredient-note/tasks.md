## 1. Backend: domain — add `note` to RecipeIngredient + validate

- [x] 1.1 Add `note?: string` to `RecipeIngredient` in `backend/src/domain/recipes/types.ts`.
- [x] 1.2 Write failing test in `backend/src/domain/recipes/validate-ingredient-shape.test.ts`: a tracked ingredient with `note: "fein gehackt"` is accepted.
- [x] 1.3 Write failing test: an untracked ingredient with `note: "frisch gemahlen"` (alongside `displayQuantity`) is accepted.
- [x] 1.4 Write failing test: an ingredient with empty `note` (`""`) or whitespace-only `note` (`"   "`) is rejected.
- [x] 1.5 Write failing test: an ingredient with a `note` whose trimmed length is 81+ characters is rejected.
- [x] 1.6 Write failing test: an ingredient with `note: "  fein gehackt  "` is rejected by the validator (the caller is expected to trim before validating — confirm/align with the existing convention; if the existing convention is "validator trims and accepts", flip the test). Document the convention in code comments only if it's non-obvious. _(Flipped per the existing convention: validator accepts surrounded whitespace; trimming on persistence happens in the use case — see §2.)_
- [x] 1.7 Implement the validation rules in `validate-ingredient-shape.ts` and add a `NOTE_MAX_LENGTH = 80` constant exported from the same file.
- [x] 1.8 Confirm tests 1.2–1.6 pass.

## 2. Backend: trim/normalize `note` at the use-case boundary

- [x] 2.1 Write failing test in `backend/src/domain/recipes/add-recipe.use-case.test.ts`: when the payload carries `note: "  fein gehackt  "`, the persisted recipe carries `note: "fein gehackt"` (trimmed).
- [x] 2.2 Write failing test in `add-recipe.use-case.test.ts`: when the payload omits `note`, the persisted ingredient row has no `note` field.
- [x] 2.3 Write failing test in `backend/src/domain/recipes/update-recipe.use-case.test.ts`: an update where one ingredient gains a `note`, one changes its `note`, and one drops its `note` (omitted from payload) persists all three transitions correctly.
- [x] 2.4 Implement trim-then-omit-when-empty for `note` in the add-recipe / update-recipe input normalization step (wherever the existing per-ingredient normalization lives — likely a small helper next to the use cases or inline in the handler input adapter). _(Implemented as `normalize-ingredient.ts` helper; validator rejects empty/overlong so "omit when empty" reduces to "trim" inside the normalizer.)_
- [x] 2.5 Confirm tests 2.1–2.3 pass.

## 3. Backend: persistence backward-compat read-through

- [x] 3.1 Write failing test in `backend/src/infrastructure/recipes/json-recipe.repository.test.ts`: a recipe round-trip preserves `note` on each ingredient that has one.
- [x] 3.2 Write failing test: a recipe loaded from a fixture whose ingredient rows have no `note` field returns those rows without a `note` field (no field synthesised, no error).
- [x] 3.3 Confirm tests 3.1–3.2 pass (no production code change expected — the field flows through via the type — but the tests lock the behavior in).

## 4. Backend: ai-recipe-import — types + extractor schema

- [x] 4.1 Add `note?: string` to `RawIngredient`, `MatchedDraftIngredient`, and `UnmatchedDraftIngredient` in `backend/src/domain/ai-recipe-import/types.ts`.
- [x] 4.2 In `backend/src/infrastructure/ai-recipe-import/extract-recipe-tool.ts`, add a `note` property (type: string) to the ingredient sub-schema's `properties`, with a description that names it as the slot for prep/cut/quality modifiers (examples: "fein gehackt", "geschält", "in Scheiben").
- [x] 4.3 Update `EXTRACT_RECIPE_INSTRUCTIONS` so the naming-rules section instructs the model to put inline prep modifiers in `note`, not `steps`, and to leave `name` as the food noun only. Leading qualifiers stay on `name`. Remove the "if you strip a prep modifier from name, make sure the corresponding instruction appears somewhere in steps" sentence — the canonical home is `note` now.
- [x] 4.4 Write failing tests in `backend/src/infrastructure/ai-recipe-import/extract-recipe-tool.test.ts`:
  - `parseToolInput` populates `note` when the tool input carries a non-empty string;
  - it drops `note` when the value is empty or whitespace-only;
  - it drops `note` when the trimmed length exceeds 80;
  - it trims surrounding whitespace;
  - it leaves `note` absent when the input does not carry the field.
- [x] 4.5 Implement the parser changes in `extract-recipe-tool.ts` (add a `note?: unknown` field to `RawToolInputIngredient`, then the trim/drop logic).
- [x] 4.6 Confirm tests 4.4 pass.

## 5. Backend: matching pipeline — `note` rides along

- [x] 5.1 Write failing test in `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.test.ts`: when the extractor returns `{ name: "Ingwer", note: "fein gehackt", ... }` and the catalog matches `"Ingwer"`, the resulting `MatchedDraftIngredient` carries `note: "fein gehackt"`.
- [x] 5.2 Write failing test: when the extractor returns `{ name: "Yuzu-Schale", note: "fein abgerieben", ... }` and no match is found, the resulting `UnmatchedDraftIngredient` carries `note: "fein abgerieben"`.
- [x] 5.3 Write failing test: when the extractor returns an ingredient with no `note`, the resulting draft row has no `note` field (regardless of match outcome).
- [x] 5.4 Write failing test: the presence/absence of `note` does NOT affect the normalization fallback, the unmatched recorder, or the existing match flags (`unitOverridden`, `pieceQuantityDropped`, `untrackedInherited`). Cover with one combined assertion.
- [x] 5.5 Implement the `note` pass-through in `matchIngredient` inside `import-recipe-from-photos.use-case.ts` — both branches (matched / unmatched) copy `raw.note` onto the resulting draft row when present.
- [x] 5.6 Confirm tests 5.1–5.4 pass.

## 6. Frontend: types + domain mirror

- [x] 6.1 Add `note?: string` to `RecipeIngredient` in `frontend/src/domain/recipes.ts`.
- [x] 6.2 Add `note?: string` to whatever draft-ingredient types the frontend mirrors for the review-import screen (likely in `frontend/src/features/ai-recipe-import/`). _(Done in same file: `MatchedDraftIngredient`, `UnmatchedDraftIngredient`, and `RawIngredientDebug` for the debug screen.)_
- [x] 6.3 Confirm `pnpm --filter @forkcast/frontend typecheck` passes.

## 7. Frontend: recipe form note editor

- [x] 7.1 Add the note subtitle input to `frontend/src/features/recipes/recipe-ingredient-editor.tsx`. Render below the name line, distinct from the displayQuantity subtitle when both are present.
- [x] 7.2 Wire the input through `recipe-form.tsx` state: `note` is form-controlled per row, trimmed on save, omitted from payload when empty after trim.
- [x] 7.3 Write failing RTL test for `recipe-ingredient-editor`: editing the note input updates the row's `note`, and clearing it removes the field from the row.
- [x] 7.4 Write failing RTL test for the recipe form save path: a form with one ingredient that has a non-empty note and one with an empty note produces a save payload where only the first row carries `note`.
- [x] 7.5 Implement the changes in 7.1–7.2; confirm tests 7.3–7.4 pass.
- [x] 7.6 Decide ingredient-replacement behavior in the recipe form (when the user replaces an ingredient via the picker, the note is cleared). Add a test covering this and implement. _(Existing `handleReplace` builds a fresh row without `note`, so no code change was required — the test locks the behavior in.)_

## 8. Frontend: review-import screen note subtitle

- [x] 8.1 In `frontend/src/features/ai-recipe-import/review-import-screen.tsx`, render the `note` as a subtitle on each draft row (matched and unmatched) when present. _(Matched rows inherit subtitle rendering from the recipe form's editor (§7); unmatched rows get a dedicated subtitle in the header list.)_
- [x] 8.2 Ensure the review-screen save action threads `note` through to the `add-recipe` call payload unchanged. _(Implemented by copying `note` in `buildInitialMatchedIngredients`; the recipe form normalizer handles the rest.)_
- [x] 8.3 Write failing RTL test: a draft with one ingredient carrying `note: "fein gehackt"` renders the subtitle; submitting the review sends `note: "fein gehackt"` in the payload.
- [x] 8.4 If the review screen supports replacing an ingredient via the picker, write a failing test that asserts the note is cleared on replace, and implement. _(Picker-resolution of an unmatched row produces a fresh `RecipeIngredient` from the picker output, which never carries the previous note — locked in by test.)_
- [x] 8.5 Confirm tests 8.3–8.4 pass.

## 9. Verification

- [x] 9.1 Run `pnpm --filter @forkcast/backend test` — all green. _(485/485)_
- [x] 9.2 Run `pnpm --filter @forkcast/frontend test` — all green. _(352/352 after adding the recipe-detail note test)_
- [x] 9.3 Smoke test in Chrome (HTTPS disabled in `vite.config.ts` per project convention):
  - Create a recipe from scratch, add an ingredient, type a note in the subtitle input, save, re-open — note persists and renders. ✓ `Note-Smoke-Test` recipe with `Ingwer` + note `fein gehackt`; verified via `recipes.json` round-trip.
  - Edit an existing recipe, change a note on one ingredient, clear the note on another, save, re-open — both edits stick. ✓ Changed `fein gehackt` → `grob gehackt` → cleared (field removed from JSON) → re-added `frisch gerieben`.
  - Import a recipe from a photo that contains at least one ingredient with an inline prep modifier (e.g. `"Ingwer, fein gehackt"`). On the review screen, confirm the note subtitle renders. Save and re-open — the note is preserved on the recipe form. **Deferred** — requires a real Anthropic API call with photos; the path is covered by unit tests (extractor parser, matching pipeline, review-import screen — see §4, §5, §8).
  - Confirm the recipe read view (if/wherever the recipe renders read-only) shows the note as a subtitle. ✓ Added the subtitle render to `recipe-detail.tsx` and covered with a new test.
  - Confirm the meal-log entry display does NOT show notes (negative check — they're intentionally hidden there). ✓ Logged the recipe into Frühstück; entry shows `Ingwer` / `AUS NOTE-SMOKE-TEST` / `5 g` / macros only — no note rendered.
- [x] 9.4 Run `openspec validate add-ingredient-note --type change` — clean.
