# ai-recipe-import — delta

## MODIFIED Requirements

### Requirement: Ingredient matching against existing catalog

The system SHALL, for each ingredient name extracted from the photos, attempt to match it using a strict source cascade: first the curated FOODS source (including runtime-learned synonyms), then — only when FOODS returns zero candidates — the user-foods overlay (`USER`), then — only when both return zero candidates — scanned products (`SCAN`) via name search. The first tier returning at least one candidate wins; lower tiers MUST NOT be consulted. Open Food Facts MUST NOT be queried during import matching.

When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit`, `macrosPerUnit`, and `untracked` flag, while keeping the model-extracted `amount`, and MUST carry the winning tier as its `source` (`FOODS`, `USER`, or `SCAN`). When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no tier produces a match, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), `unit` (if any), `pieceQuantity` (if any), and `note` (if any), without macros and without an `untracked` flag (the user sets it manually in the review UI if needed).

When the model returns piece-quantity fields for an ingredient (see "Resolve piece quantities to gram weights"), the matching pipeline MUST preserve them on the draft row, subject to:
- If the resolved catalog `unit` is `g` or `ml`, `pieceQuantity` is preserved verbatim and the catalog `unit` is used.
- If the resolved catalog `unit` is anything other than `g` or `ml` (e.g. `tbsp`, `piece`), `pieceQuantity` MUST be dropped and the row falls back to the catalog unit's macros, because piece quantities are only meaningful when the row is mass-tracked.
- The `unitOverridden` flag MUST be raised when the model's `unit` differs from the catalog `unit`, regardless of whether `pieceQuantity` is set.

When the extractor returns a `note` field on an ingredient, the matching pipeline MUST preserve it verbatim on the resulting draft row, regardless of match outcome. The note MUST NOT influence matching, normalization, or any post-match flag. The note rides along on both matched and unmatched rows.

#### Scenario: Matched ingredient

- **WHEN** the model extracts an ingredient name "olive oil" and the FOODS tier returns a matching entry with `unit: "ml"` and known macros
- **THEN** the draft row contains the matched name, `unit: "ml"`, the matched `macrosPerUnit`, and the model's extracted `amount`
- **AND** the row is not flagged as unmatched

#### Scenario: Overlay food matched when curated has no hit

- **WHEN** the model extracts `Kirschtomaten`, the FOODS tier returns zero candidates, and the user-foods overlay contains a `Kirschtomaten` entry
- **THEN** the draft row is matched against the overlay entry with `source: 'USER'`

#### Scenario: Scanned product matched when curated and overlay have no hit

- **WHEN** the model extracts `Skyr`, both FOODS and USER tiers return zero candidates, and a scanned product named `Skyr` exists
- **THEN** the draft row is matched against the scanned product with `source: 'SCAN'`

#### Scenario: Higher tier wins without consulting lower tiers

- **WHEN** the model extracts an ingredient for which the FOODS tier returns at least one candidate
- **THEN** the USER and SCAN tiers are not searched for that ingredient

#### Scenario: OFF never queried during import

- **WHEN** an import draft is matched end to end
- **THEN** no Open Food Facts search is performed for any ingredient

#### Scenario: Unit override flagged

- **WHEN** the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the draft row uses `unit: "g"` (catalog wins), keeps `amount: 2`, and is flagged `unitOverridden: true`

#### Scenario: Unmatched ingredient

- **WHEN** the model extracts an ingredient name that has no match in any cascade tier
- **THEN** the draft row is flagged as unmatched and carries only the extracted `name`, `amount`, `unit`, `pieceQuantity` (when present), and `note` (when present), with no `macrosPerUnit` and no `untracked` flag

#### Scenario: Piece quantity preserved through mass-unit match

- **WHEN** the model extracts `{ name: "Zwiebel", amount: 150, unit: "g", pieceAmount: 1, pieceUnitLabel: "Zwiebel", gramsPerPiece: 150 }` and the catalog match for "Zwiebel" has `unit: "g"` with known macros
- **THEN** the draft row contains the matched name, `unit: "g"`, matched macros, `amount: 150`, and `pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`

#### Scenario: Piece quantity dropped through non-mass match

- **WHEN** the model extracts `{ name: "Knoblauch", amount: 6, unit: "g", pieceAmount: 2, pieceUnitLabel: "Zehe", gramsPerPiece: 3 }` and the catalog match for "Knoblauch" has `unit: "tbsp"`
- **THEN** the draft row uses the catalog `unit: "tbsp"`, drops the `pieceQuantity`, and is flagged `unitOverridden: true`

#### Scenario: Untracked inherited from FOODS match

- **WHEN** the model extracts `{ name: "salt", amount: 5, unit: "g" }` and the catalog match for `salz` has `unit: "g"` and `untracked: true`
- **THEN** the matched draft row carries `untracked: true` (the flag is inherited from the FOODS match)

#### Scenario: Tracked match yields no untracked flag on the draft row

- **WHEN** the model extracts an ingredient that matches a tracked FOODS entry
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

### Requirement: Optional debug payload on the import response

When the backend is configured to emit debug information (env var `RECIPE_IMPORT_DEBUG=true` at startup; the variable accepts only the literal strings `true` or `false`, case-insensitive, and defaults to `false`), the import endpoint SHALL return an additional `debug` object on the recipe draft response. The `debug` object MUST contain a per-ingredient breakdown that lets a developer diagnose ingredient-matching mismatches without re-running the import.

For each ingredient extracted by the vision model, the `debug.ingredients` entry MUST include:
- `raw`: the ingredient as returned by the model, verbatim (name, amount, unit, piece-quantity fields, raw display fields if present), before any matching.
- `candidates`: the top N candidates returned by the winning cascade tier for the raw name, in rank order. The cap N is fixed at 5. Each candidate exposes `name`, `source` (`FOODS`, `USER`, or `SCAN`), `unit`, and `untracked`.
- `chosen`: the candidate picked as the match, or `null` when no match was found. `chosen` MUST be reference-equal in content to the corresponding entry in `candidates` (typically the first), or `null`.
- `flags`: a flat object with the post-match flags that fired on this row: `unitOverridden`, `pieceQuantityDropped`, `untrackedInherited` (booleans).

When `RECIPE_IMPORT_DEBUG` is not configured, the `debug` field MUST be absent from the response entirely (not `null`, not an empty object), so existing clients are unaffected.

The `debug` payload MUST NOT be persisted anywhere. It exists only on the request-scoped response.

#### Scenario: Debug field omitted by default

- **WHEN** the backend starts without `RECIPE_IMPORT_DEBUG` set and a client calls `POST /import-recipe-from-photos` with a valid image
- **THEN** the response is `200` with the existing draft shape
- **AND** the response body has no `debug` property

#### Scenario: Debug field present when enabled

- **WHEN** the backend starts with `RECIPE_IMPORT_DEBUG=1` and a client calls `POST /import-recipe-from-photos` with a valid image whose extraction yields two ingredients
- **THEN** the response is `200` with a `debug.ingredients` array of length 2
- **AND** each entry contains `raw`, `candidates`, `chosen`, and `flags`

#### Scenario: Matched row carries chosen and unit-override flag

- **WHEN** debug is enabled and the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the debug entry for that ingredient has a non-null `chosen` with `unit: "g"`
- **AND** `flags.unitOverridden` is `true`
- **AND** `flags.pieceQuantityDropped` is `false`
- **AND** `flags.untrackedInherited` is `false`
- **AND** `candidates[0]` matches the `chosen` candidate

#### Scenario: Cascade-tier source visible per candidate

- **WHEN** debug is enabled and an ingredient matches in the USER tier after a FOODS miss
- **THEN** the debug entry's `candidates` carry `source: 'USER'` and `chosen.source` is `'USER'`

#### Scenario: Unmatched row carries null chosen

- **WHEN** debug is enabled and the model extracts an ingredient name that has no match in any cascade tier
- **THEN** the debug entry has `chosen: null`
- **AND** `candidates` is an empty array
- **AND** all `flags` are `false`

#### Scenario: Piece-quantity drop is flagged

- **WHEN** debug is enabled and the model extracts `{ name: "Knoblauch", amount: 6, unit: "g", pieceAmount: 2, pieceUnitLabel: "Zehe", gramsPerPiece: 3 }` and the catalog match has `unit: "tbsp"`
- **THEN** the debug entry's `flags.pieceQuantityDropped` is `true`
- **AND** `flags.unitOverridden` is `true`

#### Scenario: Untracked inheritance is flagged

- **WHEN** debug is enabled and the model extracts `{ name: "salt", amount: 5, unit: "g" }` and the catalog match has `unit: "g"` and `untracked: true`
- **THEN** the debug entry's `flags.untrackedInherited` is `true`

#### Scenario: Candidate cap

- **WHEN** debug is enabled and the winning tier returns more than 5 candidates for a raw ingredient name
- **THEN** the debug entry's `candidates` array has length exactly 5, in the original rank order

## REMOVED Requirements

### Requirement: Match attempt falls back to a normalized name before recording

**Reason**: Superseded by the cascade fallback requirement below — the normalization retry now wraps the full source cascade, and the recorder no longer exists.
**Migration**: See the ADDED requirement "Match attempt falls back to a normalized name across the cascade".

### Requirement: Strict-unmatched ingredients are forwarded to the unmatched-ingredient recorder

**Reason**: The unmatched-ingredient collection subsystem is removed; unmatched rows are now resolved interactively at review time via the `unmatched-ingredient-resolution` capability, which captures richer data (full confirmed entries) than the recorder ever did.
**Migration**: Remove the recorder port from the import use case dependencies. No data migration — the collected store held only name counts, superseded by the user-foods overlay.

## ADDED Requirements

### Requirement: Match attempt falls back to a normalized name across the cascade

When the full source cascade (FOODS → USER → SCAN) returns zero candidates for `raw.name`, the system SHALL compute a normalized form of `raw.name` by stripping a single trailing `, …` clause and a single trailing `(…)` parenthetical, then collapsing whitespace. If the normalized form differs from the raw form, the system SHALL retry the full cascade once with the normalized name. Leading adjectives MUST NOT be stripped during normalization.

When the retry returns at least one candidate, the row SHALL be matched as if the winning tier had returned that candidate for the raw name — all existing matching rules (unit override, piece-drop, untracked inheritance, etc.) apply unchanged. When the retry also returns zero candidates, the row is flagged unmatched.

#### Scenario: Comma-suffix normalization rescues a match

- **WHEN** the extractor returns `{ name: "Ingwer, fein gehackt", amount: 5, unit: "g" }` and the FOODS tier has an entry whose canonical name is `"Ingwer"`
- **THEN** the cascade runs twice (first with `"Ingwer, fein gehackt"`, then with `"Ingwer"`) and the draft row is matched against the `Ingwer` entry with `amount: 5, unit: "g"`

#### Scenario: No retry when raw and normalized are identical

- **WHEN** the extractor returns `{ name: "unicorn dust", amount: 1, unit: "tsp" }` and the cascade returns zero candidates
- **THEN** the cascade is not retried (normalization yields `"unicorn dust"` unchanged) and the row is flagged unmatched

#### Scenario: No retry when raw name already matches

- **WHEN** the extractor returns `{ name: "Ingwer", amount: 5, unit: "g" }` and the FOODS tier returns at least one candidate
- **THEN** the cascade runs exactly once and the row is matched
