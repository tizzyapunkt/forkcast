## 1. Backend: unmatched-ingredient domain + storage

- [x] 1.1 Add `backend/src/domain/unmatched-ingredients/types.ts` with `UnmatchedIngredientSample`, `UnmatchedIngredientEntry`, and `UnmatchedIngredientStore` types.
- [x] 1.2 Add the `UnmatchedIngredientRecorder` port type in the same file (or in `backend/src/domain/ai-recipe-import/types.ts`, whichever keeps imports cleanest).
- [x] 1.3 Write failing test `backend/src/domain/unmatched-ingredients/record-unmatched.test.ts`: recording a new folded name creates an entry with `count: 1`, equal `firstSeenAt`/`lastSeenAt`, and one sample.
- [x] 1.4 Write failing test: recording a name whose folded form matches an existing entry increments `count`, updates `lastSeenAt`, leaves `firstSeenAt` unchanged, and appends the sample.
- [x] 1.5 Write failing test: a sixth sample on an entry drops the oldest sample (keeps length 5).
- [x] 1.6 Write failing test: folding is case- and diacritic-insensitive (`Möhre`, `möhre`, `MOHRE` produce one entry with `count: 3`).
- [x] 1.7 Implement the pure `recordUnmatched(store, raw, now)` function in `backend/src/domain/unmatched-ingredients/record-unmatched.ts`, reusing the existing fold helper.
- [x] 1.8 Confirm tests 1.3–1.6 pass.

## 2. Backend: JSON-file adapter

- [x] 2.1 Write failing test `backend/src/infrastructure/unmatched-ingredients/json-unmatched-store.test.ts`: round-trip read/write of a non-empty store preserves field order and trailing newline.
- [x] 2.2 Write failing test: concurrent `record()` calls serialize through the in-memory promise queue and produce the correct final state.
- [x] 2.3 Write failing test: loading a file that does not exist returns `{ entries: [] }` and writing creates the file.
- [x] 2.4 Write failing test: an entry with non-string `name` or non-finite `count` is dropped on load with a warning, leaving the remaining valid entries intact.
- [x] 2.5 Implement `backend/src/infrastructure/unmatched-ingredients/json-unmatched-store.ts`: load, write (sorted by `foldedName`, single trailing newline), and `record(raw)` that calls `recordUnmatched` and persists.
- [x] 2.6 Confirm tests 2.1–2.4 pass.

## 3. Backend: wire recorder into ai-recipe-import use case

- [x] 3.1 Extend `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.ts` with an optional `recorder?: UnmatchedIngredientRecorder` field on `ImportRecipeFromPhotosDeps`.
- [x] 3.2 Write failing test `import-recipe-from-photos.use-case.test.ts`: when an extracted ingredient produces zero FOODS hits and a recorder is in deps, `recorder.record` is called exactly once with the original `RawIngredient`.
- [x] 3.3 Write failing test: when the recorder is absent from deps, no recording is attempted and the draft is unchanged.
- [x] 3.4 Write failing test: matched ingredients (including unit-overridden, piece-dropped, untracked-inherited) never trigger the recorder.
- [x] 3.5 Write failing test: when `recorder.record` throws, the use case continues processing remaining ingredients and returns the full draft.
- [x] 3.6 Implement the recorder call inside the `matchIngredient` strict-unmatched branch, wrapped in try/catch with a console.error log.
- [x] 3.7 Confirm tests 3.2–3.5 pass.

## 4. Backend: HTTP endpoints

- [x] 4.1 Add `backend/src/http/unmatched-ingredients/export.handler.ts` returning `200 { entries }`.
- [x] 4.2 Add `backend/src/http/unmatched-ingredients/clear.handler.ts` returning `204` after atomic truncate.
- [x] 4.3 Write failing handler test for `export`: returns current entries, no side effects, 401 when unauthenticated.
- [x] 4.4 Write failing handler test for `clear`: empties the store, returns 204, 401 when unauthenticated, idempotent when called on an already-empty store.
- [x] 4.5 Mount both routes inside the existing auth middleware in `backend/src/index.ts` and construct the JSON store once at boot (passing it into both the recorder dep for the import handler and the new export/clear handlers).
- [x] 4.6 Confirm handler tests pass.

## 5. Frontend: unmatched-ingredients panel

- [x] 5.1 Add `frontend/src/api/unmatched-ingredients.ts` with `fetchUnmatchedIngredients()` and `clearUnmatchedIngredients()` wrappers.
- [x] 5.2 Add a React Query hook in `frontend/src/features/unmatched-ingredients/use-unmatched-ingredients.ts` returning `{ count, entries }`.
- [x] 5.3 Add `frontend/src/features/unmatched-ingredients/unmatched-ingredients-panel.tsx` rendering the count, an **Export** button, and a **Clear** button (both disabled with tooltip when count is 0).
- [x] 5.4 Implement Export: fetch, build `Blob`, trigger download with filename `unmatched-ingredients-YYYYMMDD-HHMM.json` (local time).
- [x] 5.5 Implement Clear: open a vaul drawer/confirm dialog stating the count; on confirm, call the clear endpoint and invalidate the React Query.
- [x] 5.6 Add a section/menu link to surface the panel from the settings drawer (or equivalent existing surface — finalize during implementation).
- [x] 5.7 Write failing test (RTL + MSW) that the buttons are disabled when count is 0, enabled when count > 0, and clicking Clear shows the confirm dialog before calling the API.
- [x] 5.8 Confirm test 5.7 passes.

## 6. Build script: build:foods:augment

- [x] 6.1 Add `backend/scripts/build-foods-classifier-tool.ts` exporting the Haiku classifier tool name, tool schema (`synonym-of | new-food | skip`), and system prompt.
- [x] 6.2 Add `backend/scripts/build-foods-augment.ts` skeleton: load exported JSON, load `foods.json`, parse `foods-seed-keys.ts` into an in-memory list.
- [x] 6.3 Write failing unit test for the seed-file parser/append helper: appending a new tracked key preserves comments and grouping; appending an untracked key writes the `{ key, untracked: true }` form.
- [x] 6.4 Write failing unit test for the synonym-append helper: dedupe is case-insensitive, refuses to add the canonical name, leaves existing synonyms untouched.
- [x] 6.5 Implement the parsers/appliers from 6.3 and 6.4 (no Anthropic dependency in these helpers — keep them testable).
- [x] 6.6 Confirm tests 6.3 and 6.4 pass.
- [x] 6.7 Implement the Haiku call per unmatched entry, passing the unmatched name, count, samples, and a compact view of existing FOODS entries (`{ id, name, synonyms }`).
- [x] 6.8 Implement the terminal HITL prompt (node:readline): print verdict + samples + count, accept single-character actions `a/e/s/r`. `edit` allows switching verdict, target id, or proposed key, and a `[u]ntracked` modifier for new foods.
- [x] 6.9 Implement the Opus draft call for accepted `new-food` verdicts, reusing the existing `build-foods-tool.ts` and `BUILD_FOODS_SYSTEM_PROMPT`.
- [x] 6.10 Implement atomic write of `foods.json` (re-sort by id, validate every entry with `validate-food-entry.ts`, write via tmp file + rename) and append-write of `foods-seed-keys.ts` using the helper from 6.5.
- [x] 6.11 Implement `--dry-run`: collect all accepted decisions in memory, print the diff summary, exit 0 without writing.
- [x] 6.12 Add the `build:foods:augment` script to `backend/package.json`.

## 8. Name normalization (added mid-implementation)

- [x] 8.1 Add `backend/src/domain/ai-recipe-import/normalize-ingredient-name.ts` that strips a trailing `, …` clause and a trailing `(…)` parenthetical from a name string, preserves leading qualifiers, collapses whitespace, and returns the trimmed original when stripping would empty the string.
- [x] 8.2 Failing tests in `normalize-ingredient-name.test.ts` cover: comma-suffix strip, parenthetical strip, both together, leading-qualifier preservation, whitespace collapse, no-op pass-through, empty-after-strip fallback.
- [x] 8.3 Failing tests in `import-recipe-from-photos.use-case.test.ts` cover: retry with normalized name on empty result, recorder receives normalized name when both attempts fail, no retry when raw matches, no retry when normalization is a no-op.
- [x] 8.4 In `import-recipe-from-photos.use-case.ts`, wire the normalization fallback into `matchIngredient`: retry the search once with the normalized name when the first call returns zero results; pass the normalized name to the recorder when still unmatched.
- [x] 8.5 In `extract-recipe-tool.ts`, tighten the `name` field description and add naming-rule bullets to `EXTRACT_RECIPE_INSTRUCTIONS` requiring the food noun only, with prep modifiers moved into `steps` (and leading qualifiers preserved).
- [x] 8.6 Confirm all backend tests pass.

## 7. Verification

- [x] 7.1 Run `pnpm --filter @forkcast/backend test` — all green. (444 tests passed.)
- [x] 7.2 Run `pnpm --filter @forkcast/frontend test` — all green. (339 tests passed.)
- [x] 7.3 Smoke test in Chrome (with HTTPS disabled in `vite.config.ts` per project convention): import a recipe that contains at least one unfamiliar ingredient, confirm the count in the panel increments, click Export and verify the downloaded JSON, click Clear and verify the count returns to 0.
- [x] 7.4 Smoke test the augment script: export the JSON from 7.3, run `pnpm --filter @forkcast/backend build:foods:augment <path> --dry-run`, confirm the proposed diff. Then re-run without `--dry-run`, confirm `foods.json` and `foods-seed-keys.ts` are updated, and re-import the same recipe in the UI to confirm the previously-unmatched ingredient now matches.
- [x] 7.5 Run `openspec validate extend-foods-from-unmatched-imports --type change` — clean.
