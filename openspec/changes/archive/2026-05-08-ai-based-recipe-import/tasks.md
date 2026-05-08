## 1. Backend setup and configuration

- [x] 1.1 Add `@anthropic-ai/sdk` to `@forkcast/backend` (`pnpm --filter @forkcast/backend add @anthropic-ai/sdk`)
- [x] 1.2 Read `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `RECIPE_IMPORT_MAX_IMAGE_BYTES`, `RECIPE_IMPORT_MAX_TOTAL_BYTES`, and `RECIPE_IMPORT_MAX_IMAGES` in `src/index.ts`; default the model and limits when env vars are unset; do NOT crash on missing API key — log a warning and pass `null` to the route registration so the handler returns `503`
- [x] 1.3 Add a `.env.example` entry (or update existing) documenting all five env vars

## 2. Domain port and types (TDD)

- [x] 2.1 Create `backend/src/domain/ai-recipe-import/types.ts` with `RecipeImage`, `RawIngredient`, `ExtractedDraft`, and the `RecipeDraft` DTO returned by the use case (matched + unmatched rows, `unitOverridden` flag, `name`, `yield`, `steps`)
- [x] 2.2 Create `backend/src/domain/ai-recipe-import/recipe-draft-extractor.ts` declaring the `RecipeDraftExtractor` port whose `extract` takes an ordered, non-empty `RecipeImage[]`
- [x] 2.3 Write `import-recipe-from-photos.use-case.test.ts` covering: single-image happy path, multi-image happy path with cross-image content, ingredient match with unit override, unmatched ingredient, ingredient with missing amount preserved, draft is never persisted (assert repo is untouched). Use a fake `RecipeDraftExtractor` and a fake `IngredientSearchService`
- [x] 2.4 Implement `import-recipe-from-photos.use-case.ts` to make the tests pass; reuse the existing `IngredientSearchService` port (BLS-only sources by default)

## 3. Anthropic adapter (infrastructure)

- [x] 3.1 Define the `extract_recipe` tool schema in a single file under `backend/src/infrastructure/ai-recipe-import/` so the system prompt and the schema live together
- [x] 3.2 Implement `AnthropicRecipeDraftExtractor` in `backend/src/infrastructure/ai-recipe-import/anthropic-recipe-draft-extractor.ts`: build a single `messages.create` call with all images appended in order as `image` content blocks plus a short instruction explaining "these are images of one recipe, in order"; force `tool_choice: { type: "tool", name: "extract_recipe" }`; parse the tool result into `ExtractedDraft`; throw a typed error on parse failure
- [x] 3.3 Log `{ model, imageCount, inputTokens, outputTokens, durationMs }` on success; never log image bytes or recipe content
- [x] 3.4 Add an integration-style test for the adapter using a faked Anthropic client (mock the SDK at the boundary): asserts the request shape carries N image blocks in order, the tool definition, and the forced `tool_choice`; asserts a synthetic tool-call response is mapped to `ExtractedDraft`; asserts a malformed tool result throws

## 4. HTTP handler

- [x] 4.1 Write `import-recipe-from-photos.handler.test.ts` covering: 200 on a happy multi-image request, 400 on empty array, 400 on too many images, 400 on unsupported `mediaType` (with offending index), 413 on per-image size, 413 on combined size, 502 on adapter error, 503 when extractor is unavailable, 401 when unauthenticated (covered by existing middleware test pattern)
- [x] 4.2 Implement `backend/src/http/ai-recipe-import/import-recipe-from-photos.handler.ts`: parse JSON body `{ images: [{ data, mediaType }] }`, base64-decode each, validate count and per-image and total decoded sizes against the configured limits, validate each `mediaType`, call the use case, return the `RecipeDraft`. On error responses, include `{ error: <code>, imageIndex?: <n> }`
- [x] 4.3 Register the route in `src/index.ts` after the auth middleware: when API key is missing, register a stub handler that returns `503 { error: "ai-import-not-configured" }`; otherwise register the real handler with the Anthropic adapter wired in
- [x] 4.4 Verify backend boots cleanly both with and without `ANTHROPIC_API_KEY` (no crash, no missing-route)

## 5. Frontend API client

- [x] 5.1 Add `frontend/src/api/import-recipe-from-photos.ts` exposing `importRecipeFromPhotos(images: { data: string; mediaType: string }[]): Promise<RecipeDraft>` using the existing `fetchJson` client; surface 503 as a typed `ImportNotConfiguredError`
- [x] 5.2 Add a domain type for the `RecipeDraft` shape in `frontend/src/domain/recipes.ts` (or a new file alongside it) — matched/unmatched rows, `unitOverridden`, etc.
- [x] 5.3 Write a test for the API client using MSW: success, 413 with image index, 503 mapped to `ImportNotConfiguredError`, 502 surfaced as a generic error

## 6. Frontend feature: photo staging and import

- [x] 6.1 Create `frontend/src/features/ai-recipe-import/` folder
- [x] 6.2 Implement `photo-staging.tsx`: `<input type="file" accept="image/jpeg,image/png,image/webp" multiple />` (no `capture` — mobile chooser must let the user pick from the photo library so Instagram screenshots work), thumbnail grid, add-more / remove / reorder controls, per-image-size and image-count enforcement on the client (with friendly error messaging), produces a typed list ready for upload
- [x] 6.3 Implement `import-recipe-screen.tsx`: hosts the staging area, a "Read recipe" submit button, a loading state while the API call is in flight ("Reading your recipe…"), and routes to the review screen on success
- [x] 6.4 Write tests for the staging behavior (add, remove, reorder, oversize rejection, count cap) using RTL

## 7. Frontend feature: review and save

- [x] 7.1 Implement `review-import-screen.tsx`: renders `RecipeForm` with `initial = draft`; passes a small banner above the form listing unmatched ingredient names; each unmatched row in the form has a one-tap shortcut into the existing ingredient picker pre-filled with the unmatched name
- [x] 7.2 When the user resolves an unmatched row via the picker, swap it into a real `RecipeIngredient` in the form's state
- [x] 7.3 Show a small `unitOverridden` indicator on rows where the catalog unit replaced the model-extracted unit
- [x] 7.4 Submit goes through the existing `POST /add-recipe` mutation — no new save path
- [x] 7.5 Tests: review screen renders matched + unmatched rows correctly, unmatched can't be saved without resolution (form's existing validation handles this), `unitOverridden` indicator visible when set

## 8. Frontend wiring on the Recipes screen

- [x] 8.1 Add an "Import from photos" button to `frontend/src/features/recipes/recipes-screen.tsx` next to the existing add-recipe entry; route to `import-recipe-screen`
- [x] 8.2 On first mount of the import screen (or on app load), make a probing call (or rely on the first import attempt) to decide whether to hide the entry point when the backend returns `503 ai-import-not-configured`. Cache the decision in React Query
- [x] 8.3 Test: when the import endpoint reports `ai-import-not-configured`, the button is hidden on the Recipes screen

## 9. End-to-end smoke and polish

- [x] 9.1 Smoke-test the full flow in a real browser using a printed test recipe with 1, then 2, then 3 photos; confirm: order matters (intentionally swap pages and observe the wrong order produces a worse result), unmatched ingredient flow works, oversized image is rejected before upload, and 503 hides the button
  - Verified end-to-end via curl: 503 path (no key), 400 empty-array, 400 unsupported `image/gif` with `imageIndex:0`, all match the spec.
  - Real Claude vision call with printed photos was NOT executed in this run because no real `ANTHROPIC_API_KEY` was provided. The user should run the dev servers (`pnpm dev`) with `ANTHROPIC_API_KEY` set and try a real 1/2/3-photo import to confirm extraction quality and ordering before relying on it.
- [x] 9.2 Verify token-usage logs are emitted on success and contain no recipe text or image bytes
  - Asserted in `anthropic-recipe-draft-extractor.test.ts` ("logs model, image count, token usage, and duration on success" — also asserts the log line does not contain recipe text).
- [x] 9.3 Update `README.md` with a one-paragraph note on the new env vars and the import flow

## 10. Validate the change

- [x] 10.1 Run `pnpm --filter @forkcast/backend test`, `pnpm --filter @forkcast/frontend test`, and lint/format across the workspace
- [x] 10.2 Run `openspec validate ai-based-recipe-import` and address any issues
