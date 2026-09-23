## ADDED Requirements

### Requirement: Parser moves spoon and ounce values off the canonical unit

When parsing the extractor's tool output, the system SHALL move any spoon or cup measure the model reported outside the raw-display fields onto those fields before matching. Every spoon measure is then converted by the same rules, however the model shaped it. A label counts as a spoon or cup measure when its normalized form (lowercased, trimmed, trailing dots removed) is one of the known measures in "Importer converts spoon measures on tracked matches". The rules apply in this order, so a label the model wrote beats a label derived from an enum value:

- **Piece fields whose `pieceUnitLabel` is a spoon or cup measure**: the ingredient is a spoon measure, not a counted piece.
  - `pieceAmount` becomes `rawDisplayAmount` and `pieceUnitLabel` becomes `rawDisplayUnitLabel`, unless raw-display fields are already present.
  - `gramsPerPiece` becomes `gramsPerSpoon`, unless `gramsPerSpoon` is already present.
  - The piece fields and the piece-derived `amount`/`unit` are cleared.
- **`unit` is `tbsp`, `tsp` or `cup`**: the value is a spoon count, not a mass or volume.
  - `amount` and `unit` are cleared.
  - If no raw-display fields are present, `amount` becomes `rawDisplayAmount`, and `rawDisplayUnitLabel` becomes the German label for that unit (`tbsp` → `EL`, `tsp` → `TL`, `cup` → `Tasse`).
  - If raw-display fields are present, they are the literal reading and are kept as they are.
- **The raw-display label is a spoon or cup measure and `unit` is `ml`**: `amount` and `unit` are cleared. The volume follows from the spoon itself, so an `ml` value next to it can only be the model's own conversion. A `g` amount next to a spoon measure is kept as a printed weight.
- **`unit` is `oz`**: `amount` becomes `amount × 28.35` rounded to one decimal, and `unit` becomes `g`.
- **`gramsPerSpoon`** is kept only when it is a positive finite number and the raw-display label is a spoon or cup measure. Otherwise it is dropped.

These rules MUST run before piece validation and matching. They MUST NOT fail the import.

The rules act on the structured fields only. They MUST NOT read `sourceText` and MUST NOT alter it. It stays the verbatim record of the printed line, so a normalized spoon can always be checked against what was actually read.

#### Scenario: Tablespoon on the canonical unit moves to the raw-display fields

- **WHEN** the model returns `{ name: "Olivenöl", amount: 2, unit: "tbsp" }`
- **THEN** the parsed ingredient carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"`, and no `amount` or `unit`

#### Scenario: Literal raw-display reading wins over a spoon unit

- **WHEN** the model returns `{ name: "Olivenöl", amount: 2, unit: "tbsp", rawDisplayAmount: 2, rawDisplayUnitLabel: "Esslöffel" }`
- **THEN** the parsed ingredient carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "Esslöffel"`, and no `amount` or `unit`

#### Scenario: Spoon reported as a piece becomes a spoon measure

- **WHEN** the model returns `{ name: "Erdnussmus", amount: 28, unit: "g", pieceAmount: 2, pieceUnitLabel: "EL", gramsPerPiece: 14 }`
- **THEN** the parsed ingredient carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"`, `gramsPerSpoon: 14`, no `pieceQuantity`, and no `amount` or `unit`

#### Scenario: Model-converted millilitres next to a spoon are dropped

- **WHEN** the model returns `{ name: "Zimt", amount: 2.5, unit: "ml", rawDisplayAmount: 0.5, rawDisplayUnitLabel: "TL", gramsPerSpoon: 2.5 }`
- **THEN** the parsed ingredient carries `rawDisplayAmount: 0.5`, `rawDisplayUnitLabel: "TL"`, `gramsPerSpoon: 2.5`, and no `amount` or `unit`

#### Scenario: Printed grams next to a spoon are kept

- **WHEN** the model returns `{ name: "Speisestärke", amount: 12, unit: "g", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL" }`
- **THEN** the parsed ingredient keeps `amount: 12` and `unit: "g"` alongside the raw-display fields

#### Scenario: Ounces converted to grams

- **WHEN** the model returns `{ name: "Butter", amount: 2, unit: "oz" }`
- **THEN** the parsed ingredient carries `amount: 56.7` and `unit: "g"`

#### Scenario: Estimate on a non-spoon label is dropped

- **WHEN** the model returns `{ name: "Pfeffer", rawDisplayAmount: 1, rawDisplayUnitLabel: "Prise", gramsPerSpoon: 0.3 }`
- **THEN** the parsed ingredient carries the raw-display fields and no `gramsPerSpoon`

#### Scenario: Normalization leaves the verbatim line untouched

- **WHEN** the model returns `{ name: "Olivenöl", amount: 2, unit: "tbsp", sourceText: "2 EL Olivenöl" }`
- **THEN** the parsed ingredient carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"`, no `amount` or `unit`, and `sourceText: "2 EL Olivenöl"` unchanged

## MODIFIED Requirements

### Requirement: Ingredient matching against existing catalog

The system SHALL, for each ingredient name extracted from the photos, attempt to match it using a strict source cascade: first the user's catalog (`CATALOG`, including synonyms), then — only when the catalog returns zero candidates — scanned products (`SCAN`) via name search. The first tier returning at least one candidate wins; the lower tier MUST NOT be consulted. Open Food Facts MUST NOT be queried during import matching.

When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit`, `macrosPerUnit`, and `untracked` flag, while keeping the model-extracted `amount`, and MUST carry the winning tier as its `source` (`CATALOG` or `SCAN`). When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no tier produces a match, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), `unit` (if any), `pieceQuantity` (if any), `note` (if any), and the spoon measure — `rawDisplayAmount`, `rawDisplayUnitLabel` and `gramsPerSpoon` (each if any) — without macros, without `displayQuantity`, and without an `untracked` flag (the user sets it manually in the review UI if needed).

When the model returns piece-quantity fields for an ingredient (see "Resolve piece quantities to gram weights"), the matching pipeline MUST preserve them on the draft row, subject to:
- If the resolved catalog `unit` is `g` or `ml`, `pieceQuantity` is preserved verbatim and the catalog `unit` is used.
- If the resolved catalog `unit` is anything other than `g` or `ml` (e.g. `tbsp`, `piece`), `pieceQuantity` MUST be dropped and the row falls back to the catalog unit's macros, because piece quantities are only meaningful when the row is mass-tracked.
- The `unitOverridden` flag MUST be raised when the model's `unit` differs from the catalog `unit`, regardless of whether `pieceQuantity` is set.

When the extractor returns a `note` field on an ingredient, the matching pipeline MUST preserve it verbatim on the resulting draft row, regardless of match outcome. The note MUST NOT influence matching, normalization, or any post-match flag. The note rides along on both matched and unmatched rows.

#### Scenario: Matched ingredient

- **WHEN** the model extracts an ingredient name "olive oil" and the catalog returns a matching entry with `unit: "ml"` and known macros
- **THEN** the draft row contains the matched name, `unit: "ml"`, the matched `macrosPerUnit`, and the model's extracted `amount`
- **AND** the row is not flagged as unmatched

#### Scenario: Food confirmed in an earlier import matches on a later one

- **WHEN** the model extracts `Kirschtomaten` and the catalog contains a `Kirschtomaten` entry the user confirmed during a previous import
- **THEN** the draft row is matched against that entry with `source: 'CATALOG'`

#### Scenario: Scanned product matched when the catalog has no hit

- **WHEN** the model extracts `Skyr`, the catalog returns zero candidates, and a scanned product named `Skyr` exists
- **THEN** the draft row is matched against the scanned product with `source: 'SCAN'`

#### Scenario: Catalog hit wins without consulting scanned products

- **WHEN** the model extracts an ingredient for which the catalog returns at least one candidate
- **THEN** the SCAN tier is not searched for that ingredient

#### Scenario: OFF never queried during import

- **WHEN** an import draft is matched end to end
- **THEN** no Open Food Facts search is performed for any ingredient

#### Scenario: Unit override flagged

- **WHEN** the model extracts `{ name: "Joghurt", amount: 150, unit: "ml" }` and the catalog match has `unit: "g"`
- **THEN** the draft row uses `unit: "g"` (catalog wins), keeps `amount: 150`, and is flagged `unitOverridden: true`

#### Scenario: Unmatched ingredient

- **WHEN** the model extracts an ingredient name that has no match in either cascade tier
- **THEN** the draft row is flagged as unmatched and carries only the extracted `name`, `amount`, `unit`, `pieceQuantity` (when present), `note` (when present), and the spoon measure fields (when present), with no `macrosPerUnit` and no `untracked` flag

#### Scenario: Unmatched ingredient keeps its spoon measure

- **WHEN** the model extracts `{ name: "Erdnussmus", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL", gramsPerSpoon: 16 }` and no cascade tier has a match for `Erdnussmus`
- **THEN** the unmatched draft row carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"`, `gramsPerSpoon: 16`, no `amount`, and no `displayQuantity`

#### Scenario: Piece quantity preserved through mass-unit match

- **WHEN** the model extracts `{ name: "Zwiebel", amount: 150, unit: "g", pieceAmount: 1, pieceUnitLabel: "Zwiebel", gramsPerPiece: 150 }` and the catalog match for "Zwiebel" has `unit: "g"` with known macros
- **THEN** the draft row contains the matched name, `unit: "g"`, matched macros, `amount: 150`, and `pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`

#### Scenario: Piece quantity dropped through non-mass match

- **WHEN** the model extracts `{ name: "Knoblauch", amount: 6, unit: "g", pieceAmount: 2, pieceUnitLabel: "Zehe", gramsPerPiece: 3 }` and the catalog match for "Knoblauch" has `unit: "tbsp"`
- **THEN** the draft row uses the catalog `unit: "tbsp"`, drops the `pieceQuantity`, and is flagged `unitOverridden: true`

#### Scenario: Untracked inherited from the catalog match

- **WHEN** the model extracts `{ name: "salt", amount: 5, unit: "g" }` and the catalog match for `salz` has `unit: "g"` and `untracked: true`
- **THEN** the matched draft row carries `untracked: true` (the flag is inherited from the catalog match)

#### Scenario: Tracked match yields no untracked flag on the draft row

- **WHEN** the model extracts an ingredient that matches a tracked catalog entry
- **THEN** the matched draft row carries `untracked: false` (or omits the field) — the row is treated as tracked

#### Scenario: Note preserved on matched row

- **WHEN** the model extracts `{ name: "Ingwer", amount: 5, unit: "g", note: "fein gehackt" }` and the catalog match for `Ingwer` has `unit: "g"` with known macros
- **THEN** the matched draft row contains `note: "fein gehackt"` alongside the matched fields

#### Scenario: Note preserved on unmatched row

- **WHEN** the model extracts `{ name: "Yuzu-Schale", amount: 2, unit: "g", note: "fein abgerieben" }` and no cascade tier has a match for `Yuzu-Schale`
- **THEN** the unmatched draft row contains `note: "fein abgerieben"` alongside the extracted name, amount, and unit

#### Scenario: Note absent when extractor omits it

- **WHEN** the model extracts an ingredient with no `note` field on it
- **THEN** the resulting draft row has no `note` field, regardless of match outcome

### Requirement: Missing amount surfaced, never guessed
When an ingredient amount or unit is not visible in any of the submitted photos, the system MUST return that field as missing rather than guess. Unmatched rows with missing amounts and matched rows with missing amounts MUST both be representable in the draft.

The "never guess" rule applies to the *amount the recipe states*. It does NOT apply to two intentional estimates, each surfaced as such in the review UI:

- the typical-weight-per-piece estimate the model produces for piece-counted ingredients (see "Resolve piece quantities to gram weights")
- the per-spoon weight estimate (`gramsPerSpoon`) the model produces for spoon- or cup-measured ingredients (see "Importer converts spoon measures on tracked matches" and "Estimated spoon amounts are flagged and marked")

#### Scenario: Amount not shown in photos
- **WHEN** the model extracts an ingredient whose amount is not visible (e.g. "salt to taste")
- **THEN** the draft row carries the ingredient with no `amount`, no `unit`, and no `pieceQuantity`, and the row is included in the draft

#### Scenario: Spoon estimate is not a stated amount
- **WHEN** the recipe states "2 EL Haferflocken"
- **THEN** the extracted ingredient carries the stated count and label on `rawDisplayAmount: 2` and `rawDisplayUnitLabel: "EL"`, the estimate on `gramsPerSpoon`, and no `amount` or `unit`

### Requirement: Validate model-returned piece arithmetic
On parsing the tool output, the system SHALL validate the piece fields. Piece fields whose `pieceUnitLabel` is a spoon or cup measure are not pieces. "Parser moves spoon and ounce values off the canonical unit" turns them into a spoon measure before these rules apply.

- If `pieceAmount` is present, both `pieceUnitLabel` (non-empty string) and `gramsPerPiece` (positive finite number) MUST also be present; otherwise the system SHALL drop all piece fields for that ingredient and treat it as mass-only.
- If `gramsPerPiece` is present without `pieceAmount`, the system SHALL drop `gramsPerPiece` and treat the ingredient as mass-only.
- If `pieceAmount * gramsPerPiece` does not equal `amount` within a 5% tolerance, the system SHALL recompute `amount = pieceAmount * gramsPerPiece` and use that value, trusting the explicit per-piece weight over the aggregate.
- If `unit` is anything other than `g` or `ml` while piece fields are present, the system SHALL drop the piece fields (a non-mass total is incompatible with a per-piece gram weight).

These adjustments MUST happen during draft construction; the user MUST NOT see inconsistent piece arithmetic in the review UI.

#### Scenario: Missing companion field drops piece info
- **WHEN** the model returns `{ name: "onion", amount: 150, unit: "g", pieceAmount: 1 }` (no `pieceUnitLabel`, no `gramsPerPiece`)
- **THEN** the draft row carries `amount: 150` with no `pieceQuantity`

#### Scenario: Inconsistent piece arithmetic recomputed
- **WHEN** the model returns `{ name: "onion", amount: 200, unit: "g", pieceAmount: 1, pieceUnitLabel: "onion", gramsPerPiece: 150 }`
- **THEN** the draft row carries `amount: 150` (recomputed from `1 * 150`) and `pieceQuantity = { amount: 1, unitLabel: "onion", gramsPerPiece: 150 }`

#### Scenario: Piece fields with non-mass unit dropped
- **WHEN** the model returns `{ name: "olive oil", amount: 2, unit: "tbsp", pieceAmount: 2, pieceUnitLabel: "tbsp", gramsPerPiece: 14 }`
- **THEN** the draft row carries no `pieceQuantity`, and the ingredient is a spoon measure of `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "tbsp"`, `gramsPerSpoon: 14` with no `amount` or `unit` before matching

### Requirement: Extractor captures literal display quantity for untracked-eligible rows
The vision model's `extract_recipe` tool schema SHALL accept these optional fields on each ingredient. They capture the literal textual amount and unit as written in the recipe when the recipe does not state the ingredient in grams or millilitres. `g` and `ml` are the only canonical units the extraction schema offers.

- `rawDisplayAmount` (number, optional): the literal amount as written, e.g. `1`, `0.5`, `2`. Fractional values permitted.
- `rawDisplayUnitLabel` (string, optional): the literal textual unit as written, e.g. `"TL"`, `"EL"`, `"Prise"`, `"Schuss"`, `"Teelöffel"`, or `"n. Geschmack"` when the recipe uses a qualitative phrase.
- `gramsPerSpoon` (number, optional): the model's estimate of the mass in grams of one level spoon or cup of this specific food, as named by `rawDisplayUnitLabel`. Examples: `8` for 1 EL Haferflocken, `14` for 1 EL Erdnussmus, `2.5` for 1 TL Zimt.

When the recipe states the ingredient using a unit other than `g` or `ml` (spoons, cups, pinches, splashes, qualitative phrases), the model MUST populate the raw-display fields. The rules for spoon and cup measures (`EL`, `TL`, `Esslöffel`, `Teelöffel`, `Tasse`, `tbsp`, `tsp`, `cup`):

- They MUST be reported on the raw-display fields and MUST NOT be converted into `amount`/`unit`.
- The model populates `amount`/`unit` only when the recipe itself prints a weight or volume in `g` or `ml`.
- The model MUST also populate `gramsPerSpoon`.

When the recipe states the ingredient in `g` or `ml`, the model SHOULD omit the raw-display fields. When the ingredient has no quantity at all (e.g. "Salz n. Geschmack"), the model MAY populate `rawDisplayUnitLabel` alone with the qualitative phrase and omit `rawDisplayAmount`.

The "never guess" rule on stated amounts continues to apply (see `Missing amount surfaced, never guessed`): the model MUST NOT invent `rawDisplayAmount` or `rawDisplayUnitLabel`. These fields capture only what is literally present in the photos. `gramsPerSpoon` is an intentional estimate, like `gramsPerPiece`.

#### Scenario: Teaspoon seasoning captured
- **WHEN** the recipe states "1 TL Salz"
- **THEN** the model returns the ingredient with `rawDisplayAmount: 1` and `rawDisplayUnitLabel: "TL"`

#### Scenario: Tablespoon captured unconverted with a per-spoon estimate
- **WHEN** the recipe states "2 EL Olivenöl"
- **THEN** the model returns the ingredient with `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"`, a positive `gramsPerSpoon`, and no `amount` or `unit`

#### Scenario: Pinch captured without amount
- **WHEN** the recipe states "eine Prise Pfeffer"
- **THEN** the model returns the ingredient with `rawDisplayAmount: 1` and `rawDisplayUnitLabel: "Prise"` (the model may interpret "eine" as `1` since it is the literal count word)

#### Scenario: Qualitative quantity captured
- **WHEN** the recipe states "Salz n. Geschmack" with no numeric amount
- **THEN** the model returns the ingredient with `rawDisplayUnitLabel: "n. Geschmack"` and no `rawDisplayAmount`, no `amount`, no `unit`

#### Scenario: Canonical unit omits raw display fields
- **WHEN** the recipe states "200 g Mehl"
- **THEN** the model returns the ingredient with `amount: 200, unit: "g"` and no `rawDisplayAmount`, no `rawDisplayUnitLabel`

#### Scenario: Extraction schema offers only grams and millilitres
- **WHEN** the `extract_recipe` tool schema is sent to the model
- **THEN** the ingredient `unit` enum contains exactly `g` and `ml`

### Requirement: Importer converts spoon measures on tracked matches

When the importer constructs a draft ingredient row from the extractor output and the catalog match, and ALL of the following hold:

- The row was matched to a FOODS/USER/SCAN entry that is tracked (`untracked` is not `true`).
- The row has no canonical `amount` (the recipe printed none) and no piece-derived total.
- The extractor returned a `rawDisplayUnitLabel` whose normalized form (lowercased, trimmed, trailing dots removed) is a known spoon/volume measure: `tl`/`teelöffel`/`teeloeffel`/`tsp`/`teaspoon` (5 ml), `el`/`esslöffel`/`essloeffel`/`tbsp`/`tablespoon` (15 ml), or `tasse`/`cup` (240 ml).

then the system SHALL set the canonical `amount` in the matched food's `unit` from the first rule that applies. Throughout, the spoon count is `rawDisplayAmount ?? 1` and the volume in ml is `count × mlPerSpoon`.

1. The matched `unit` is `ml`: `amount` = the volume.
2. The matched `unit` is `g` and the matched food carries a `density`: `amount` = volume × density.
3. The matched `unit` is `g`, the food has no `density`, and the extractor returned a plausible `gramsPerSpoon`: `amount` = count × `gramsPerSpoon`. The row is flagged `spoonEstimated` (see "Match provenance is returned on every import response"). An estimate is plausible when it is at most 1.5 g per ml of that spoon's volume (7.5 g for a TL, 22.5 g for an EL, 360 g for a Tasse). Nothing a kitchen spoon holds is denser than honey (about 1.4 g/ml), so a heavier estimate means the model mixed up spoon sizes, and it is ignored.
4. Otherwise (including an implausible estimate) no conversion is performed. The row is left with no `amount` and is surfaced via the existing `missingAmount` flag. The importer MUST NOT guess beyond the model's own estimate.

Converted amounts are rounded to one decimal. A converted tracked row MUST NOT carry a `displayQuantity` (that field is reserved for untracked rows). The raw-display fields and `gramsPerSpoon` are consumed by the conversion and not persisted on the row.

Every spoon measure reaches this conversion. Spoon values the model reported on the canonical `unit` or on the piece fields are moved to the raw-display fields during parsing (see "Parser moves spoon and ounce values off the canonical unit"), so a spoon is never kept as a bare number under the catalog unit.

#### Scenario: Tablespoon of a g-unit staple with density converts

- **WHEN** the extractor returns `{ name: "Speisestärke", rawDisplayAmount: 2, rawDisplayUnitLabel: "TL" }` and the catalog match is a tracked FOODS entry with `unit: "g"` and `density: 0.55`
- **THEN** the draft row carries `unit: "g"`, `amount ≈ 5.5` (`2 × 5 ml × 0.55`), `untracked` absent/false, and no `displayQuantity`

#### Scenario: Tablespoon of an ml-unit food converts without density

- **WHEN** the extractor returns `{ name: "Sojasauce", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL" }` and the catalog match is a tracked FOODS entry with `unit: "ml"`
- **THEN** the draft row carries `unit: "ml"`, `amount: 30` (`2 × 15 ml`), and no `displayQuantity`

#### Scenario: Density wins over the model's estimate

- **WHEN** the extractor returns `{ name: "Speisestärke", rawDisplayAmount: 2, rawDisplayUnitLabel: "TL", gramsPerSpoon: 4 }` and the catalog match is a tracked FOODS entry with `unit: "g"` and `density: 0.55`
- **THEN** the draft row carries `amount ≈ 5.5` (from density, not `2 × 4`) and is not flagged `spoonEstimated`

#### Scenario: Spoon of a g-unit food without density uses the per-spoon estimate

- **WHEN** the extractor returns `{ name: "Haferflocken", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL", gramsPerSpoon: 8 }` and the catalog match is a tracked FOODS entry with `unit: "g"` and no `density`
- **THEN** the draft row carries `unit: "g"`, `amount: 16`, no `displayQuantity`, is flagged `spoonEstimated`, and is not flagged `missingAmount`

#### Scenario: Implausible per-spoon estimate is ignored

- **WHEN** the extractor returns `{ name: "Honig", rawDisplayAmount: 1.5, rawDisplayUnitLabel: "TL", gramsPerSpoon: 21 }` (21 g for one 5 ml TL is 4.2 g/ml) and the catalog match is a tracked FOODS entry with `unit: "g"` and no `density`
- **THEN** the draft row carries no `amount`, is flagged `missingAmount`, and is not flagged `spoonEstimated`

#### Scenario: Spoon of a g-unit food without density is not guessed

- **WHEN** the extractor returns `{ name: "Petersilie", rawDisplayAmount: 1, rawDisplayUnitLabel: "EL" }` and the catalog match is a tracked FOODS entry with `unit: "g"`, no `density`, and no `gramsPerSpoon` was returned
- **THEN** the draft row carries no `amount`, no `displayQuantity`, and the row is flagged `missingAmount`

#### Scenario: Tablespoon the model put on the canonical unit converts

- **WHEN** the model returns `{ name: "Olivenöl", amount: 2, unit: "tbsp" }` and the catalog match is a tracked FOODS entry with `unit: "ml"`
- **THEN** the draft row carries `unit: "ml"`, `amount: 30`, and is not flagged `unitOverridden`

#### Scenario: Non-spoon raw-display label is not converted

- **WHEN** the extractor returns `{ name: "Speisestärke", rawDisplayAmount: 1, rawDisplayUnitLabel: "Prise" }` and the catalog match is a tracked FOODS entry with `unit: "g"` and `density: 0.55`
- **THEN** no conversion is attempted; the draft row carries no `amount` and is flagged `missingAmount`

#### Scenario: Stated canonical amount wins over conversion

- **WHEN** the extractor returns `{ name: "Speisestärke", amount: 12, unit: "g", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL" }` and the catalog match is a tracked FOODS entry with `unit: "g"` and `density: 0.55`
- **THEN** the draft row carries `amount: 12` (the stated canonical amount is kept; no conversion overrides it)

### Requirement: Match provenance is returned on every import response

The import endpoint SHALL return a `provenance` object on every successful recipe-draft response, with no configuration gating. `provenance.ingredients` SHALL be a parallel array to the draft's `ingredients`: entry *i* describes how draft ingredient *i* was matched, in extraction order, so a client can correlate a row to its provenance by position without name matching.

For each extracted ingredient, the entry MUST include:

- `raw`: the parsed ingredient before any matching (name, amount, unit, piece-quantity fields, raw display fields and `gramsPerSpoon` when present, note when present, and `sourceText` when present). Its structured fields reflect the parser's validation and spoon normalization (see "Validate model-returned piece arithmetic" and "Parser moves spoon and ounce values off the canonical unit"). `sourceText` is the one field no parsing step alters, and it records the line exactly as read.
- `candidates`: the top candidates returned by the winning cascade tier for the raw name, in rank order, capped at 5. Each candidate exposes `name`, `source`, `unit`, and `untracked`.
- `chosen`: the candidate picked as the match, or `null` when no tier matched.
- `flags`: a flat object of the post-match flags that fired on this row (`unitOverridden`, `pieceQuantityDropped`, `untrackedInherited`, `missingAmount`, `spoonEstimated`). `spoonEstimated` is `true` only when a tracked row's `amount` came from the model's per-spoon estimate (see "Importer converts spoon measures on tracked matches"). Rows converted by fixed volume or by catalog density are deterministic and carry `spoonEstimated: false`.

The provenance payload MUST NOT be persisted anywhere; it exists only on the request-scoped response and MUST NOT appear on a saved recipe.

#### Scenario: Provenance present without configuration

- **WHEN** a client calls `POST /import-recipe-from-photos` with a valid image whose extraction yields two ingredients, with no import-debug environment variable set
- **THEN** the response is `200` with a `provenance.ingredients` array of length 2, each entry containing `raw`, `candidates`, `chosen`, and `flags`

#### Scenario: Provenance is positionally parallel to the draft ingredients

- **WHEN** an import yields a draft whose second ingredient is unmatched and whose third is matched
- **THEN** `provenance.ingredients[1].chosen` is `null` and `provenance.ingredients[2].chosen` describes the match for draft ingredient index 2

#### Scenario: Matched row carries chosen and the unit-override flag

- **WHEN** the model extracts `{ name: "Joghurt", amount: 150, unit: "ml" }` and the catalog match has `unit: "g"`
- **THEN** that provenance entry has a non-null `chosen` with `unit: "g"`, `flags.unitOverridden` is `true`, `flags.pieceQuantityDropped` is `false`, and `candidates[0]` matches `chosen`

#### Scenario: Unmatched row carries null chosen

- **WHEN** the model extracts an ingredient name that no cascade tier matches
- **THEN** that provenance entry has `chosen: null`, an empty `candidates` array, and all `flags` false

#### Scenario: Candidate cap

- **WHEN** the winning tier returns more than 5 candidates for a raw ingredient name
- **THEN** that entry's `candidates` array has length exactly 5, in the original rank order

#### Scenario: Verbatim source text carried on raw

- **WHEN** the model extracts `{ name: "Zwiebel", amount: 150, unit: "g", pieceAmount: 1, pieceUnitLabel: "Zwiebel", gramsPerPiece: 150, sourceText: "1 mittelgroße Zwiebel, gewürfelt" }`
- **THEN** that provenance entry's `raw.sourceText` is `"1 mittelgroße Zwiebel, gewürfelt"`, whether or not the ingredient matched

#### Scenario: Normalized spoon keeps the printed line on raw

- **WHEN** the model extracts `{ name: "Olivenöl", amount: 2, unit: "tbsp", sourceText: "2 EL Olivenöl" }`
- **THEN** that provenance entry's `raw` carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"`, no `amount` or `unit`, and `sourceText: "2 EL Olivenöl"` exactly as the model returned it

#### Scenario: Estimated spoon amount flagged

- **WHEN** an import converts `{ name: "Haferflocken", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL", gramsPerSpoon: 8 }` against a tracked `g` entry without `density`
- **THEN** that provenance entry has `flags.spoonEstimated: true` and `flags.missingAmount: false`

#### Scenario: Deterministic spoon conversion not flagged

- **WHEN** an import converts `{ name: "Olivenöl", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL" }` against a tracked `ml` entry
- **THEN** that provenance entry has `flags.spoonEstimated: false`

#### Scenario: Provenance is not persisted

- **WHEN** the user saves a reviewed draft
- **THEN** the stored recipe carries no provenance data

### Requirement: Rows with uncertain matches are marked

The review screen SHALL render a quiet inline marker on any imported row whose provenance indicates the match warrants a look: any of `flags.unitOverridden`, `flags.pieceQuantityDropped`, `flags.untrackedInherited`, `flags.missingAmount`, or `flags.spoonEstimated` is true, or `chosen` is non-null while `candidates` held more than one option. The marker SHALL state which condition applies in German and MUST NOT block saving or require dismissal. For `flags.spoonEstimated` it SHALL name the spoon measure the estimate came from, built from `raw.rawDisplayAmount` and `raw.rawDisplayUnitLabel` (e.g. `Menge aus 2 EL geschätzt`). A missing `spoonEstimated` flag is treated as `false`.

#### Scenario: Unit override marked

- **WHEN** a row's provenance has `flags.unitOverridden` true
- **THEN** that row shows a marker explaining the extracted unit was replaced by the catalog unit

#### Scenario: Estimated spoon amount marked

- **WHEN** a row's provenance has `flags.spoonEstimated` true and `raw` carries `rawDisplayAmount: 2` and `rawDisplayUnitLabel: "EL"`
- **THEN** that row shows the marker `Menge aus 2 EL geschätzt`, while its raw line still shows the verbatim `sourceText`

#### Scenario: Ambiguous match marked

- **WHEN** a row matched while its tier returned four candidates
- **THEN** that row shows a marker indicating alternatives exist

#### Scenario: Confident match unmarked

- **WHEN** a row matched as the only candidate with no flags set
- **THEN** that row shows no marker

#### Scenario: Marker never blocks saving

- **WHEN** several rows carry markers and the user submits the form
- **THEN** the recipe saves without requiring the markers to be dismissed
