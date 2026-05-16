## MODIFIED Requirements

### Requirement: Ingredient matching against existing catalog
The system SHALL, for each ingredient name extracted from the photos, attempt to match it against the existing ingredient catalog using the existing ingredient search service. When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit`, `macrosPerUnit`, and `untracked` flag, while keeping the model-extracted `amount`. When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no match is found, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), `unit` (if any), `pieceQuantity` (if any), and `note` (if any), without macros and without an `untracked` flag (the user sets it manually in the review UI if needed).

When the model returns piece-quantity fields for an ingredient (see "Resolve piece quantities to gram weights"), the matching pipeline MUST preserve them on the draft row, subject to:
- If the resolved catalog `unit` is `g` or `ml`, `pieceQuantity` is preserved verbatim and the catalog `unit` is used.
- If the resolved catalog `unit` is anything other than `g` or `ml` (e.g. `tbsp`, `piece`), `pieceQuantity` MUST be dropped and the row falls back to the catalog unit's macros, because piece quantities are only meaningful when the row is mass-tracked.
- The `unitOverridden` flag MUST be raised when the model's `unit` differs from the catalog `unit`, regardless of whether `pieceQuantity` is set.

When the extractor returns a `note` field on an ingredient, the matching pipeline MUST preserve it verbatim on the resulting draft row, regardless of match outcome. The note MUST NOT influence matching, normalization, the unmatched recorder, or any post-match flag. The note rides along on both matched and unmatched rows.

#### Scenario: Matched ingredient
- **WHEN** the model extracts an ingredient name "olive oil" and the catalog returns a matching entry with `unit: "ml"` and known macros
- **THEN** the draft row contains the matched name, `unit: "ml"`, the matched `macrosPerUnit`, and the model's extracted `amount`
- **AND** the row is not flagged as unmatched

#### Scenario: Unit override flagged
- **WHEN** the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the draft row uses `unit: "g"` (catalog wins), keeps `amount: 2`, and is flagged `unitOverridden: true`

#### Scenario: Unmatched ingredient
- **WHEN** the model extracts an ingredient name that has no match in the catalog
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
- **WHEN** the model extracts `{ name: "Yuzu-Schale", amount: 2, unit: "g", note: "fein abgerieben" }` and the catalog has no match for `Yuzu-Schale`
- **THEN** the unmatched draft row contains `note: "fein abgerieben"` alongside the extracted name, amount, and unit

#### Scenario: Note absent when extractor omits it
- **WHEN** the model extracts an ingredient with no `note` field on it
- **THEN** the resulting draft row has no `note` field, regardless of match outcome

### Requirement: Ingredient `name` field carries the food noun only

The extractor's `extract_recipe` tool schema and system prompt SHALL require that the `name` field on every extracted ingredient contains only the food noun, without preparation, cut, or quality modifiers (e.g. "fein gehackt", "geschält", "in Scheiben", "frisch gewolft"). When the source recipe writes such modifiers inline with the ingredient name, the model MUST move the prep instruction into the ingredient's `note` field (see "Extractor captures preparation modifier in ingredient note") and leave `name` clean.

Leading adjectives that change the food itself — i.e. that change the nutrition profile or identity, such as "Zuckerfreier Ahornsirup", "Geräucherter Lachs", "Gemahlener Zimt" — SHALL be preserved on `name` and SHALL NOT be moved to `note`.

Prep modifiers MUST NOT be duplicated into `steps`. When the source recipe states the prep only inline on the ingredient line (e.g. `"1 TL Ingwer, fein gehackt"`), the `note` field on the ingredient row is the canonical home for that information; `steps` SHALL describe the cooking process and SHALL NOT carry standalone freestanding prep instructions that already live on the ingredient row.

#### Scenario: Inline prep modifier moved to ingredient note

- **WHEN** the source recipe states an ingredient line `"1 TL Ingwer, fein gehackt"` followed by a single step `"Alles vermischen und 5 min köcheln"`
- **THEN** the model returns the ingredient with `name: "Ingwer"` (no comma-suffix) and `note: "fein gehackt"`, and the returned `steps` are the cooking steps from the source recipe (no synthesised standalone prep step)

#### Scenario: Leading qualifier preserved

- **WHEN** the source recipe states `"100 ml Zuckerfreier Ahornsirup"`
- **THEN** the model returns the ingredient with `name: "Zuckerfreier Ahornsirup"` unchanged — the leading qualifier is part of the food identity — and no `note` is produced for that row unless an additional prep modifier was present

#### Scenario: No prep modifier produces no note

- **WHEN** the source recipe states `"200 g Mehl"` with no inline modifier
- **THEN** the model returns the ingredient with `name: "Mehl"` and no `note` field on that row

## ADDED Requirements

### Requirement: Extractor captures preparation modifier in ingredient note

The `extract_recipe` tool schema SHALL include an optional `note` field on each ingredient (a string). The system prompt SHALL instruct the model to populate `note` with the preparation, cut, or quality modifier that was bundled inline with the ingredient name in the source recipe (e.g. `"fein gehackt"`, `"geschält"`, `"in Scheiben"`, `"frisch gewolft"`) and to keep `name` to the food noun only.

The parser SHALL trim the value. Empty strings (after trim) MUST be dropped (treated as absent on the resulting `RawIngredient`). Values whose trimmed length exceeds 80 characters MUST be dropped (treated as absent) — overlong notes are likely a misuse of the field by the model, and dropping them never fails the whole import.

When the extractor returns no inline prep modifier for an ingredient, the `note` field MUST be absent on the resulting `RawIngredient`. The extractor MUST NOT invent prep notes that are not present in the source recipe.

The `note` value MUST be in the original language of the source recipe (consistent with the `name` and `steps` fields).

#### Scenario: Note populated from inline prep modifier

- **WHEN** the source recipe contains the line `"1 EL Olivenöl"` followed by `"2 Knoblauchzehen, fein gehackt"`
- **THEN** the extractor returns the second ingredient with `name: "Knoblauchzehen"` and `note: "fein gehackt"`

#### Scenario: Empty extracted note dropped

- **WHEN** the model returns an ingredient with `note: ""` or `note: "   "`
- **THEN** the parser produces a `RawIngredient` with no `note` field

#### Scenario: Overlong extracted note dropped

- **WHEN** the model returns an ingredient with a `note` whose trimmed length exceeds 80 characters
- **THEN** the parser produces a `RawIngredient` with no `note` field, and the rest of the ingredient (name, amount, unit, etc.) is preserved

#### Scenario: Note trimmed on extraction

- **WHEN** the model returns an ingredient with `note: "  in Scheiben  "` (surrounding whitespace)
- **THEN** the parser produces a `RawIngredient` with `note: "in Scheiben"` (trimmed)

#### Scenario: Note absent when source has no prep modifier

- **WHEN** the source recipe states `"500 g Hähnchenbrustfilet"` with no inline modifier
- **THEN** the model returns the ingredient with `name: "Hähnchenbrustfilet"` and no `note` field

### Requirement: Review import screen surfaces ingredient note

The review-import screen SHALL display the `note` from each draft ingredient row, when present, as a subtitle beneath the ingredient name. The note SHALL be visible on both matched and unmatched rows. The review screen MUST carry the note through to the eventual save payload (the `add-recipe` call that persists the reviewed draft) without modification.

When the user replaces an ingredient via the picker on the review screen, the note from the previous row MUST NOT be carried over onto the replacement row by default — a different food typically means different prep, and the user can re-enter the note explicitly if it still applies.

#### Scenario: Matched row note rendered on review

- **WHEN** the review screen renders a draft with a matched ingredient `{ name: "Ingwer", note: "fein gehackt", ... }`
- **THEN** the screen shows `"Ingwer"` on the primary line and `"fein gehackt"` as a subtitle on that row

#### Scenario: Unmatched row note rendered on review

- **WHEN** the review screen renders a draft with an unmatched ingredient `{ name: "Yuzu-Schale", note: "fein abgerieben", ... }`
- **THEN** the screen shows `"Yuzu-Schale"` on the primary line, surfaces the row as unmatched, and shows `"fein abgerieben"` as a subtitle

#### Scenario: Note carried through save

- **WHEN** the user reviews a draft with an ingredient that has `note: "in Scheiben"` and saves the recipe without altering the note
- **THEN** the `add-recipe` payload sent to the backend carries that ingredient row with `note: "in Scheiben"`

#### Scenario: Replacing an ingredient clears the note
- **WHEN** the user invokes the picker on a draft row that has a `note` and selects a different ingredient as the replacement
- **THEN** the resulting draft row carries the replacement ingredient with no `note` field, regardless of what the previous row had
