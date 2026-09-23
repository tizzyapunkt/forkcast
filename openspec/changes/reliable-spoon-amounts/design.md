## Context

See proposal.md, "Why", for the failure table and its causes. The constraints that shape the approach:

- **One reader, then three stages.** The vision model fills `extract_recipe`. Then:
  - `parseToolInput` (infrastructure) turns the tool input into a `RawIngredient`.
  - The use case matches it against the catalog.
  - `buildMatchedRowWithFlags` (domain) applies the post-match rules.

  The confirm endpoint reuses `buildMatchedRowWithFlags`, so the import path and the resolve path share one set of row rules.
- **The spoon table already exists.** `convert-spoon-amount.ts` holds it (`spoonVolumeMl`: TL/EL/Tasse and their spellings). It is the only place that knows what a spoon is.
- **The live catalog lives in the `forkcast_data` Docker volume.** `catalog.seed.json` is installed only when `catalog.json` is absent, so seed edits never reach a running deployment. The catalog editor carries `density` through a save but has no input for it.
- **Density data is thin.** 3 of 172 `g`-unit catalog foods carry `density` (the three flours). The 14 `ml` foods (oils, milks, sauces) don't need it.
- **Some raw information is never persisted.** Tracked recipe rows don't store the spoon measure (the raw-display fields are consumed on import). Meal-log entries snapshot the ingredient's amount and macros when they are logged.
- **Unmatched rows lose the spoon measure today.** The use case builds unmatched rows without the raw-display fields. The review screen's `openItem` doesn't set them either, even though `ResolveItem` and the confirm handler already accept them.
- **The verbatim read has shipped (#51).** The model writes each ingredient line into `sourceText` exactly as printed. The parser only trims it, and it rides on `provenance.raw` only: never on a draft row, never logged, and by its own requirement it must not influence matching, amounts or flags.
  - The review screen's "gelesen" line prefers `sourceText`. Without it, the line falls back to the piece count, then the raw-display quantity, then a stated mass.
  - `provenance.raw` is already the *post-parse* record: piece arithmetic is recomputed before it is built. `sourceText` is the only field that is guaranteed untransformed.

## Goals / Non-Goals

**Goals:**

- Every spoon measure the model reports, in whatever field, reaches one conversion with a defined order.
- A deterministic result wherever the data allows it (fixed volume, catalog density). A visible estimate otherwise, never a silent wrong number.
- No data migration, and no change to the persisted recipe or catalog shape.

**Non-Goals:**

- **Switching the model.** The `rezepte/` benchmark decides that afterwards, against the fixed pipeline, scored on grams per ingredient.
- **Backfilling densities or adding a density input to the catalog editor.** Density keeps winning where it exists, so either can land later without touching this change.
- **The local manual pick in the resolve sheet.** `resolveLocally` runs when synonym teaching is declined or its write fails. It builds the row client-side and keeps no amount for a spoon row, as today. Moving it server-side is its own change.
- **Estimates for non-spoon measures** (`Prise`, `Schuss`). They are nutritionally trivial and almost always untracked foods (salt, pepper).
- **Ranges** ("1–2 EL") and an `oz` written as a raw-display label. German recipes rarely use either. Both stay `missingAmount` and visible.
- **Rewriting saved recipes or past log entries.** See Migration Plan.

## Decisions

### 1. Normalize at the adapter boundary: the model reads, the code converts

`parseToolInput` is where model output becomes domain data, so the spoon normalization (spec: "Parser moves spoon and ounce values off the canonical unit") lives there. The domain then only ever sees spoon measures on the raw-display fields.

- **Why here:** it protects the import against every shape any model returns, including Haiku today and anything the prompt fails to prevent. The domain rules stay simple, and the confirm path gets normalized input for free, because its original fields come from the parsed draft.
- **Alternative: prompt-only fix.** Still probabilistic, and it is exactly what the current prompt already tries.
- **Alternative: teach `buildMatchedRowWithFlags` to recognize `unit: "tbsp"`.** That spreads knowledge of model output shapes into the domain, and it collides with the catalog-unit-wins rule that other scenarios rely on.

The parser recognizes spoon labels through the existing `spoonVolumeMl`. The table stays the single source of what counts as a spoon, and an infrastructure → domain dependency is the allowed direction.

The tool schema's `unit` enum and the parser's accepted units are separate lists:

- **Schema enum (offered to the model):** `g`/`ml`.
- **Parser (tolerated input):** additionally `tbsp`/`tsp`/`cup`/`oz`, which it normalizes. Removing them from the parser would silently drop a value the model sent anyway.

### 2. A per-spoon estimate, with density taking precedence

This reverses the archived change's decision "conversion is deterministic, not model-driven". That decision assumed densities would cover the foods people measure by spoon. At 3/172 they don't, and the deterministic-only path ends in `missingAmount` for nearly every gram food. Meanwhile the piece path already trusts a model weight estimate (`gramsPerPiece`), and the spec accepts it as an intentional estimate.

- **`gramsPerSpoon` mirrors `gramsPerPiece`.** It is optional, only valid next to a spoon label, and the parser discards it otherwise.
- **The conversion order puts every deterministic source first:** fixed volume for `ml`, then density, then the estimate. A density added later automatically beats the estimate for that food.
- **Estimates are marked** (Decision 6), in the same spirit as the piece-weight display.

Alternatives considered:

- **Backfill densities for ~170 foods.** It's deterministic, but it means curating the live volume by hand with no editor field, and bulk density is itself approximate (±15–20%, per the archived design). Worth doing later for staples; it doesn't block this change.
- **A generic default per spoon** (e.g. 1 EL ≈ 10 g). Too coarse: 1 EL Honig ≈ 21 g and 1 EL Zimt ≈ 7 g.
- **Rely on the catalog drafter's `density` for new foods.** It already proposes one (seen in the smoke test: Flohsamenschalen `0.6`), and density then wins over the estimate. But it only covers foods created from now on, not the ~170 existing gram foods.

### 3. German labels for spoons normalized from the enum

`tbsp` → `EL`, `tsp` → `TL`, `cup` → `Tasse`. The label is visible on untracked rows through `displayQuantity` ("2 EL Salz"), and the catalog locale is German, matching `DEFAULT_UNTRACKED_DISPLAY_LABEL`.

A label the model actually wrote, on the raw-display or piece fields, always beats a label derived from an enum value. That is why the piece rule runs before the unit rule.

### 4. `ml` next to a spoon is dropped, `g` next to a spoon is kept

- **`ml` is dropped** because it adds no information the spoon doesn't already carry. The observed failure (`½ TL Zimt` → `2.5 ml` → stored as `2.5 g`) comes from exactly this value colliding with a `g` catalog unit.
- **`g` is kept** because recipes do print "2 EL (12 g)", and the existing "Stated canonical amount wins" scenario depends on it.

The remaining gap is a model that converts to grams on its own. That can't be told apart from a printed weight (see Risks).

### 5. Unmatched rows carry the spoon measure on the draft row

`rawDisplayAmount`, `rawDisplayUnitLabel` and `gramsPerSpoon` ride on `UnmatchedDraftIngredient`, the same way `pieceQuantity` already does. The review screen copies them into the `ResolveItem`, and `originalFields` forwards them.

- **Why on the row:** the draft row is the contract the resolve flow is built on. Provenance is display-only, and `verbatim-ingredient-read` keeps it that way on purpose.
- **Alternative:** have the frontend read `provenance.raw` for unmatched rows. That couples resolution to a debug structure the client may not always receive in future.

### 6. The flag and marker extend the existing requirements

`spoonEstimated` joins the provenance flags. Its marker renders the source measure from `provenance.raw` with the existing `formatPieceCount`, e.g. `Menge aus 2 EL geschätzt` or `Menge aus 0.5 TL geschätzt`. The frontend treats a missing flag as `false`.

The deltas modify "Match provenance…", "Rows with uncertain matches are marked", "Confirm endpoint…" and "Review screen prefetches proposals…" directly, instead of adding side requirements. Both overlapping changes are archived, and an added requirement would leave the flag list and the confirm field list in those requirements out of date. One existing provenance scenario had to change anyway: its `tomato paste, 2 tbsp → unitOverridden` example stops being true once `tbsp` is normalized, so it now uses `Joghurt 150 ml → g`.

### 7. Prompt changes stay minimal

- Narrow the enum and describe `gramsPerSpoon` in the schema.
- Delete the "Still attempt to populate amount and unit with a sensible canonical conversion" sentence.
- Update the raw-display worked examples:
  - `2 EL Olivenöl` → `rawDisplayAmount 2, "EL", gramsPerSpoon ≈ 13`
  - `½ TL Zimt` → `0.5, "TL", gramsPerSpoon ≈ 2.5`
  - `2 EL (12 g) Speisestärke` → `amount 12, "g"` plus raw-display

No new MUST/NEVER blocks. The parser, not the prompt, is the guarantee, and newer models take capitalized rules more literally than intended. The Transcription rule block and the `sourceText` examples from #51 stay untouched. The new raw-display examples use the same lines (`2 EL Olivenöl`, `½ TL …`), so the two rule sets visibly describe one reading: the verbatim line in `sourceText`, and its structured interpretation in the other fields.

### 8. `sourceText` stays a debug record, not an input

The normalization never reads `sourceText` and never writes it. The spoon change deliberately does not use the verbatim line to decide amounts:

- **Its own requirement forbids it.** `sourceText` must not influence amount resolution or flags. Using it would reopen a decision made one change ago.
- **It keeps the debug read trustworthy.** It stays the one thing on screen that no code path shapes. When a converted amount looks wrong, the line next to it shows what the model actually read, and the fault can be placed: a misread ("2 TL" read as "2 EL") shows in `sourceText`, a misroute or bad estimate shows in the structured fields.
- **Rejected alternatives:**
  - Parsing count and unit from `sourceText` with code: free-text German lines ("1 gehäufter EL", "2–3 EL", "2 EL (30 g)") make this more fragile than the model's structured fields.
  - Keeping a printed gram amount next to a spoon only if `sourceText` contains a gram figure: that is exactly the amount influence the verbatim requirement rules out.

The consequence for provenance: `raw` is described in the spec as the *parsed* record, which it already was for piece rows, with `sourceText` as its one verbatim field. Without `sourceText` (the model may omit it), the raw line's fallback now renders a normalized `tbsp` as `2 EL`, the recipe's own framing, instead of the model's `2 tbsp`.

## Risks / Trade-offs

- **[Estimates are approximate, roughly ±30% on powders]** → Density takes precedence where present. The row is marked, and the user edits the gram amount in review. Still far better than `2 g` or no amount.
- **[A model that self-converts to grams looks like a printed weight]** → The prompt forbids it. No marker appears in that case, but the "gelesen" line shows the printed `2 EL …` right next to the gram amount, so the mismatch is visible in review. Automating the check would mean letting `sourceText` influence amounts (see Decision 8).
- **[Debug signal lost by normalization]** Once a misrouted `tbsp` is normalized, `raw` no longer shows that the model put it on `unit`. → Acceptable for review, because `sourceText` shows the printed line. For prompt tuning or the Haiku/Sonnet benchmark, the misroute rate can be measured on the tool output before `parseToolInput`, which a benchmark script can capture directly.
- **[`ml` → `g` override for non-spoon rows still copies the number]** (`150 ml Joghurt` → `150 g`) → Existing behavior (ml ≈ g). Not a spoon issue, out of scope.
- **[Cached PWA clients don't send `gramsPerSpoon` on confirm]** → All new fields are optional. Old clients get the deterministic conversions, and gram rows resolved through them stay without an amount, as today.

## Migration Plan

- **Deploy.** One commit to `main` builds both images from the same SHA, so backend and frontend ship together. Every new request/response field is optional in both directions.
- **Rollback.** Redeploy the previous images. Nothing new is persisted: `gramsPerSpoon` and `spoonEstimated` exist only on request-scoped drafts and provenance, so rollback is safe.
- **Live catalog: no change required.** The schema is unchanged, and `density` stays optional and keeps precedence. Editing `catalog.seed.json` would have no effect on the running deployment anyway.
- **Saved recipes: optional one-off audit.** Recipes imported before this fix may hold spoon rows stored as bare numbers (e.g. `2 g Olivenöl`). They can't be found precisely, because tracked rows don't persist the spoon measure. Small tracked amounts are a good proxy. On the server, run:

  ```sh
  docker compose exec backend node -e '
  const rs = JSON.parse(require("fs").readFileSync("data/recipes.json","utf8"));
  for (const r of rs) for (const i of r.ingredients)
    if (!i.untracked && !i.pieceQuantity && (i.unit==="g"||i.unit==="ml") && i.amount <= 5)
      console.log(`${r.name} | ${i.name} | ${i.amount} ${i.unit}`);'
  ```

  Fix any hits by hand in the recipe editor. Genuine small amounts (e.g. 3 g Backpulver) will also show up, so this is a list to review, not to auto-correct.
- **Meal log: history is not corrected.** Entries logged from an affected recipe keep the amounts they were logged with. Fixing the recipe corrects future logs only. Re-log specific days if their totals matter.

## Open Questions

- **Haiku 4.5 vs Sonnet 5 for extraction.** Answered by the `rezepte/` benchmark after this lands, by comparing extracted grams per ingredient against hand-checked expected values. Either answer is a config value (`ANTHROPIC_MODEL`) plus a larger `max_tokens` if Sonnet 5, and doesn't touch this design.
