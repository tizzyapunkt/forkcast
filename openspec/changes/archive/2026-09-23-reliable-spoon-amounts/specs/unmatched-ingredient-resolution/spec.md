## MODIFIED Requirements

### Requirement: Confirm endpoint persists the resolution and returns a matched draft row

The system SHALL expose `POST /confirm-ingredient-resolution` accepting a (possibly user-edited) resolution — either `{ kind: 'new-food', entry }` or `{ kind: 'synonym', foodId, synonym }` — together with the original draft ingredient fields (`name`, `amount`, `unit`, `pieceQuantity?`, `note?`, `rawDisplayAmount?`, `rawDisplayUnitLabel?`, `gramsPerSpoon?`). A `gramsPerSpoon` that is not a positive finite number SHALL be ignored, not rejected. The endpoint SHALL:

1. Persist the resolution to the catalog: a `new-food` entry is validated with the catalog entry rules and appended; a `synonym` is added to the `synonyms` of the catalog entry identified by `foodId`, deduplicated case-insensitively, and is searchable immediately without a separate index-registration step.
2. For a `new-food` entry, derive the persisted `id` from the entry's canonical name rather than trusting a client-supplied id, so an entry renamed in the resolve sheet is keyed by the name it is stored under. A name that yields no valid identifier SHALL be rejected with `422` and persist nothing. The entry's `synonyms` are persisted as submitted, deduplicated case-insensitively against each other and the canonical name.
3. Build and return a `MatchedDraftIngredient` for the original fields against the resolved entry, applying the **same post-match rules as AI import matching**:
   - catalog unit wins with `unitOverridden`
   - piece preservation/drop by unit
   - untracked inheritance, including `displayQuantity` population
   - spoon conversion on tracked entries: fixed volume for an `ml` entry, volume × density for a `g` entry with a `density`, count × `gramsPerSpoon` for a `g` entry without one, when that estimate is plausible (at most 1.5 g per ml of the spoon's volume)
   - note preserved verbatim from the submitted original fields

A `new-food` confirm whose entry's folded canonical name or derived id collides with an existing catalog entry SHALL return `409` with a stable error code and persist nothing. A `synonym` confirm whose `foodId` is absent from the catalog SHALL return `404` and persist nothing. The endpoint SHALL require a valid session cookie (`401` otherwise). Confirm MUST NOT require a prior propose call (edited or manual payloads are valid).

#### Scenario: New-food confirm returns a resolved row with original quantities

- **WHEN** the client confirms `{ kind: 'new-food', entry: <Kirschtomaten, unit g, macros> }` with original fields `{ name: "Kirschtomaten", amount: 50, unit: "g" }`
- **THEN** the catalog contains the entry and the response carries a matched draft row `{ matched: true, name: "Kirschtomaten", unit: "g", amount: 50, macrosPerUnit: <per-unit values>, source: 'CATALOG' }`

#### Scenario: Renamed entry is persisted under a derived id

- **WHEN** the client confirms `{ kind: 'new-food', entry: { id: "duenne-reisnudeln", name: "Reisnudeln", synonyms: ["dünne Reisnudeln"], … } }`
- **THEN** the persisted entry has id `reisnudeln`, name `Reisnudeln`, and retains the synonym `dünne Reisnudeln`

#### Scenario: Synonym confirm resolves against the catalog entry

- **WHEN** the client confirms `{ kind: 'synonym', foodId: 'oliven', synonym: 'grüne Oliven' }` with original fields `{ name: "grüne Oliven", amount: 25, unit: "g", note: "große" }`
- **THEN** the `oliven` catalog entry gains the synonym, a catalog search for `grüne Oliven` matches it, and the response row adopts that entry's unit/macros with `amount: 25` and `note: "große"` preserved

#### Scenario: Untracked entry confirm populates displayQuantity

- **WHEN** the client confirms an untracked entry for original fields carrying `rawDisplayUnitLabel: "Prise"` and no amount
- **THEN** the returned row has `untracked: true`, `amount: 0`, and `displayQuantity: { amount: 1, unitLabel: "Prise" }`, per the existing import matching rules

#### Scenario: New-food confirm converts a spoon with the estimate

- **WHEN** the client confirms `{ kind: 'new-food', entry: <Erdnussmus, unit g, no density, macros> }` with original fields `{ name: "Erdnussmus", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL", gramsPerSpoon: 16 }`
- **THEN** the returned matched row carries `unit: "g"` and `amount: 32`

#### Scenario: Synonym confirm onto an ml entry converts without the estimate

- **WHEN** the client confirms `{ kind: 'synonym', foodId: 'rapsoel', synonym: 'Pflanzenöl' }` with original fields `{ name: "Pflanzenöl", rawDisplayAmount: 1, rawDisplayUnitLabel: "EL", gramsPerSpoon: 13 }` and `rapsoel` has `unit: "ml"`
- **THEN** the returned matched row carries `unit: "ml"` and `amount: 15`

#### Scenario: Invalid or missing spoon estimate

- **WHEN** the client confirms a new `g` entry without density with original fields `{ name: "Erdnussmus", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL" }` and either no `gramsPerSpoon` or `gramsPerSpoon: -1`
- **THEN** the request succeeds and the returned matched row carries no `amount`

#### Scenario: Folded-name collision rejected

- **WHEN** the client confirms a new food whose folded canonical name equals an existing catalog entry's folded name
- **THEN** the response is `409`, the catalog is unchanged, and the client can fall back to manual matching

#### Scenario: Synonym for an unknown food rejected

- **WHEN** the client confirms `{ kind: 'synonym', foodId: 'nicht-vorhanden', synonym: 'egal' }`
- **THEN** the response is `404` and the catalog is unchanged

### Requirement: Review screen prefetches proposals and resolves per item with show-and-confirm

When the AI-import review screen mounts with at least one unmatched ingredient, the frontend SHALL fire one background `propose-ingredient-resolutions` request for all unmatched items without blocking any interaction. Each unmatched row SHALL expose a resolve affordance that opens a confirm step showing the proposal for that item — all entry values (name, synonyms, unit, per-100 macros, untracked) and the resolved row's note editable before confirming, and the proposed verdict itself overridable per the verdict-override requirement. Confirming calls `confirm-ingredient-resolution` with the unmatched row's original fields, including its spoon measure (`rawDisplayAmount`, `rawDisplayUnitLabel`, `gramsPerSpoon`) when present. On success, it moves the row out of the unmatched panel into the ingredient list as the returned matched row, with the draft's original amount/unit/note intact. Manual catalog matching lives inside the confirm sheet (per the design handoff) and SHALL be reachable for every item in **every** proposal state — ready, loading, skip, and error — so a hung or failed propose call never blocks manual resolution; rows whose verdict is `skip` or whose proposal errored MUST still open the sheet (showing its fallback actions). A discard (✕) action SHALL remain directly on every unmatched row regardless of proposal state.

#### Scenario: Proposals prefetched on mount

- **WHEN** the review screen mounts with 4 unmatched ingredients
- **THEN** exactly one propose request is fired in the background and the screen remains fully interactive while it is in flight

#### Scenario: Confirm moves the row with values intact

- **WHEN** the user opens the proposal for `Kirschtomaten 50 g`, leaves the values unchanged, and confirms
- **THEN** the unmatched panel no longer lists `Kirschtomaten` and the ingredient list contains a row `Kirschtomaten, 50 g` with the confirmed macros

#### Scenario: Confirm forwards the spoon measure

- **WHEN** the user confirms a resolution for an unmatched row that carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"` and `gramsPerSpoon: 16`
- **THEN** the confirm request's original fields include those three values

#### Scenario: User edits a proposal before confirming

- **WHEN** the user changes the proposed calories for `Balsamicoessig` from 88 to 94 per 100 ml and confirms
- **THEN** the overlay entry and the resolved row both carry the edited value

#### Scenario: User overrides the verdict before confirming

- **WHEN** the user opens a `synonym-of` proposal and chooses to create an own entry instead
- **THEN** the sheet switches to the new-food editor for the same row without discarding it, and confirming resolves that row from the newly created entry

#### Scenario: Proposal failure leaves manual paths intact

- **WHEN** the propose request fails with `502`
- **THEN** the unmatched panel still renders every row with a non-blocking error affordance, each row still opens the sheet's manual catalog search, and discard (✕) stays available on the row

#### Scenario: Skip verdict falls back to manual handling

- **WHEN** an item's proposal verdict is `skip`
- **THEN** that row indicates no AI proposal is available, still opens the sheet (fallback actions: manual catalog search, discard), and can be discarded from the row

#### Scenario: Manual match reachable while proposals load

- **WHEN** the batch propose request is still in flight and the user opens an unmatched item's sheet
- **THEN** the loading state offers a path to manual catalog search without waiting for the proposal
