## MODIFIED Requirements

### Requirement: Ingredient matching against existing catalog
The system SHALL, for each ingredient name extracted from the photos, attempt to match it against the existing ingredient catalog using the existing ingredient search service. When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit`, `macrosPerUnit`, and `untracked` flag, while keeping the model-extracted `amount`. When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no match is found, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), `unit` (if any), and `pieceQuantity` (if any), without macros and without an `untracked` flag (the user sets it manually in the review UI if needed).

When the model returns piece-quantity fields for an ingredient (see "Resolve piece quantities to gram weights"), the matching pipeline MUST preserve them on the draft row, subject to:
- If the resolved catalog `unit` is `g` or `ml`, `pieceQuantity` is preserved verbatim and the catalog `unit` is used.
- If the resolved catalog `unit` is anything other than `g` or `ml` (e.g. `tbsp`, `piece`), `pieceQuantity` MUST be dropped and the row falls back to the catalog unit's macros, because piece quantities are only meaningful when the row is mass-tracked.
- The `unitOverridden` flag MUST be raised when the model's `unit` differs from the catalog `unit`, regardless of whether `pieceQuantity` is set.

#### Scenario: Matched ingredient
- **WHEN** the model extracts an ingredient name "olive oil" and the catalog returns a matching entry with `unit: "ml"` and known macros
- **THEN** the draft row contains the matched name, `unit: "ml"`, the matched `macrosPerUnit`, and the model's extracted `amount`
- **AND** the row is not flagged as unmatched

#### Scenario: Unit override flagged
- **WHEN** the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the draft row uses `unit: "g"` (catalog wins), keeps `amount: 2`, and is flagged `unitOverridden: true`

#### Scenario: Unmatched ingredient
- **WHEN** the model extracts an ingredient name that has no match in the catalog
- **THEN** the draft row is flagged as unmatched and carries only the extracted `name`, `amount`, `unit`, and `pieceQuantity` (when present), with no `macrosPerUnit` and no `untracked` flag

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

## ADDED Requirements

### Requirement: Review UI surfaces and allows toggling the untracked flag
The frontend review-import screen SHALL render the `untracked` flag on every draft ingredient row that carries it, with the same visual treatment used in the recipe form (muted styling and/or a small badge). The screen SHALL also provide a toggle on every row — including unmatched rows that arrived without a flag — that lets the user mark the row as untracked or clear the flag before saving the recipe. Saving the recipe MUST persist whatever `untracked` value the user left on each row.

#### Scenario: Inherited untracked flag visible in review
- **WHEN** the importer returns a draft with one row inheriting `untracked: true` from a FOODS match
- **THEN** the review screen renders that row visually muted with the untracked toggle in the on state

#### Scenario: User toggles unmatched row to untracked
- **WHEN** the user opens an imported draft, finds an unmatched row "fresh thyme", and toggles it to untracked
- **THEN** the form state for that row carries `untracked: true` and the row's visual treatment switches to muted

#### Scenario: User clears an inherited untracked flag
- **WHEN** the importer returns a row with inherited `untracked: true` and the user toggles it off before saving
- **THEN** the row is saved with `untracked: false` (or absent)

#### Scenario: Saved recipe reflects review-time toggle state
- **WHEN** the user saves the imported recipe after toggling some rows
- **THEN** the persisted recipe carries `untracked` per row exactly as left in the review UI
