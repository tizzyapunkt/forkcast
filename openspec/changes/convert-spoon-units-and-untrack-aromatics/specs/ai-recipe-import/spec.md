# ai-recipe-import — delta

## ADDED Requirements

### Requirement: Importer converts spoon measures on tracked matches

When the importer constructs a draft ingredient row from the extractor output and the catalog match, and ALL of the following hold:

- The row was matched to a FOODS/USER/SCAN entry that is tracked (`untracked` is not `true`).
- The row has no canonical `amount` (the extractor stated none) and no piece-derived total.
- The extractor returned a `rawDisplayUnitLabel` whose normalized form (lowercased, trimmed) is a known spoon/volume measure: `tl`/`teelöffel`/`teeloeffel`/`tsp`/`teaspoon` (5 ml), `el`/`esslöffel`/`essloeffel`/`tbsp`/`tablespoon` (15 ml), or `tasse`/`cup` (240 ml).

then the system SHALL convert the spoon measure to the matched food's `unit` and set the canonical `amount`:

- volume in ml = `(rawDisplayAmount ?? 1) × mlPerSpoon`.
- If the matched `unit` is `ml`: `amount` = that volume.
- If the matched `unit` is `g`: `amount` = `volume × density` **only when the matched food carries a `density`**; when it has no `density`, no conversion is performed and the row is left with no `amount` (surfaced via the existing `missingAmount` flag) — the importer MUST NOT guess.

A converted tracked row MUST NOT carry a `displayQuantity` (that field is reserved for untracked rows). The raw-display fields are consumed by the conversion and not persisted on the row.

This conversion applies ONLY to the raw-display path. A spoon-like value carried on the canonical `unit` field (`tbsp`/`tsp`/`cup`/`oz`) keeps the existing "catalog unit wins, `unitOverridden`" behavior and is NOT converted here.

#### Scenario: Tablespoon of a g-unit staple with density converts

- **WHEN** the extractor returns `{ name: "Speisestärke", rawDisplayAmount: 2, rawDisplayUnitLabel: "TL" }` and the catalog match is a tracked FOODS entry with `unit: "g"` and `density: 0.55`
- **THEN** the draft row carries `unit: "g"`, `amount ≈ 5.5` (`2 × 5 ml × 0.55`), `untracked` absent/false, and no `displayQuantity`

#### Scenario: Tablespoon of an ml-unit food converts without density

- **WHEN** the extractor returns `{ name: "Sojasauce", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL" }` and the catalog match is a tracked FOODS entry with `unit: "ml"`
- **THEN** the draft row carries `unit: "ml"`, `amount: 30` (`2 × 15 ml`), and no `displayQuantity`

#### Scenario: Spoon of a g-unit food without density is not guessed

- **WHEN** the extractor returns `{ name: "Petersilie", rawDisplayAmount: 1, rawDisplayUnitLabel: "EL" }` and the catalog match is a tracked FOODS entry with `unit: "g"` and no `density`
- **THEN** the draft row carries no `amount`, no `displayQuantity`, and the row is flagged `missingAmount`

#### Scenario: Non-spoon raw-display label is not converted

- **WHEN** the extractor returns `{ name: "Speisestärke", rawDisplayAmount: 1, rawDisplayUnitLabel: "Prise" }` and the catalog match is a tracked FOODS entry with `unit: "g"` and `density: 0.55`
- **THEN** no conversion is attempted; the draft row carries no `amount` and is flagged `missingAmount`

#### Scenario: Stated canonical amount wins over conversion

- **WHEN** the extractor returns `{ name: "Speisestärke", amount: 12, unit: "g", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL" }` and the catalog match is a tracked FOODS entry with `unit: "g"` and `density: 0.55`
- **THEN** the draft row carries `amount: 12` (the stated canonical amount is kept; no conversion overrides it)

## MODIFIED Requirements

### Requirement: Importer populates displayQuantity on untracked matches
When the importer constructs a draft ingredient row from the extractor output and the catalog match, the system SHALL populate `displayQuantity` on the draft row when ALL of the following hold:

- The row was matched to a FOODS entry whose `untracked === true` (the matched draft row carries `untracked: true`).
- The extractor returned `rawDisplayUnitLabel` (non-empty after trim) on the source ingredient.

The populated `displayQuantity` MUST be `{ amount: rawDisplayAmount ?? 1, unitLabel: rawDisplayUnitLabel.trim() }`. The `amount` defaults to `1` when the model returned a qualitative phrase without a numeric value (e.g. "Prise" alone).

When the matched FOODS entry is tracked (not untracked), the importer MUST first attempt spoon-volume conversion per the "Importer converts spoon measures on tracked matches" requirement, and then drop `rawDisplayAmount` and `rawDisplayUnitLabel` from the matched draft row — `displayQuantity` is only meaningful on untracked rows per the `recipes` capability, so a tracked row never carries it whether or not the conversion succeeded. Unmatched rows MUST NOT carry `displayQuantity` regardless of raw display fields (they have no `untracked` flag yet; the user toggles it in the review UI, and may add a `displayQuantity` there).

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
