## Context

Today the recipe model is single-quantity: `RecipeIngredient = { name, unit, macrosPerUnit, amount }`. The AI importer's tool schema lets the vision model return either a mass unit (`g`, `ml`) or a pseudo-unit (`piece`, `tbsp`, …); whatever it returns gets passed through. When the model emits `1 piece` for "1 onion", the row is technically valid but useless: the `macrosPerUnit` from the catalog is per 100 g, not per piece, so calorie/macro math silently breaks. There is also no representation of the original "1 onion" once the user converts the row to grams — losing the framing the user wants for shopping.

The user's mental model is dual-quantity: many ingredients are shopped by count and tracked by weight, and those two views must be kept in sync. The vision model is already in the loop, has reasonable knowledge of typical produce weights, and has the recipe context (cuisine, portion sizes) needed to pick a good gram weight per piece. Adding a `gramsPerPiece` field to the importer's tool schema is therefore a natural extension that doesn't add a second LLM round-trip.

## Goals / Non-Goals

**Goals:**
- Carry both a piece count *and* a weight on a recipe ingredient, with the weight in canonical mass units (`g` or `ml`) for nutrition math.
- Have AI recipe import populate both for ingredients written as counts ("1 onion", "½ zucchini", "2 cloves garlic", "1 medium tomato").
- Keep the count and the weight in lockstep across yield/servings scaling and manual edits.
- Keep the existing data store backwards-compatible: previously-saved recipes (no piece info) remain valid.
- Preserve existing matched-ingredient behavior: catalog `unit` and `macrosPerUnit` still drive nutrition.

**Non-Goals:**
- Per-recipe density tables, cup→g volume conversions, or generalized unit conversion. We only resolve "count → mass". Volumetric units (`tbsp`, `tsp`, `cup`, `oz`) continue to be handled by the existing matching/override flow.
- A second LLM call for unit resolution after extraction. The same `extract_recipe` tool call carries the new fields.
- A grocery-list feature. The data model is shaped so a future grocery list can render piece counts, but no grocery code lands here.
- Persisting a per-ingredient piece-weight cache or learning typical weights across recipes. Each recipe carries its own `gramsPerPiece` — independent and editable.
- Changing the meal-log snapshot model. `LogEntry` keeps storing an ingredient snapshot; if we want piece info in past logs we'll address it in a later change.

## Decisions

### 1. `RecipeIngredient.unit` stays canonical (`g` | `ml`); piece info lives in a sibling field

**Choice:** When a recipe ingredient is piece-tracked, `unit` is `g` (or `ml` for liquid-by-piece, e.g. "1 lemon's juice ≈ 30 ml"), `amount` is the total mass in that unit, and a new optional field carries the piece framing:

```ts
type PieceQuantity = {
  amount: number;        // e.g. 1, 0.5, 2
  unitLabel: string;     // free-text label as written: "onion", "medium zucchini", "clove"
  gramsPerPiece: number; // canonical mass per one piece
};

type RecipeIngredient = {
  name: string;
  unit: 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece';
  amount: number;
  macrosPerUnit: MacrosPer100;
  pieceQuantity?: PieceQuantity;
};
```

**Why over a discriminated union (`{ kind: 'mass' } | { kind: 'piece' }`):** Macros math today does `amount * macrosPerUnit / 100` and assumes mass. Keeping `amount` always-canonical means the macro pipeline doesn't branch — it stays a single expression. Adding a discriminated union would force every reader (daily log, recipe detail, future plan rollups) to handle two shapes.

**Why over storing `pieceCount` on the ingredient and computing weight on read:** The user wants `gramsPerPiece` to be an editable per-recipe value (the AI's estimate is a starting point — "1 medium onion" might be 150 g for one recipe and 200 g for another). Computing weight at read time would require either a global density table (rejected) or duplicating the editable field on every consumer.

**Why `unitLabel` is free-text, not an enum:** The AI returns whatever the recipe wrote — "onion", "middle-sized zucchini", "Knoblauchzehe", "head of broccoli". An enum would either be incomplete or constantly need new entries. The label is purely for display/shopping; it doesn't drive any computation.

**Liquid-by-piece (`ml`):** Some piece counts naturally land in `ml` (citrus juice, "1 egg ≈ 50 ml" is uncommon but possible). The schema permits `unit: 'ml'` with a `pieceQuantity`. The AI tool documentation will tell the model to use `g` for solids and `ml` only when the recipe explicitly frames the piece as a liquid quantity.

### 2. AI importer extends the existing tool, no second model call

**Choice:** Extend `extract_recipe`'s `ingredients[]` schema with two optional fields:
- `pieceAmount` (number) — count as written, e.g. 1, 0.5, 2
- `pieceUnitLabel` (string) — the noun the recipe uses, e.g. "onion", "medium zucchini", "clove garlic"
- `gramsPerPiece` (number) — the model's gram estimate per one piece

The tool instruction is updated: "When an ingredient is given as a count rather than a mass (e.g. '1 onion', '½ zucchini'), populate `pieceAmount`, `pieceUnitLabel`, and `gramsPerPiece` with your best estimate of a typical piece weight in grams. Always also populate `amount` and `unit` with the resulting total weight (`pieceAmount * gramsPerPiece` in grams). When the recipe is already given by mass, omit the piece fields."

**Why one call:** A second pass would double latency and tokens for no quality gain — the model has the full recipe context (cuisine, portion size hints, neighbouring ingredients) in the first call. Asking for the gram weight inline costs <50 output tokens per piece-counted ingredient.

**Why the model produces the resolved mass, not just the estimate:** Keeps the post-processing in the matching pipeline trivial. The pipeline never has to convert "0.5 pieces × 75 g" itself — it just trusts the model's `amount` and stores `pieceQuantity` alongside.

**Validation guard:** On the parsing side (`parseToolInput`), if the model returns piece fields, we sanity-check that `amount ≈ pieceAmount * gramsPerPiece` within ±5 %. On mismatch we trust the explicit `gramsPerPiece` and recompute `amount = pieceAmount * gramsPerPiece` (catches the model occasionally drifting between fields). If the model returns `gramsPerPiece` without `pieceAmount` we drop the piece info and treat the row as mass-only.

### 3. Matching pipeline carries piece info through the override logic

**Choice:** When the catalog match resolves to a mass unit (which is the universal case for matched ingredients today), `pieceQuantity` from the model is preserved verbatim. When the catalog match has a non-mass unit (rare; e.g. an ingredient catalogued as `piece` with explicit per-piece macros), `pieceQuantity` is omitted — the match becomes the source of truth and we treat the ingredient as count-priced for macros. When the match's unit differs from the model's `unit` AND the model returned piece info, the existing `unitOverridden` flag is still raised (so the user is shown the rewrite); piece info is preserved.

**Why preserve through override:** The user's intent ("1 onion") is independent of catalog macros. Even if we override the unit, the count framing is still useful for the recipe display.

### 4. Yield/serving scaling: scale `amount` and `pieceQuantity.amount` together; `gramsPerPiece` is invariant

**Choice:** Scaling for portions multiplies both `amount` and `pieceQuantity.amount` by the same factor. `gramsPerPiece` is intrinsic to the ingredient and never scales.

**Why:** The piece weight is a property of the produce, not the recipe size. If the recipe is doubled, you need 2 onions instead of 1, but each onion still weighs ~150 g.

**Fractional pieces:** Display rounds to friendly fractions (e.g. 1, 1.5, 2) but the stored `pieceQuantity.amount` is the exact float. The displayed "≈ X g" is computed from the exact float so totals match.

### 5. Editing UX: edit either side, with clear coupling

**Choice:** The recipe ingredient editor renders piece-tracked rows as `[count] [unitLabel] (≈ [amount] [unit])` with both fields editable.
- Editing the count: `gramsPerPiece` stays; `amount` recomputes.
- Editing `gramsPerPiece` (via a small "edit weight per piece" affordance): `amount` recomputes.
- Editing `amount` directly (mass field): the row detaches from piece tracking — `pieceQuantity` is cleared. A confirm hint is shown ("This will remove the piece count").

**Why the asymmetry:** The mass field is the canonical one for macros, so a direct edit there is a deliberate "I want to track this by weight only" choice. Forcing detachment keeps the invariant `amount = pieceAmount * gramsPerPiece` true at all times.

### 6. Persistence and migration

**Choice:** The new field is optional. The JSON store sees a recipe with or without `pieceQuantity` per ingredient. No migration of existing files. New writes from the importer / form populate it where applicable.

**Read-side compatibility:** Backend `parseRecipe` (or equivalent) accepts the field as optional; older saved recipes are read unchanged. Frontend ingredient renderers fall back to the mass-only display when `pieceQuantity` is absent.

## Risks / Trade-offs

- **AI estimates are sometimes wrong** → A "medium tomato" could be 100 g or 200 g depending on origin. Mitigation: the value is editable per recipe; the review-import screen surfaces the estimate visibly so users can correct it before saving.
- **Model returns inconsistent `amount` vs `pieceAmount × gramsPerPiece`** → The validation guard (decision 2) recomputes the canonical mass from the explicit per-piece weight; we don't silently store divergent values.
- **Free-text `unitLabel` makes shopping aggregation harder later** → A future grocery list will need to group "1 onion" + "2 onion" → "3 onions". `unitLabel` is free-text *per recipe*, but ingredient `name` is the catalog match — so aggregation can group by `name` and display the most common `unitLabel` (or fall back to a singular form). This is acceptable because the aggregation layer doesn't exist yet; if we discover edge cases we can normalize labels then.
- **Editing the mass field detaches piece info** → Could surprise users. Mitigation: inline confirm hint plus a one-click "restore piece quantity" while the previous value is still cached in component state during the edit.
- **Some ingredients have no obvious piece weight (e.g. "salt to taste")** → Already covered: importer omits `amount` and piece fields when the recipe doesn't quantify. No regression.

## Migration Plan

1. Land the backend type extension and the importer schema change behind no flag — the field is additive, both old and new responses validate.
2. Land the frontend changes — recipe-detail and recipe-form render piece info when present. Old recipes keep displaying as before.
3. No data migration. Existing recipes don't gain piece info retroactively; users add it on next edit if they want.
4. Smoke test by importing a known piece-counted recipe (Instagram screenshot of a recipe with onions/zucchini) end-to-end.

**Rollback:** Revert the type and schema changes. The persisted JSON file may contain a few `pieceQuantity` fields written by the new code; the old reader will simply pass them through as unknown extra fields (TypeScript is structural; the JSON parser doesn't strip), which is harmless. If strictness is desired, a one-line stripper can remove the field on load.
