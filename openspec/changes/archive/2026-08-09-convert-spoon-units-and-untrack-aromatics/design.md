## Context

The importer's post-match rules live in `buildMatchedRowWithFlags` (`build-matched-row.ts`), shared by AI import and runtime confirm. Today the untracked branch turns raw-display fields into a `displayQuantity` and coerces a missing `amount` to 0; the tracked branch ignores raw-display entirely and a missing `amount` trips the `missingAmount` flag. The reported bug ("2 TL Speisestärke" → tracked 0 g) is exactly the tracked branch dropping a spoon measure it has no way to convert.

## Decisions

### Conversion is deterministic, not model-driven

A spoon is a fixed volume; mapping it to grams is `volume × density`. Both inputs are deterministic, so we encode them in code rather than asking the model to "estimate grams" (which it already declines to do, by design, under the never-guess rule). This keeps the behavior unit-testable and predictable, matching the repo's bias.

- **Spoon→ml table**: a single domain constant keyed by the lowercased, trimmed label.
  - `tl`, `teelöffel`, `teeloeffel`, `tsp`, `teaspoon` → 5
  - `el`, `esslöffel`, `essloeffel`, `tbsp`, `tablespoon` → 15
  - `tasse`, `cup` → 240
  - Anything else (Prise, Schuss, Spritzer, "n. Geschmack") → not convertible; returns `undefined`.
- **Density** lives on the food, not the spoon. `ml`-unit foods need none (a spoon of soy sauce *is* a volume). `g`-unit foods need `density` (g/ml); without it we do not convert.

### `density` is an optional catalog field, seeded narrowly

`FoodEntry.density?: number` mirrors how `pieces?` works: optional, validated when present (positive finite), omitted otherwise. Only the dry staples that are realistically spoon-measured get a value (Speisestärke, Weizenmehl, Dinkelvollkornmehl). The build tool/prompt gain an optional `density` so future regenerations can keep it, but the committed JSON remains the source of truth and is hand-edited here (no API key required, per the documented build-script contract).

### Conversion sits in the matched-row builder, gated to the tracked branch

`buildMatchedRowWithFlags` is the only place that has both the resolved food (hence its `unit` and `density`) and the raw-display fields. The tracked branch, when `row.amount` is still null and raw-display fields are present, calls `convertSpoonToAmount(...)`; a defined result populates `amount` (so `missingAmount` then computes false), an undefined result leaves the row exactly as today. The untracked branch is unchanged — aromatics still render their original measure via `displayQuantity` and contribute nothing.

Why not also set `displayQuantity` on the converted tracked row (to keep "2 TL" visible)? Because the `recipes` capability restricts `displayQuantity` to untracked rows, and the frontend derives weight/piece/free mode from the row shape — a tracked row showing `6 g Speisestärke` is correct and spec-consistent. The original measure stays available in the import debug `raw`.

### Aromatics: catalog decision, not amount heuristic

`ingwer` and `knoblauch` become untracked seed keys. This is a per-food call (they are nutritionally trivial at any culinary amount), not "anything in a spoon is untracked" — which would wrongly zero out 2 EL olive oil. Macro-bearing staples stay tracked and rely on conversion instead.

## Risks / Trade-offs

- **Density is approximate.** Bulk densities vary with packing; we accept ±15-20%. For ~6 g of starch the absolute error is a couple of kcal — well within tracking tolerance, and far better than 0 g.
- **Untracking knoblauch loses its working piece-path weight** (it currently resolves cloves → grams). Accepted: ~15 kcal for 2 cloves is noise, and the user chose this trade-off.
- **`tbsp`/`tsp` enum-unit path stays unconverted** to avoid regressing the existing override scenario. Documented as a non-goal; revisit only if the model starts routing spoons through `unit` instead of raw-display.
