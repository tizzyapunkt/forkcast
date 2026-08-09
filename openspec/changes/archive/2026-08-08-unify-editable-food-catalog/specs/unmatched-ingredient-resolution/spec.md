# unmatched-ingredient-resolution — delta

Confirming a resolution now writes to the single catalog instead of the user-foods overlay. The two verdicts survive unchanged in meaning — `new-food` appends a catalog entry, `synonym-of` adds a synonym to an existing catalog entry — but there is no second store, no separate live-index registration step, and the resulting row carries `source: 'CATALOG'`.

## MODIFIED Requirements

### Requirement: Confirm endpoint persists the resolution and returns a matched draft row

The system SHALL expose `POST /confirm-ingredient-resolution` accepting a (possibly user-edited) resolution — either `{ kind: 'new-food', entry }` or `{ kind: 'synonym', foodId, synonym }` — together with the original draft ingredient fields (`name`, `amount`, `unit`, `pieceQuantity?`, `note?`, `rawDisplayAmount?`, `rawDisplayUnitLabel?`). The endpoint SHALL:

1. Persist the resolution to the catalog: a `new-food` entry is validated with the catalog entry rules and appended; a `synonym` is added to the `synonyms` of the catalog entry identified by `foodId`, deduplicated case-insensitively, and is searchable immediately without a separate index-registration step.
2. Build and return a `MatchedDraftIngredient` for the original fields against the resolved entry, applying the **same post-match rules as AI import matching** (catalog unit wins with `unitOverridden`, piece preservation/drop by unit, untracked inheritance including `displayQuantity` population, note preserved verbatim).

A `new-food` confirm whose entry's folded canonical name or id collides with an existing catalog entry SHALL return `409` with a stable error code and persist nothing. A `synonym` confirm whose `foodId` is absent from the catalog SHALL return `404` and persist nothing. The endpoint SHALL require a valid session cookie (`401` otherwise). Confirm MUST NOT require a prior propose call (edited or manual payloads are valid).

#### Scenario: New-food confirm returns a resolved row with original quantities

- **WHEN** the client confirms `{ kind: 'new-food', entry: <Kirschtomaten, unit g, macros> }` with original fields `{ name: "Kirschtomaten", amount: 50, unit: "g" }`
- **THEN** the catalog contains the entry and the response carries a matched draft row `{ matched: true, name: "Kirschtomaten", unit: "g", amount: 50, macrosPerUnit: <per-unit values>, source: 'CATALOG' }`

#### Scenario: Synonym confirm resolves against the catalog entry

- **WHEN** the client confirms `{ kind: 'synonym', foodId: 'oliven', synonym: 'grüne Oliven' }` with original fields `{ name: "grüne Oliven", amount: 25, unit: "g", note: "große" }`
- **THEN** the `oliven` catalog entry gains the synonym, a catalog search for `grüne Oliven` matches it, and the response row adopts that entry's unit/macros with `amount: 25` and `note: "große"` preserved

#### Scenario: Untracked entry confirm populates displayQuantity

- **WHEN** the client confirms an untracked entry for original fields carrying `rawDisplayUnitLabel: "Prise"` and no amount
- **THEN** the returned row has `untracked: true`, `amount: 0`, and `displayQuantity: { amount: 1, unitLabel: "Prise" }`, per the existing import matching rules

#### Scenario: Folded-name collision rejected

- **WHEN** the client confirms a new food whose folded canonical name equals an existing catalog entry's folded name
- **THEN** the response is `409`, the catalog is unchanged, and the client can fall back to manual matching

#### Scenario: Synonym for an unknown food rejected

- **WHEN** the client confirms `{ kind: 'synonym', foodId: 'nicht-vorhanden', synonym: 'egal' }`
- **THEN** the response is `404` and the catalog is unchanged

### Requirement: Resolved foods participate in subsequent searches without restart

A food or synonym confirmed during review SHALL be findable in the same backend process by the import matching cascade and by picker search (per the `food-catalog` capability), so re-importing a recipe with the same ingredient does not produce the same unmatched row again. A confirmed food SHALL also be visible and editable in the catalog manager.

#### Scenario: Re-import after resolution matches

- **WHEN** the user confirms `Kirschtomaten` during one import review and then imports another recipe containing `Kirschtomaten`
- **THEN** the second draft carries that ingredient as matched (source `CATALOG`) rather than unmatched

#### Scenario: Confirmed food is correctable afterwards

- **WHEN** the user confirms a food with an AI-estimated macro value and later opens the catalog manager
- **THEN** that food is listed and its macros, name, and synonyms can be corrected or the entry deleted
