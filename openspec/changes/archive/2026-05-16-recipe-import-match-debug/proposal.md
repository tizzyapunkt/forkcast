## Why

The "Add Recipe from Photo" flow occasionally matches an extracted ingredient to the wrong catalog entry (e.g., wrong unit, wrong food, or an unexpected fallback). Today the review screen only shows the *post-match* result, so there's no way to tell whether the model extracted the wrong name, the search returned a bad top hit, or the unit-override rule fired. A built-in debug view will make these mismatches diagnosable without re-running imports manually.

## What Changes

- Extend the import-recipe-from-photos response with an optional, gated `debug` payload that, for every extracted ingredient, includes:
  - the raw ingredient as returned by the LLM (name, amount, unit, piece quantity, raw display fields)
  - the top N search candidates returned by `IngredientSearchService.searchByName` (name, source, unit, score if available)
  - the chosen match (or `null` if unmatched) and the post-match flags that fired (`unitOverridden`, `untracked`, piece-quantity dropped/preserved)
- Add a backend toggle for the debug payload via `RECIPE_IMPORT_DEBUG` env var (default off). When off, the field is omitted; when on, the field is present on every successful response.
- Add a collapsible "Debug" box on the import flow's review screen. When the response includes a `debug` field, render a per-ingredient table: raw → candidates → chosen, with the flags inline. The box is hidden when the field is absent.
- No persistence; the debug payload is request-scoped, never stored, and not exposed in any other endpoint.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `ai-recipe-import`: add an opt-in debug payload to the import response that surfaces raw extraction, top search candidates, and the chosen match for each ingredient row, plus a frontend debug box that renders it when present.

## Impact

- Backend
  - `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.ts` — collect raw + candidates + chosen during matching and return them when debug mode is on.
  - `backend/src/domain/ai-recipe-import/types.ts` — add `RecipeDraftDebug` and related types; thread an `includeDebug` flag through the use case.
  - `backend/src/http/ai-recipe-import/import-recipe-from-photos.handler.ts` — read `RECIPE_IMPORT_DEBUG` (or equivalent flag) and pass `includeDebug` to the use case.
  - `backend/src/index.ts` — wire the env flag into handler deps.
- Frontend
  - `frontend/src/domain/recipes/` (or wherever `RecipeDraft` lives on the FE) — extend the draft type with the optional `debug` field.
  - `frontend/src/features/ai-recipe-import/review-import-screen.tsx` — render the new debug box when the field is present.
  - `frontend/src/api/import-recipe-from-photos.ts` — pass through the new field.
- No new external dependencies. No DB changes. No new endpoint.
- Risk: increasing the response payload size when debug is on; mitigated by it being opt-in and request-scoped.
