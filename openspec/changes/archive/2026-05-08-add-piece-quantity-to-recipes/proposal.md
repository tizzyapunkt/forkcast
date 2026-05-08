## Why

Recipes are commonly written in two languages at once: tracking-friendly weights (`200 g flour`) and shopping-friendly counts (`1 onion`, `½ medium zucchini`). Today the importer only carries the literal extracted amount, so a piece-counted ingredient lands as `unit: piece` with no usable weight — it can't be tracked against macros, and once converted to grams the original "1 onion" is lost, making grocery lists harder to read. The user needs both representations stored side-by-side: a weight in grams/ml for nutrition math and a piece count for shopping, with both scaling correctly when the recipe yield changes.

## What Changes

- **BREAKING** Each `RecipeIngredient` gains an optional `pieceQuantity` field — `{ amount: number; unitLabel: string; gramsPerPiece: number }` — that records the original "1 onion / 2 carrots" framing alongside the canonical weight in `amount` (always in `g` or `ml`).
- AI recipe import detects ingredients written as counts or non-mass units (e.g. `1 onion`, `½ zucchini`, `2 cloves garlic`) and asks the vision model — in the same tool call that already extracts the recipe — to estimate a typical gram weight per piece for each. The draft row carries both the count and the resolved weight.
- Recipe form, recipe detail, and the AI-import review screen render both quantities for piece-tracked ingredients (e.g. `1 onion (≈ 150 g)`), and let the user edit either side. Editing the count keeps `gramsPerPiece` and recomputes the weight; editing the weight detaches the piece quantity (or the user can clear it).
- Yield/serving scaling multiplies the count and the weight together so both stay in lockstep.
- The shape is chosen so a future grocery-list capability can read `pieceQuantity` directly and produce shopping output like "3 onions" instead of "450 g onions"; no grocery-list code is introduced in this change.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `recipes`: The `Recipe` entity's ingredient shape gains an optional piece-quantity field; validation, scaling, and persistence rules extend to cover it.
- `ai-recipe-import`: The extractor tool schema and the matching pipeline are extended to capture piece counts and AI-estimated gram weights for piece-counted ingredients, returning both in the draft.

## Impact

- **Backend domain**: `RecipeIngredient` shape change in `backend/src/domain/recipes/types.ts`; matching pipeline in `backend/src/domain/ai-recipe-import/` extended to carry piece info; tool schema in `backend/src/infrastructure/ai-recipe-import/extract-recipe-tool.ts` updated.
- **Backend HTTP**: `add-recipe` and `update-recipe` request/response schemas accept the new field; `import-recipe-from-photos` response carries piece data.
- **Frontend**: `frontend/src/domain/recipes.ts`, `recipe-ingredient-editor.tsx`, `recipe-form.tsx`, `recipe-detail.tsx`, and `review-import-screen.tsx` render and edit the dual representation.
- **Persistence**: Existing recipes in the JSON store remain valid (new field is optional). No migration needed.
- **Dependencies**: None new — the extractor already calls Anthropic; only the tool input schema changes.
