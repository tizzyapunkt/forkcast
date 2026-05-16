## 1. Backend: debug payload types and use-case wiring

- [x] 1.1 In `backend/src/domain/ai-recipe-import/types.ts`, add `SearchCandidateDebug`, `IngredientMatchDebug`, and `RecipeDraftDebug`; extend `RecipeDraft` with `debug?: RecipeDraftDebug`.
- [x] 1.2 Write a failing test in `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.test.ts` for a matched ingredient: with `includeDebug: true`, the result has `debug.ingredients[0]` with `raw`, `candidates`, `chosen`, and `flags.unitOverridden`.
- [x] 1.3 Write a failing test for an unmatched ingredient: `chosen` is `null`, `candidates` is `[]`, all flags are `false`.
- [x] 1.4 Write a failing test for a piece-quantity drop case: `flags.pieceQuantityDropped` is `true` when catalog unit is non-mass and model returned piece fields.
- [x] 1.5 Write a failing test for the untracked-inheritance case: `flags.untrackedInherited` is `true` when the FOODS match has `untracked: true`.
- [x] 1.6 Write a failing test that, without `includeDebug`, the `debug` field is absent (not `null`, not `{}`).
- [x] 1.7 Write a failing test that the search-candidate list is capped at 5 even when the search returns more.
- [x] 1.8 In `import-recipe-from-photos.use-case.ts`, accept an `includeDebug?: boolean` option; when true, collect raw/candidates/chosen/flags inside `matchIngredient` and assemble `debug` onto the returned draft. Cap candidates at 5.
- [x] 1.9 Confirm tests 1.2–1.7 pass.

## 2. Backend: HTTP wiring and config

- [x] 2.1 In `backend/src/http/ai-recipe-import/import-recipe-from-photos.handler.ts`, extend `ImportRecipeFromPhotosHandlerDeps` with `includeDebug: boolean`; pass it through to the use case.
- [x] 2.2 Write a failing handler test that, given `includeDebug: true`, the response JSON includes `debug.ingredients`.
- [x] 2.3 Write a failing handler test that, given `includeDebug: false` (default), the response JSON has no `debug` key.
- [x] 2.4 In `backend/src/index.ts`, read `process.env.RECIPE_IMPORT_DEBUG` once at startup, coerce to boolean (any non-empty/non-`"0"`/non-`"false"` value is truthy), and pass it into the handler deps. (Implemented via `loadAppConfig` to follow the existing config pattern; flag is `config.ai.recipeImport.debug`.)
- [x] 2.5 Confirm handler tests pass.

## 3. Frontend: response type and debug box

- [x] 3.1 In the frontend recipe domain types (mirror of `backend/src/domain/ai-recipe-import/types.ts`), add `SearchCandidateDebug`, `IngredientMatchDebug`, and `RecipeDraftDebug`; extend `RecipeDraft` with `debug?: RecipeDraftDebug`.
- [x] 3.2 In `frontend/src/api/import-recipe-from-photos.ts`, ensure the JSON parser passes the new optional `debug` field through untouched (no transformation). (Already pass-through via `fetchJson<RecipeDraft>` — extending `RecipeDraft` was sufficient; no code change needed.)
- [x] 3.3 Write a failing test in `frontend/src/features/ai-recipe-import/review-import-screen.test.tsx` that, when `draft.debug` is undefined, no element with the debug-box test-id is rendered.
- [x] 3.4 Write a failing test that, when `draft.debug.ingredients` has one matched entry with `flags.unitOverridden: true`, the debug box renders (collapsed) and, after the user clicks the toggle, the raw name, chosen name, candidate list, and an `unitOverridden` indicator are visible.
- [x] 3.5 Add a `DebugBox` component (kept local to `frontend/src/features/ai-recipe-import/`) that renders the collapsible structure described in design.md, taking `RecipeDraftDebug` as a prop. Labels stay in English.
- [x] 3.6 In `review-import-screen.tsx`, render `<DebugBox debug={draft.debug} />` below the existing form output when `draft.debug` is present.
- [x] 3.7 Confirm frontend tests pass.

## 4. Verification

- [x] 4.1 Run `pnpm --filter @forkcast/backend test` — all green. (414 tests passed.)
- [x] 4.2 Run `pnpm --filter @forkcast/frontend test` — all green. (337 tests passed.)
- [x] 4.3 Smoke test in Chrome: start the backend with `RECIPE_IMPORT_DEBUG=1`, run the frontend, import a recipe from at least one photo, expand the debug box, confirm raw/chosen/candidates/flags render. Then restart the backend without the env var and confirm the box does not appear.
- [x] 4.4 Run `openspec validate recipe-import-match-debug` — clean.
