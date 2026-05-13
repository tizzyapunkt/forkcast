## ADDED Requirements

### Requirement: Extractor captures literal display quantity for untracked-eligible rows
The vision model's `extract_recipe` tool schema SHALL accept two additional optional fields on each ingredient that capture the literal textual amount and unit as written in the recipe, for cases where the unit is outside the canonical `MeasurementUnit` enum (`g | ml | oz | cup | tbsp | tsp | piece`):

- `rawDisplayAmount` (number, optional): the literal amount as written, e.g. `1`, `0.5`, `2`. Fractional values permitted.
- `rawDisplayUnitLabel` (string, optional): the literal textual unit as written, e.g. `"TL"`, `"EL"`, `"Prise"`, `"Schuss"`, `"Teelöffel"`, or `"n. Geschmack"` when the recipe uses a qualitative phrase.

The model MUST populate these fields when the recipe states the ingredient using a unit outside the canonical enum (typical for seasonings/spices/herbs). When the recipe states the ingredient using a canonical unit, the model SHOULD omit these fields. When the ingredient has no quantity at all (e.g. "Salz n. Geschmack"), the model MAY populate `rawDisplayUnitLabel` alone with the qualitative phrase and omit `rawDisplayAmount`.

The "never guess" rule on stated amounts continues to apply (see `Missing amount surfaced, never guessed`): the model MUST NOT invent `rawDisplayAmount` or `rawDisplayUnitLabel`. These fields capture only what is literally present in the photos.

#### Scenario: Teaspoon seasoning captured
- **WHEN** the recipe states "1 TL Salz"
- **THEN** the model returns the ingredient with `rawDisplayAmount: 1` and `rawDisplayUnitLabel: "TL"`

#### Scenario: Pinch captured without amount
- **WHEN** the recipe states "eine Prise Pfeffer"
- **THEN** the model returns the ingredient with `rawDisplayAmount: 1` and `rawDisplayUnitLabel: "Prise"` (the model may interpret "eine" as `1` since it is the literal count word)

#### Scenario: Qualitative quantity captured
- **WHEN** the recipe states "Salz n. Geschmack" with no numeric amount
- **THEN** the model returns the ingredient with `rawDisplayUnitLabel: "n. Geschmack"` and no `rawDisplayAmount`, no `amount`, no `unit`

#### Scenario: Canonical unit omits raw display fields
- **WHEN** the recipe states "200 g Mehl"
- **THEN** the model returns the ingredient with `amount: 200, unit: "g"` and no `rawDisplayAmount`, no `rawDisplayUnitLabel`

### Requirement: Importer populates displayQuantity on untracked matches
When the importer constructs a draft ingredient row from the extractor output and the catalog match, the system SHALL populate `displayQuantity` on the draft row when ALL of the following hold:

- The row was matched to a FOODS entry whose `untracked === true` (the matched draft row carries `untracked: true`).
- The extractor returned `rawDisplayUnitLabel` (non-empty after trim) on the source ingredient.

The populated `displayQuantity` MUST be `{ amount: rawDisplayAmount ?? 1, unitLabel: rawDisplayUnitLabel.trim() }`. The `amount` defaults to `1` when the model returned a qualitative phrase without a numeric value (e.g. "Prise" alone).

When the matched FOODS entry is tracked (not untracked), the importer MUST drop `rawDisplayAmount` and `rawDisplayUnitLabel` from the matched draft row — `displayQuantity` is only meaningful on untracked rows per the `recipes` capability. Unmatched rows MUST NOT carry `displayQuantity` regardless of raw display fields (they have no `untracked` flag yet; the user toggles it in the review UI, and may add a `displayQuantity` there).

When the matched-untracked row has no extractor `rawDisplayUnitLabel`, `displayQuantity` MUST be left absent on the draft row. The review UI's "+ Menge ergänzen" affordance lets the user add it later.

The canonical `amount` on the matched-untracked row MUST follow the relaxed rule from the `recipes` capability: when neither the canonical extracted `amount` nor a piece-derived total is available, `amount` MUST be set to `0` so the row is persistable.

#### Scenario: Matched-untracked with TL captured
- **WHEN** the extractor returns `{ name: "Salz", rawDisplayAmount: 1, rawDisplayUnitLabel: "TL" }` and the catalog match is a FOODS entry with `untracked: true` and `unit: "g"`
- **THEN** the draft row carries `name: "Salz", unit: "g", untracked: true, displayQuantity: { amount: 1, unitLabel: "TL" }`

#### Scenario: Matched-untracked with Prise but no amount
- **WHEN** the extractor returns `{ name: "Pfeffer", rawDisplayUnitLabel: "Prise" }` (no `rawDisplayAmount`) and the catalog match is a FOODS entry with `untracked: true`
- **THEN** the draft row carries `untracked: true, displayQuantity: { amount: 1, unitLabel: "Prise" }`

#### Scenario: Matched-tracked drops raw display fields
- **WHEN** the extractor returns `{ name: "Mehl", amount: 200, unit: "g", rawDisplayAmount: 200, rawDisplayUnitLabel: "g" }` and the catalog match is a tracked FOODS entry
- **THEN** the draft row carries `amount: 200, unit: "g", untracked: false (or absent)`, no `displayQuantity`

#### Scenario: Matched-untracked without rawDisplayUnitLabel
- **WHEN** the extractor returns `{ name: "Salz", amount: 5, unit: "g" }` (no raw display fields) and the catalog match is a FOODS entry with `untracked: true`
- **THEN** the draft row carries `untracked: true, amount: 5, unit: "g"`, no `displayQuantity`

#### Scenario: Unmatched row does not carry displayQuantity
- **WHEN** the extractor returns `{ name: "fresh thyme", rawDisplayAmount: 1, rawDisplayUnitLabel: "sprig" }` and the catalog has no match
- **THEN** the draft row is flagged unmatched and carries the extracted `name`, no `displayQuantity`

#### Scenario: Matched-untracked with no extracted amount persists as zero
- **WHEN** the extractor returns `{ name: "Salz", rawDisplayUnitLabel: "n. Geschmack" }` and the catalog match is a FOODS entry with `untracked: true`
- **THEN** the draft row carries `untracked: true, amount: 0, unit: <catalog unit>, displayQuantity: { amount: 1, unitLabel: "n. Geschmack" }`

### Requirement: Review UI carries displayQuantity through to save
The frontend AI-import review screen SHALL preserve any `displayQuantity` returned by the importer on each matched-untracked draft row, render it via the same editor used by the manual recipe form (per the `recipes` capability "Recipe form displayQuantity editor" requirement), and include it in the `add-recipe` payload when the user saves.

When the user toggles a previously-tracked row to untracked in the review UI, the editor MUST expose the `+ Menge ergänzen` affordance so the user can add a `displayQuantity` before saving. When the user toggles a previously-untracked row to tracked, any `displayQuantity` on that row MUST be cleared (so the save payload is valid).

#### Scenario: Imported displayQuantity round-trips on save
- **GIVEN** the importer returned a matched-untracked row with `displayQuantity: { amount: 1, unitLabel: "TL" }`
- **WHEN** the user reviews the draft and saves without further edits
- **THEN** the `add-recipe` payload carries `untracked: true` and `displayQuantity: { amount: 1, unitLabel: "TL" }` on that row, and the persisted recipe reflects the same values

#### Scenario: User adds displayQuantity to imported untracked row
- **GIVEN** the importer returned a matched-untracked row with no `displayQuantity` (extractor saw no amount/unit)
- **WHEN** the user taps `+ Menge ergänzen`, enters `1 EL`, and saves
- **THEN** the `add-recipe` payload carries `displayQuantity: { amount: 1, unitLabel: "EL" }` on that row

#### Scenario: User toggles to untracked then adds displayQuantity
- **GIVEN** an imported tracked row that the user toggles to untracked
- **WHEN** the user taps `+ Menge ergänzen`, enters `1 Prise`, and saves
- **THEN** the row is saved with `untracked: true` and `displayQuantity: { amount: 1, unitLabel: "Prise" }`

#### Scenario: User toggles to tracked clears displayQuantity
- **GIVEN** an imported untracked row carrying `displayQuantity: { amount: 1, unitLabel: "TL" }`
- **WHEN** the user toggles the row to tracked and saves
- **THEN** the `add-recipe` payload carries `untracked: false` (or absent) and no `displayQuantity` on that row
