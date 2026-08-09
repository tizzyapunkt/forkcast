## Why

Recipes routinely state pantry staples in spoon measures — "2 TL Speisestärke", "2 EL Sojasauce", "2 TL Ingwer". The extractor correctly captures these via the raw-display fields (`rawDisplayAmount`/`rawDisplayUnitLabel`), but on a **tracked** catalog match the importer currently *drops* those fields without converting them, leaving the row with no usable weight. The result is a tracked ingredient that silently persists as **0 g** — wrong macros (Speisestärke is near-pure carbohydrate) and confusing in the review UI.

Two distinct problems hide behind the same symptom:

1. **No spoon→mass conversion.** A teaspoon/tablespoon is a *volume*; converting it to grams needs the food's density. We have neither a spoon-volume table nor per-food density, so the importer can only give up.
2. **Aromatics tracked at pointless precision.** Ingwer and Knoblauch contribute negligible macros in any culinary amount and are almost always stated in spoons or cloves. Tracking them adds noise for no nutritional signal.

## What Changes

- **Spoon-volume conversion (deterministic).** Add a small, deterministic spoon/volume label → millilitre table (TL/Teelöffel/tsp = 5 ml, EL/Esslöffel/tbsp = 15 ml, Tasse/cup = 240 ml). When a **tracked** match has raw-display fields and no stated `amount`, the importer converts:
  - `ml`-unit food → `amount = rawDisplayAmount × mlPerSpoon` (volume is the unit; no density needed).
  - `g`-unit food → `amount = rawDisplayAmount × mlPerSpoon × density`, only when the food carries a `density`. Without density the row is left unconverted (still surfaced via `missingAmount`), never guessed.
- **Per-food `density` (g/ml)** added as an OPTIONAL field on curated `FoodEntry`, carried through `IngredientSearchResult` and `MatchSourceFood`. Seeded for the spoon-measured dry staples in the catalog (Speisestärke, the flours).
- **Untrack aromatics.** Mark `ingwer` and `knoblauch` as untracked in the seed-key list and regenerate their `foods.json` entries (zero macros, `untracked: true`). They then flow through the existing untracked path: `amount` 0, original spoon/clove measure preserved as a `displayQuantity`, no macro contribution.

## Non-goals

- No conversion for the canonical `tbsp`/`tsp`/`cup`/`oz` enum units on the `unit` field — that path keeps its existing "catalog unit wins, `unitOverridden`" behavior (see the ai-recipe-import "Unit override flagged" scenario). This change touches only the raw-display path.
- No density seeding for foods that are not realistically spoon-measured.
- No blanket "small unit ⇒ untracked" heuristic — untracked stays a curated, per-food catalog decision so macro-bearing staples (Stärke, Mehl, Öl, Sirup) are never silently zeroed.

## Capabilities

### Modified Capabilities

- `curated-foods-source`: `FoodEntry` gains an OPTIONAL `density` (g/ml); validation accepts it; the seasoning/aromatic set grows to include `ingwer` and `knoblauch` as untracked.
- `ai-recipe-import`: a tracked match with raw-display fields converts spoon measures to a catalog-unit `amount` instead of dropping them.

## Impact

**Code**

- `backend/src/domain/foods/types.ts` — `FoodEntry` adds `density?: number`.
- `backend/src/domain/foods/validate-food-entry.ts` — `density`, when present, must be a positive finite number.
- `backend/src/domain/ingredient-search/types.ts` + `map-food-entry.ts` — `IngredientSearchResult` carries `density`.
- `backend/src/domain/ai-recipe-import/convert-spoon-amount.ts` (new) — the spoon→ml table and the conversion function.
- `backend/src/domain/ai-recipe-import/build-matched-row.ts` — `MatchSourceFood` gains `density`; the tracked branch converts raw-display spoon measures.
- `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.ts` and `food-resolution/confirm-resolution.use-case.ts` — plumb `density` into `MatchSourceFood`.
- `backend/scripts/foods-seed-keys.ts` — `ingwer` and `knoblauch` become `{ key, untracked: true }`.
- `backend/src/infrastructure/food-resolution/{build-foods-tool,resolution-tool}.ts` — optional `density` in the entry schema + a prompt note (so future regenerations can populate it).
- `backend/data/foods.json` — `density` seeded on the dry staples; `ingwer`/`knoblauch` regenerated as untracked with zero macros.

**Data**: additive `density` field; `ingwer`/`knoblauch` entries change to untracked. Existing recipes/overlays load unchanged.

**No impact on**: `LogEntry` shape, daily-log math, the manual recipe editor's measurement modes, the canonical-unit override path.
