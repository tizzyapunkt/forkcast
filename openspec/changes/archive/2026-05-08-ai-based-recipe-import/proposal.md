## Why

Adding a recipe by hand — typing the name, every ingredient with its amount and unit, and each cooking step — is the slowest path in the app. Most real recipes start as photos: a cookbook page, a multi-screenshot Instagram carousel, a friend's recipe card front-and-back. AI vision models can now extract that structure reliably enough — across multiple images of the same recipe — that the user should only have to take a few pictures, glance at the result, and save.

## What Changes

- A new "Import from photos" entry on the Recipes screen lets the user pick or capture **one or more images of a single recipe** (e.g. a 3-page Instagram screenshot set, or front + back of a recipe card) and produces a single draft recipe ready for review
- The backend exposes a new command that accepts **an ordered list of images** and returns a parsed recipe draft — name, yield, ingredients (name + amount + unit), and ordered steps — using Claude's vision capability with all images attached to the same call so context spans the full recipe
- Each extracted ingredient is matched against the existing ingredient catalog (BLS + recently-used) so saved recipes share nutrition data with manually-entered ones; unmatched ingredients are flagged on the draft as "needs review"
- An always-shown review screen presents the draft as an editable recipe form; the user confirms, edits, or discards before anything is persisted — no recipe is saved without explicit confirmation
- A new dependency (`@anthropic-ai/sdk`) and two env vars (`ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`) are required on the backend; without them the import endpoint returns a clear configuration error and the frontend hides the entry point

## Capabilities

### New Capabilities

- `ai-recipe-import`: Extracts a draft recipe from a user-supplied photo using a vision LLM, matches each parsed ingredient against the existing ingredient catalog, and returns an editable draft. The draft is held only in memory/transit — persistence happens only via the existing `add-recipe` command after user review.

### Modified Capabilities

<!-- none — the existing `recipes` capability is reused unchanged for persistence -->

## Impact

- **Backend**:
  - New `POST /import-recipe-from-photos` endpoint (base64 JSON body containing an ordered array of images), returns a draft recipe DTO; rejects requests where any image exceeds the per-image size limit, where the total request exceeds the combined limit, or where the image count exceeds the per-request maximum
  - New domain port `RecipeDraftExtractor` (returns name + yield + raw ingredient lines + steps from one or more ordered images of the same recipe) with an Anthropic adapter under `infrastructure/ai-recipe-import/`
  - New domain use case `import-recipe-from-photos` that orchestrates extraction → ingredient matching (reusing existing `IngredientSearchService`) → draft assembly
  - Reuses the existing `RecipeRepository` and `add-recipe` use case for the actual save — no schema change to recipes
- **Frontend**:
  - New feature folder `features/ai-recipe-import/` with an "Import from photos" action on the Recipes screen, a multi-image upload/camera control (supporting reordering and removal before submit), a loading state, and a draft-review form (reusing the existing `recipe-form.tsx`)
  - New API client function `api/import-recipe-from-photos.ts`
  - On the review screen, ingredient rows flagged "unmatched" link into the existing ingredient picker so the user can resolve them before saving
- **Config**: `ANTHROPIC_API_KEY` (required for the feature), `ANTHROPIC_MODEL` (optional, defaults to a current Claude vision model); `RECIPE_IMPORT_MAX_IMAGE_BYTES` (per-image, default ~5 MB), `RECIPE_IMPORT_MAX_TOTAL_BYTES` (combined, default ~20 MB), `RECIPE_IMPORT_MAX_IMAGES` (default 8)
- **Dependencies**: `@anthropic-ai/sdk` added to `@forkcast/backend`
- **Cost**: Each import is one Claude vision call carrying all submitted images; cost scales with image count, but is acceptable for personal use. The feature MUST log model, image count, and token usage for observability
