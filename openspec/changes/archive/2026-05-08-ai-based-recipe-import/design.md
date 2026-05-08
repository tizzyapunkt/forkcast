## Context

Recipes today are entered through `recipe-form.tsx` — name, yield, an ingredient list (each row picks from the existing search service which spans BLS + recently-used + OFF), and ordered cooking steps. The backend exposes `POST /add-recipe` (use case at `backend/src/domain/recipes/add-recipe.use-case.ts`) plus a `RecipeRepository` port and a JSON file adapter.

Outside that, the system already has an ingredient catalog with two sources behind a single port:

- `IngredientSearchService.searchByName(query, sources?)` returns `IngredientSearchResult[]` with `{ id, source, name, unit, macrosPerUnit }`
- BLS (German nutrition DB) is the high-quality source; OFF (Open Food Facts) is barcode-oriented

Recipe ingredient rows persist `{ name, unit, macrosPerUnit, amount }` — so once we know the unit and per-unit macros for an extracted ingredient, it slots into the existing schema unchanged.

The frontend is a single-bundle PWA (React 18 + React Query + RHF + Zod). All API requests go through `/api/*` via the Vite dev proxy and through the same path in production. Auth is a JWT cookie applied to every API route via Hono middleware.

We do not have any LLM integration today.

## Goals / Non-Goals

**Goals:**

- One-shot path from "one or more photos of a single recipe" to "saved recipe" with a single mandatory review step
- Support multi-image inputs that all describe the same recipe (e.g. an Instagram carousel screenshot, front + back of a recipe card) — the model sees every image in a single request so context flows across pages
- Reuse the existing recipe schema, repository, and `add-recipe` use case unchanged for persistence
- Reuse the existing `IngredientSearchService` to match extracted ingredient names to nutrition data
- Keep the AI provider behind a domain port so the model and provider can be swapped later
- Fail loudly and clearly when the API key is missing, an image is too large, the combined payload is too large, or the model returns an unparseable result — never persist a half-broken draft

**Non-Goals:**

- Auto-save without review (the user always confirms)
- Stitching photos of _different_ recipes into one (each import is one recipe)
- OCR-only fallback, or recipe imports from URL/text/voice (separate future changes)
- Estimating per-ingredient amounts when no photo shows them — if amount is missing, surface it as missing rather than guessing
- Caching or deduplicating import calls — every import is a fresh extraction
- Background/async processing — the import is a single synchronous request from the user's perspective
- Cost controls beyond per-image and per-request size limits (no rate limits, no monthly quotas — this is single-user)

## Decisions

### 1. Claude vision via `@anthropic-ai/sdk` with structured tool use, all images in one call

**Choice:** Backend calls `messages.create` once per import. The user message contains **all submitted images in order** as separate `image` content blocks, followed by a short text instruction telling the model that the images are different views/pages of a single recipe. Plus a single `tool` definition (`extract_recipe`) whose JSON schema matches our draft DTO. We force tool use with `tool_choice: { type: "tool", name: "extract_recipe" }` so the model must return structured JSON — no free-text parsing.

**Why one call with all images, not one call per image then merge:** The model can resolve cross-image context that local merge cannot — e.g. an ingredient list that flows from page 1 onto page 2, or a "see step 4" reference. Anthropic's Messages API supports multiple `image` blocks in a single user turn natively, so this is just the natural shape.

**Why over JSON-in-prose:** Tool use guarantees a JSON object that conforms to the schema we declare; we don't have to write a regex/JSON-extraction layer. The model is also less likely to hallucinate fields outside the schema.

**Why over a third-party "extract recipe" library:** None of the open libraries we'd consider use vision; they parse `schema.org/Recipe` from HTML — a different feature.

**Tool schema (draft, refined in tasks):**

```jsonc
{
  "name": "extract_recipe",
  "input_schema": {
    "type": "object",
    "required": ["name", "ingredients", "steps"],
    "properties": {
      "name": { "type": "string" },
      "yield": { "type": "integer", "minimum": 1, "description": "Portions, default 1 if not visible" },
      "ingredients": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["name"],
          "properties": {
            "name": { "type": "string", "description": "The ingredient name as written, e.g. 'olive oil'" },
            "amount": { "type": "number", "description": "Numeric amount; omit if unclear" },
            "unit": {
              "type": "string",
              "enum": ["g", "ml", "oz", "cup", "tbsp", "tsp", "piece"],
              "description": "Omit if unclear",
            },
          },
        },
      },
      "steps": { "type": "array", "items": { "type": "string" } },
    },
  },
}
```

**Model:** Default `ANTHROPIC_MODEL` is the latest Claude Sonnet vision model (configurable). Sonnet over Opus for cost and latency; vision quality is sufficient for printed/handwritten recipes in our testing target.

### 2. Hexagonal port for the extractor — `RecipeDraftExtractor`

**Choice:** The domain defines:

```ts
// backend/src/domain/ai-recipe-import/recipe-draft-extractor.ts
export interface RecipeImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: Uint8Array;
}
export interface RawIngredient {
  name: string;
  amount?: number;
  unit?: MeasurementUnit;
}
export interface ExtractedDraft {
  name: string;
  yield: number;
  ingredients: RawIngredient[];
  steps: string[];
}
export interface RecipeDraftExtractor {
  // Order matters: images are passed to the model in the given order so it can
  // follow page sequence (e.g. ingredients on page 1, steps on page 2).
  extract(images: RecipeImage[]): Promise<ExtractedDraft>;
}
```

The Anthropic SDK never appears in the domain; the adapter at `backend/src/infrastructure/ai-recipe-import/anthropic-recipe-draft-extractor.ts` implements the port.

**Why an array of images in the port (not a single image):** The domain models the user's intent — "this is one recipe, here are the photos of it." Hiding multi-image behind the port leaks fewer details to the use case and lets a future single-image-at-a-time provider implement the same port by concatenating internally.

**Why:** Mirrors the `IngredientSearchService` / `RecipeRepository` patterns already in the codebase. Lets us substitute a fake extractor in domain tests (no SDK calls in unit tests, no API key needed in CI).

### 3. Use case: extract → match → assemble — but never persist

**Choice:** A new use case `importRecipeFromPhotos` orchestrates:

1. Call `RecipeDraftExtractor.extract(images)` with the ordered image array — returns `ExtractedDraft`
2. For each `RawIngredient.name`, call the existing `IngredientSearchService.searchByName(name)` and pick the top match (first result; the search service already ranks)
3. If a match is found: produce a `MatchedIngredient` with the matched `unit`, `macrosPerUnit`, and the source — keeping the model-extracted `amount` (or `null` if missing). If the model's extracted unit conflicts with the catalog unit, prefer the catalog unit and flag `unitOverridden: true`
4. If no match: produce an `UnmatchedIngredient` with just the name, the model-extracted amount, and the model-extracted unit
5. Return a `RecipeDraft` DTO containing matched + unmatched rows side by side, plus name/yield/steps

The use case **does not call** `RecipeRepository.save`. Persistence happens only when the user submits the review form, which goes through the existing `POST /add-recipe`.

**Why:** Keeps the AI feature an additive read-only path on top of the existing write path. If the AI extraction or matching is broken, recipes are never silently corrupted — the user sees the broken draft and discards it.

### 4. HTTP: `POST /import-recipe-from-photos`, base64 JSON body with image array

**Choice:** Single endpoint, JSON body:

```jsonc
{
  "images": [
    { "data": "<base64>", "mediaType": "image/jpeg" },
    { "data": "<base64>", "mediaType": "image/png" },
  ],
}
```

Order in the array is the order shown to the model. Response is the `RecipeDraft` DTO (or `400` / `413` / `502` / `503` on errors).

**Why base64 over multipart:** Hono's multipart support is lighter than its JSON support; the rest of the API is JSON-only; per-image sizes here are small (≤ ~5 MB) so the base64 overhead is acceptable even with several images. Keeps the frontend client trivial — same `fetchJson` helper used elsewhere.

**Size limits:**

- `RECIPE_IMPORT_MAX_IMAGE_BYTES` — per-image decoded byte limit, default 5 MB. Reject with `413` and an error pointing at the offending index.
- `RECIPE_IMPORT_MAX_TOTAL_BYTES` — sum across all images, default 20 MB. Reject with `413`.
- `RECIPE_IMPORT_MAX_IMAGES` — maximum image count per request, default 8. Reject with `400` (this is the user's responsibility, not a transport limit). At least 1 image is required; an empty array is `400`.

**Allowed media types:** `image/jpeg`, `image/png`, `image/webp` — Claude vision accepts these. Reject any image whose `mediaType` is something else with `400` and the offending index.

**Auth:** Goes through the existing JWT middleware just like every other route — no special-casing.

### 5. Frontend: dedicated review screen, reuse `RecipeForm`

**Choice:** New feature folder `frontend/src/features/ai-recipe-import/`:

- An "Import from photos" button on the Recipes screen → opens a file picker with `accept="image/jpeg,image/png,image/webp" multiple` (the system chooser on mobile lets the user pick from photo library, files, or take a new photo — important for Instagram screenshots and other gallery-sourced recipes; multi-select supported)
- A staging area shows thumbnails of the picked images with the ability to **add more**, **remove**, and **reorder** before submitting. The order in the staging area is the order sent to the backend
- The frontend enforces `RECIPE_IMPORT_MAX_IMAGES` (matching the backend default; clearly surfaced if the user tries to add more) and the per-image size limit before upload
- On submit → POST the array to `/import-recipe-from-photos`, show a `LoadingSpinner` with copy "Reading your recipe…"
- On success → push the draft into a review screen that renders the existing `RecipeForm` with the draft as `initial`
- The review screen also surfaces a banner listing **unmatched** ingredient names with a one-tap shortcut to the existing ingredient picker, pre-filled with the unmatched name. Resolving them swaps the draft row from "unmatched" to a real `RecipeIngredient`
- The form's existing submit calls the existing `POST /add-recipe` — no new save path

**Why no `capture` attribute:** Setting `capture="environment"` forces camera-only on mobile and hides the photo library — that breaks the Instagram-screenshot use case. Without `capture`, mobile browsers show the standard chooser (Photo Library / Take Photo / Files) and the user can pick whichever source they need. `multiple` lets them select several items at once.

**Why a staging area (not direct submit on pick):** Users can take a photo, realize it's blurry, retake it, and reorder pages — this is critical for multi-photo flows. Direct submit-on-pick would forfeit that.

**Why surface unmatched separately rather than blocking save:** The user may want to save partial — e.g. for a niche herb the catalog doesn't know. The form already accepts user-entered ingredients via the picker; unmatched rows are simply incomplete rows that can't be submitted until the user fills them in.

### 6. Error handling and observability

- Missing/invalid `ANTHROPIC_API_KEY` at startup → log a warning and register the route to return `503` with `{ error: "ai-import-not-configured" }`. Other endpoints work normally. The frontend hides the import button when `/import-recipe-from-photos` returns `503` on its first call.
- Anthropic API errors (rate limit, transient 5xx, timeout) → `502 Bad Gateway` with the model error code in the body
- Unparseable tool result (shouldn't happen with `tool_choice` forced, but guard anyway) → `502`
- Per-image size, total-payload size, image count, and media-type validation errors → `400`/`413` with a body that names the offending image index when applicable, so the frontend can highlight the bad thumbnail
- Each successful call logs `{ model, imageCount, inputTokens, outputTokens, durationMs }` at info level — gives us a paper trail for cost and latency

**Why not retry:** Single-user app, the user can just retry from the UI. Adding retry-with-backoff is premature.

## Risks / Trade-offs

- **AI extraction is wrong** → Always-on review screen. The user sees and edits before save; no silent ingestion.
- **Ingredient match picks the wrong catalog entry** → User can swap any row using the existing ingredient picker on the review screen. We surface the matched ingredient name + source per row so the user can spot mismatches.
- **Unit conflict between model and catalog** → Catalog wins, flagged with `unitOverridden: true` so the form can show a small note. The user can override during review.
- **Cost scales with image count** → Each extra image adds vision input tokens. The per-request `RECIPE_IMPORT_MAX_IMAGES` cap (default 8) is a hard ceiling; usage is logged so we'd notice if a typical import drifts upward. Single-user app makes this acceptable; if usage spikes, add per-day caps in a follow-up.
- **Model context window with many images** → 8 images is comfortably under current Claude vision limits, but we still rely on the API to error out if a future limit is exceeded. The adapter should surface that clearly as `502` rather than retrying with fewer images (which would silently drop pages).
- **API key leak** → Server-only env var, never exposed to the frontend. The frontend never knows the key exists; it only knows whether the endpoint returns `503`.
- **Privacy of uploaded images** → Sent to Anthropic per their API terms. The image is not persisted on our backend; it lives in the request scope only.
- **Schema drift if Anthropic changes vision content-block shape** → Isolated in the adapter. Domain code only sees `ExtractedDraft`.

## Migration Plan

1. Add `ANTHROPIC_API_KEY` to the server environment (and optionally `ANTHROPIC_MODEL`, `RECIPE_IMPORT_MAX_IMAGE_BYTES`, `RECIPE_IMPORT_MAX_TOTAL_BYTES`, `RECIPE_IMPORT_MAX_IMAGES`)
2. Deploy backend — new endpoint is additive; absent env var means it returns `503`, no other behavior changes
3. Deploy frontend — the import button hides itself if the endpoint returns `503`, so it's safe to deploy frontend before the env var is set
4. Set the env var → button starts working

**Rollback:** Remove the route registration in `index.ts` and the import button in the Recipes screen. No data migration; no recipes were created by this code path that aren't valid recipes anyway (the existing `add-recipe` path persisted them).

## Open Questions

- Should the model also extract notes / metadata (cuisine, prep time)? **Defer** — current `Recipe` shape doesn't have them; out of scope.
- Should we localize the system prompt to German given BLS data is German? **Yes** for ingredient names, but the prompt should ask for the original recipe language for `name` and `steps`. Resolve during implementation.
- Image preprocessing (downscale, strip EXIF, re-encode HEIC→JPEG) before sending to Anthropic? **Defer** — start without; add only if size limits prove too tight or model accuracy suffers. iOS HEIC handling specifically may need revisiting once tested on real devices.
- Should the staging UI persist images across navigation (e.g. accidental back-button) via IndexedDB? **Defer** — start with in-memory only.
