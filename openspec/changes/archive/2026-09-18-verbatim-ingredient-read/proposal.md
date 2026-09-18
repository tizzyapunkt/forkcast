## Why

The review screen's raw line (`gelesen: „…"`) is meant to show what the photo said so a wrong match is visible in place, but it shows the model's *interpreted* ingredient instead. For a counted food the raw record already holds the gram estimate: `1 mittelgroße Zwiebel, gewürfelt` shows as `gelesen: „150 g Zwiebel"`. The count, the size word and the prep modifier are gone, and the invented 150 g looks like it was printed. That is the reverse of what the line is for. The user can't tell a read error from an estimate, and so can't judge an ambiguous match themselves.

Confirmed in code:

- There is no separate OCR step. The vision model returns structured fields only, so no verbatim text is ever captured.
- For piece-counted ingredients the tool schema requires `amount`/`unit` to hold the resolved total (`pieceAmount × gramsPerPiece`, `g`). `parseToolInput` then overwrites `amount` with that product. `provenance.raw` is this post-parse record.
- `formatRawIngredient` prefers `amount + unit` over everything else, so it renders the gram estimate. It ignores `pieceQuantity`, which is on the same raw record.
- Spoon measures behave the same way. The prompt asks the model to "still attempt a canonical conversion", so `2 EL Olivenöl` can come back as `30 ml` or `2 tbsp`, and the raw line shows that instead of `2 EL`.
- The name is also normalized: food noun only, prep moved to `note`, `2 Knoblauchzehen` becomes `Knoblauch` + `Zehe`. Even the name part of the raw line isn't what was printed.
- Unmatched rows (the panel and the resolve sheet header) show `name amount unit` from the same post-parse record, so they show `Zwiebel 150 g` too.

## What Changes

- **The extractor transcribes each ingredient line verbatim.** The `extract_recipe` tool gets an optional `sourceText` field: the ingredient line exactly as printed, with the original amount, fraction glyphs, unit words, size adjectives and prep modifiers. Nothing is normalized, translated or converted. The parser trims it and drops it if it's empty or overlong. It never fails the import.
- **`sourceText` travels on the raw record** into `provenance.ingredients[i].raw`. Like all provenance, it's never persisted and never logged.
- **The raw line shows `sourceText`** when it's present. When the model omits it, the fallback reconstruction uses the recipe's own framing before any estimate: count (`1 Zwiebel`), then the literal display quantity (`2 EL`), then the canonical amount. A resolved gram/ml total from a piece estimate is never shown as "read".
- **Unmatched rows show the raw line too.** Both the unmatched panel and the resolve sheet's item header show it, because resolving an unmatched row is where the user matches by hand most often.

No change to matching, amount resolution, piece estimates or saved recipes. Only what the "read" display shows changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-recipe-import`:
  - the extractor captures a verbatim `sourceText` per ingredient (new requirement)
  - the provenance `raw` entry carries it
  - the review screen's raw line shows the verbatim text, never the resolved estimate, and appears on unmatched rows and in the resolve sheet header too

## Impact

- **Backend**:
  - `infrastructure/ai-recipe-import/extract-recipe-tool.ts`: schema field, prompt rule, parse/trim/cap
  - `domain/ai-recipe-import/types.ts`: `RawIngredient.sourceText?`
  - The use case already passes `raw` through to provenance unchanged, so no logic change is expected there.
  - No new endpoint. The response shape is extended additively.
- **Frontend**:
  - `domain/recipes.ts`: `RawIngredientProvenance.sourceText?`
  - `features/recipes/ingredient-provenance.ts`: formatter prefers `sourceText`, reordered fallback
  - `features/ai-recipe-import/review-import-screen.tsx`: raw line on unmatched rows, `sourceText` passed to the resolve item
  - `features/ai-recipe-import/resolve-pane.tsx`: raw line in the item header
- **Cost**: a few extra output tokens per ingredient on each import call.
- **No breaking changes**: `sourceText` is optional everywhere, and drafts without it render through the fallback.
