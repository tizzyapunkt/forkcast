## Why

Spoon measures (`EL`, `TL`, `Tasse`) are the most common source of wrong amounts in AI recipe import. The model usually reads "2 EL" correctly. What breaks is the path from the tool schema to the draft row: most ways the model can report a spoon either get mangled or end in "Menge fehlt".

Confirmed by running `buildMatchedRowWithFlags` on typical extractor output:

| Model returns | Draft row today |
|---|---|
| `2 EL Olivenöl` on the raw-display fields | `30 ml` ✓ |
| `2 EL Olivenöl` as `amount: 2, unit: "tbsp"` | `2 ml`, flagged `unitOverridden` |
| `2 EL Haferflocken` on the raw-display fields | no amount, `missingAmount` |
| `2 EL Haferflocken` as `amount: 2, unit: "tbsp"` | `2 g`, flagged `unitOverridden` |
| `½ TL Zimt` with a model-made `2.5 ml` | `2.5 g`, the model's own conversion wins |

The causes are in the code, not in the model:

- **The schema invites the wrong shape.** The extraction enum offers `tbsp`/`tsp`/`cup`/`oz`, while the prompt says spoon measures belong on the raw-display fields. The prompt also says to "still attempt a canonical conversion".
- **Any canonical amount beats the deterministic conversion.** A value on `amount`/`unit` keeps its number while the catalog unit replaces the unit ("catalog unit wins"), and the spoon conversion is skipped.
- **The archived `convert-spoon-units-and-untrack-aromatics` change left the `tbsp`/`tsp` enum path unconverted on purpose.** It planned to revisit that "if the model starts routing spoons through `unit`". It does.
- **The correct path rarely ends in an amount.** Only 3 of 172 gram-unit catalog foods carry a `density`, so a spoon of almost any gram food ends as `missingAmount`.
- **Unmatched rows drop the spoon fields entirely.** When the user resolves an unmatched `2 EL Erdnussmus` by hand, the confirmed row has no amount.

A bigger model would make the wrong shapes rarer but would not fix the pipeline. That is why this comes before any Haiku → Sonnet decision.

## What Changes

- **The model reads, the code converts.** The extraction schema offers only `g` and `ml` as canonical units. Every spoon or cup measure is reported on the raw-display fields as the literal count and label (`2`, `"EL"`). The "attempt a canonical conversion" instruction is removed. The model fills `amount`/`unit` only when the recipe prints a weight or volume.
- **New `gramsPerSpoon` extraction field.** It is the model's estimate of one spoon of that specific food (e.g. 1 EL Haferflocken ≈ 8 g), and it mirrors `gramsPerPiece`.
- **The parser normalizes spoons it receives in the wrong fields**, whatever model produced them:
  - `tbsp`/`tsp`/`cup` on `unit` move to the raw-display fields as `EL`/`TL`/`Tasse`
  - a spoon label on the piece fields becomes a spoon measure, with `gramsPerPiece` as the per-spoon estimate
  - an `ml` amount alongside a spoon measure is dropped as redundant
  - `oz` becomes grams (× 28.35)
- **Spoon conversion has a defined order on tracked matches.** An `ml` food gets the fixed spoon volume. A `g` food with a `density` gets volume × density. A `g` food without density gets count × `gramsPerSpoon`. Only when none of these apply does the row stay `missingAmount`.
- **Estimated spoon amounts are visible.** A row converted from `gramsPerSpoon` gets a `spoonEstimated` provenance flag and a German review marker, like the piece-weight estimate.
- **The verbatim read stays untouched.** Normalization works on the structured fields only. It never reads or rewrites `sourceText`, so the review screen's "gelesen" line keeps showing the printed "2 EL Olivenöl" next to the converted amount. Every conversion stays checkable against what was actually read. `provenance.raw` is redefined honestly as the *parsed* record, with `sourceText` as its one verbatim field.
- **Unmatched rows keep their spoon measure**: `rawDisplayAmount`, `rawDisplayUnitLabel` and `gramsPerSpoon` are carried on the row. The resolve sheet sends them with the confirm, so a hand-resolved row converts the same way an auto-matched one does.

No catalog migration and no change to the persisted recipe shape. Saved recipes are not rewritten.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-recipe-import`:
  - extraction canonical units reduced to `g`/`ml`, with spoon measures always on the raw-display fields
  - new `gramsPerSpoon` estimate
  - parser normalization of misplaced spoon and ounce values
  - conversion order, with the model estimate used only after the deterministic paths (fixed volume, density)
  - unmatched rows carry the spoon measure
  - `spoonEstimated` in the provenance flags and in the review markers, with `raw` described as the parsed record whose `sourceText` stays verbatim
  - the provenance unit-override example moved off `tbsp`, which no longer reaches matching
  - the "never guessed" carve-out extended to the per-spoon estimate
- `unmatched-ingredient-resolution`: the confirm endpoint accepts `gramsPerSpoon` in the original fields and applies the spoon conversion, and the review screen submits the unmatched row's spoon measure.

## Impact

- **Backend**
  - `infrastructure/ai-recipe-import/extract-recipe-tool.ts`: enum, `gramsPerSpoon` field, prompt, normalization in `parseToolInput`
  - `domain/ai-recipe-import/convert-spoon-amount.ts`: estimate fallback, and a German canonical label for normalized units
  - `domain/ai-recipe-import/build-matched-row.ts`: passes the estimate and raises `spoonEstimated`
  - `domain/ai-recipe-import/import-recipe-from-photos.use-case.ts`: unmatched rows carry spoon fields
  - `domain/ai-recipe-import/types.ts`
  - `http/food-resolution/resolution.handlers.ts`: parses `gramsPerSpoon`
- **Frontend**
  - `domain/recipes.ts` and `domain/food-resolution.ts`: types
  - `features/ai-recipe-import/review-import-screen.tsx`: the resolve item gets the spoon fields
  - `features/ai-recipe-import/resolve-pane.tsx`: forwards `gramsPerSpoon`
  - `features/recipes/ingredient-provenance.ts` and `i18n/de.ts`: marker
- **API**: additive and optional fields only. Old clients (a cached PWA) keep working and just miss the estimate on hand-resolved rows.
- **Data**: none required. See design → Migration Plan for the optional audit of recipes imported before this fix.
- **Builds on `verbatim-ingredient-read`** (shipped in #51). Its Transcription rule and `sourceText` field stay as they are. This change edits only the quantification rules and worked examples next to them in `extract-recipe-tool.ts`.
