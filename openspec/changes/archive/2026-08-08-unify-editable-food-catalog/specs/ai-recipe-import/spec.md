# ai-recipe-import — delta

The import match cascade loses a tier. With FOODS and USER merged into one catalog, `FOODS → USER → SCAN` becomes `CATALOG → SCAN`, and matched rows carry `source: 'CATALOG'`. Every other matching rule — unit override, piece preservation, untracked inheritance, note pass-through — is unchanged.

## MODIFIED Requirements

### Requirement: Ingredient matching against existing catalog

The system SHALL, for each ingredient name extracted from the photos, attempt to match it using a strict source cascade: first the user's catalog (`CATALOG`, including synonyms), then — only when the catalog returns zero candidates — scanned products (`SCAN`) via name search. The first tier returning at least one candidate wins; the lower tier MUST NOT be consulted. Open Food Facts MUST NOT be queried during import matching.

When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit`, `macrosPerUnit`, and `untracked` flag, while keeping the model-extracted `amount`, and MUST carry the winning tier as its `source` (`CATALOG` or `SCAN`). When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no tier produces a match, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), `unit` (if any), `pieceQuantity` (if any), and `note` (if any), without macros and without an `untracked` flag (the user sets it manually in the review UI if needed).

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

- **WHEN** the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the draft row uses `unit: "g"` (catalog wins), keeps `amount: 2`, and is flagged `unitOverridden: true`

#### Scenario: Unmatched ingredient

- **WHEN** the model extracts an ingredient name that has no match in either cascade tier
- **THEN** the draft row is flagged as unmatched and carries only the extracted `name`, `amount`, `unit`, `pieceQuantity` (when present), and `note` (when present), with no `macrosPerUnit` and no `untracked` flag

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
