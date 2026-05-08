## MODIFIED Requirements

### Requirement: Ingredient matching against existing catalog
The system SHALL, for each ingredient name extracted from the photos, attempt to match it against the existing ingredient catalog using the existing ingredient search service. When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit` and `macrosPerUnit`, while keeping the model-extracted `amount`. When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no match is found, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), `unit` (if any), and `pieceQuantity` (if any), without macros.

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
- **THEN** the draft row is flagged as unmatched and carries only the extracted `name`, `amount`, `unit`, and `pieceQuantity` (when present), with no `macrosPerUnit`

#### Scenario: Piece quantity preserved through mass-unit match
- **WHEN** the model extracts `{ name: "Zwiebel", amount: 150, unit: "g", pieceAmount: 1, pieceUnitLabel: "Zwiebel", gramsPerPiece: 150 }` and the catalog match for "Zwiebel" has `unit: "g"` with known macros
- **THEN** the draft row contains the matched name, `unit: "g"`, matched macros, `amount: 150`, and `pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`

#### Scenario: Piece quantity dropped through non-mass match
- **WHEN** the model extracts `{ name: "Knoblauch", amount: 6, unit: "g", pieceAmount: 2, pieceUnitLabel: "Zehe", gramsPerPiece: 3 }` and the catalog match for "Knoblauch" has `unit: "tbsp"`
- **THEN** the draft row uses the catalog `unit: "tbsp"`, drops the `pieceQuantity`, and is flagged `unitOverridden: true`

### Requirement: Missing amount surfaced, never guessed
When an ingredient amount or unit is not visible in any of the submitted photos, the system MUST return that field as missing rather than guess. Unmatched rows with missing amounts and matched rows with missing amounts MUST both be representable in the draft.

The "never guess" rule applies to the *amount the recipe states*. It does NOT apply to the typical-weight-per-piece estimate the model produces for piece-counted ingredients (see "Resolve piece quantities to gram weights"), which is intentionally an estimate and is surfaced as such in the review UI.

#### Scenario: Amount not shown in photos
- **WHEN** the model extracts an ingredient whose amount is not visible (e.g. "salt to taste")
- **THEN** the draft row carries the ingredient with no `amount`, no `unit`, and no `pieceQuantity`, and the row is included in the draft

## ADDED Requirements

### Requirement: Resolve piece quantities to gram weights
When the source recipe states an ingredient as a count (e.g. "1 onion", "½ medium zucchini", "2 cloves garlic", "1 medium tomato"), the vision model SHALL — within the same `extract_recipe` tool call — return both the literal piece framing and a gram-weight estimate, using these fields on the ingredient object:

- `pieceAmount` (number, optional): the count as written, e.g. `1`, `0.5`, `2`. Fractional values are permitted.
- `pieceUnitLabel` (string, optional): the noun the recipe used to describe the piece, in the original language, e.g. `"onion"`, `"medium zucchini"`, `"clove"`, `"Knoblauchzehe"`.
- `gramsPerPiece` (number, optional): the model's estimate of a typical mass for one such piece, in grams.

When piece fields are present, the model MUST also populate `amount` and `unit` with the resolved total mass: `amount = pieceAmount * gramsPerPiece` and `unit = "g"` (or `"ml"` only when the recipe explicitly frames the piece as a liquid quantity, e.g. "juice of 1 lemon"). When the recipe states the ingredient by mass directly, the model MUST omit the piece fields.

The system SHALL surface the resolved `pieceQuantity` on the draft row using the shape `{ amount: pieceAmount, unitLabel: pieceUnitLabel, gramsPerPiece }`, so the review UI can render both the count and the gram-weight estimate. The user can edit either side before saving.

#### Scenario: Solid count ingredient
- **WHEN** the recipe states "1 onion" with no further detail
- **THEN** the draft row has `unit: "g"`, `amount` equal to the model's estimated total grams, and `pieceQuantity = { amount: 1, unitLabel: "onion", gramsPerPiece: <estimate> }`

#### Scenario: Fractional piece
- **WHEN** the recipe states "½ medium zucchini"
- **THEN** the draft row has `unit: "g"`, `amount` equal to `0.5 * gramsPerPiece`, and `pieceQuantity = { amount: 0.5, unitLabel: "medium zucchini", gramsPerPiece: <estimate> }`

#### Scenario: Multi-piece ingredient
- **WHEN** the recipe states "2 cloves garlic"
- **THEN** the draft row has `unit: "g"`, `amount` equal to `2 * gramsPerPiece`, and `pieceQuantity = { amount: 2, unitLabel: "clove", gramsPerPiece: <estimate> }`

#### Scenario: Mass-stated ingredient leaves piece fields empty
- **WHEN** the recipe states "200 g flour"
- **THEN** the draft row has `unit: "g"`, `amount: 200`, and no `pieceQuantity`

#### Scenario: Liquid by piece
- **WHEN** the recipe states "juice of 1 lemon" and the model estimates ~30 ml of juice per lemon
- **THEN** the draft row has `unit: "ml"`, `amount: 30`, and `pieceQuantity = { amount: 1, unitLabel: "lemon", gramsPerPiece: 30 }`

### Requirement: Validate model-returned piece arithmetic
On parsing the tool output, the system SHALL validate the piece fields:

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
- **THEN** the draft row carries `amount: 2`, `unit: "tbsp"`, and no `pieceQuantity`

### Requirement: Review UI shows piece quantity and weight together
The frontend review-import screen SHALL render piece-tracked ingredient rows with both the piece count and the resolved weight visible (e.g. `1 onion (≈ 150 g)`), and SHALL allow the user to edit either the piece count or `gramsPerPiece` before saving the recipe. Editing the piece count MUST recompute `amount` using the existing `gramsPerPiece`. Editing `gramsPerPiece` MUST recompute `amount` using the existing piece count. The same detachment behavior defined in the `recipes` capability applies if the user edits the mass `amount` directly.

The review UI MUST visually distinguish AI-estimated `gramsPerPiece` values so the user knows the figure is an estimate that they can correct.

#### Scenario: Piece-tracked draft row rendered with both quantities
- **WHEN** the importer returns a draft row with `pieceQuantity = { amount: 1, unitLabel: "onion", gramsPerPiece: 150 }` and `amount: 150`, `unit: "g"`
- **THEN** the review-import screen renders the row as `1 onion (≈ 150 g)` with the gram weight visually marked as an AI estimate

#### Scenario: User adjusts gramsPerPiece before saving
- **WHEN** the user changes `gramsPerPiece` from `150` to `200` on a piece-tracked draft row with `pieceAmount = 1`
- **THEN** the row updates to show `1 onion (≈ 200 g)` and saving the recipe persists `amount = 200` with `pieceQuantity.gramsPerPiece = 200`
