## ADDED Requirements

### Requirement: The resolve sheet allows overriding the AI verdict in both directions

The resolve sheet SHALL let the user reject the proposed verdict and switch to the other one, without leaving the sheet and without first accepting the wrong resolution.

From a `synonym-of` proposal, the sheet SHALL offer an action to create an own catalog entry for the raw name instead. Triggering it SHALL request a fresh AI draft for the raw ingredient name (the catalog's existing draft-entry endpoint) and present the result in the editable new-food editor, marked as AI-estimated. While that request is in flight the sheet SHALL show a loading state and remain cancellable; if it fails or returns nothing usable, the sheet SHALL fall back to an empty editable new-food editor seeded with the raw name so the user can still proceed. No synonym SHALL be persisted on this path.

From a `new-food` proposal, the sheet SHALL offer an action to assign the item to an existing catalog entry instead, leading into the sheet's catalog search. Confirming a picked entry SHALL persist the raw name as a synonym of that entry (per the manual-pick requirement) and MUST NOT create a new entry.

Both override actions SHALL be reachable without discarding the row, and cancelling an override SHALL return to the original proposal with any edits made to it intact.

#### Scenario: Synonym rejected in favour of an own entry

- **WHEN** the proposal for `Limettensaft` is `synonym-of` `Limette` and the user triggers "create own entry instead"
- **THEN** a fresh AI draft is requested for `Limettensaft`, the editable new-food editor opens with it, and confirming creates a `Limettensaft` entry while `Limette` gains no synonym

#### Scenario: Fresh draft request fails

- **WHEN** the user rejects a synonym proposal and the draft request returns an error
- **THEN** the sheet shows an editable new-food editor seeded with the raw name and no macros rather than a dead end, and the user can confirm it or fall back to catalog search

#### Scenario: New-food rejected in favour of an existing entry

- **WHEN** the proposal for `Reisbandnudeln` is `new-food` and the user triggers "assign to existing entry" and picks the existing `Reisnudeln`
- **THEN** no new entry is created, `Reisnudeln` gains `Reisbandnudeln` as a synonym, and the row is resolved against `Reisnudeln`

#### Scenario: Cancelling an override keeps prior edits

- **WHEN** the user edits the proposed macros, opens an override action, and then goes back
- **THEN** the original proposal is shown again with the edited macros still in place

### Requirement: Renaming a proposed new food re-keys the entry and preserves the dropped qualifier

A new-food draft's canonical name is editable, and the user renaming it SHALL be treated as a deliberate change of what is stored in the catalog, not as a text edit only:

1. The confirmed entry's `id` SHALL be derived from the canonical name it is saved under. The confirm endpoint SHALL derive it server-side and ignore any client-supplied id, so a renamed draft can never be keyed against a stale slug. A name with no sluggable characters SHALL be rejected with `422` and persist nothing.
2. The originally proposed canonical name SHALL be retained in the confirmed entry's `synonyms` (deduplicated case-insensitively against the name and the other synonyms), so the recipe's original wording auto-matches on re-import.
3. The draft's `synonyms` SHALL be editable in the sheet, so the user can drop a retained alias that is not one.
4. Where the rename dropped qualifier words present in the raw ingredient name, those words SHALL be offered as the resolved recipe row's note when the row has no note yet. The note is editable and clearable in the sheet, applies to the recipe row only, and MUST NOT become part of the catalog entry.

#### Scenario: Renamed draft is keyed by its new name

- **WHEN** the proposal is a `new-food` entry `dünne Reisnudeln` (id `duenne-reisnudeln`) and the user renames it to `Reisnudeln` and confirms
- **THEN** the catalog holds one entry named `Reisnudeln` with id `reisnudeln`, and no entry with id `duenne-reisnudeln` exists

#### Scenario: Original wording retained as a synonym

- **WHEN** the user renames the `dünne Reisnudeln` draft to `Reisnudeln` and confirms without touching the synonym list
- **THEN** the confirmed entry carries `dünne Reisnudeln` among its synonyms, and a later import of a recipe listing `dünne Reisnudeln` matches that entry instead of producing an unmatched row

#### Scenario: Dropped qualifier offered as the row note

- **WHEN** the raw ingredient is `dünne Reisnudeln, 200 g` with no note and the user renames the draft to `Reisnudeln`
- **THEN** the sheet pre-fills the row's note with `dünne`, and confirming yields a recipe row `Reisnudeln, 200 g` with note `dünne` while the catalog entry carries no note

#### Scenario: Existing note is not overwritten

- **WHEN** the raw ingredient already carries the note `eingeweicht` and the user renames the draft
- **THEN** the note stays `eingeweicht` and the dropped qualifier is not prepended to it automatically

#### Scenario: Unsluggable name rejected

- **WHEN** a confirm arrives with a `new-food` entry whose name contains no alphanumeric characters
- **THEN** the response is `422`, the catalog is unchanged, and the sheet keeps the draft open for correction

### Requirement: A manual catalog pick teaches the raw name as a synonym

When the user resolves an item by picking an existing entry from the sheet's catalog search, the sheet SHALL learn the raw ingredient name as a synonym of the picked entry. The catalog search SHALL present this as a toggle, enabled by default, which the user MAY disable before picking; with it disabled the pick SHALL resolve the row without writing to the catalog, as it does today. A pick that cannot teach anything SHALL resolve the row and write nothing regardless of the toggle: a result that is not a catalog entry (no catalog id to attach an alias to), or a raw name that already folds to the entry's name. A synonym the entry already carries SHALL be a no-op on the catalog. A failed synonym write MUST NOT block the resolution — the row still resolves against the picked food, only the alias is lost.

The learned synonym string SHALL also be editable on a `synonym-of` proposal, so the user can accept the proposed target entry while correcting the alias that is stored.

#### Scenario: Manual pick persists the raw name

- **WHEN** the user picks the catalog entry `Reisnudeln` for the unmatched raw name `Reisbandnudeln` and leaves the toggle on
- **THEN** `Reisnudeln` gains the synonym `Reisbandnudeln`, and re-importing a recipe listing `Reisbandnudeln` matches it without a resolve step

#### Scenario: User declines the synonym

- **WHEN** the user picks `Reisnudeln` for the raw name `Nudeln vom Vortag` and switches the toggle off
- **THEN** the row resolves against `Reisnudeln` and the catalog is unchanged

#### Scenario: Redundant pick writes nothing

- **WHEN** the raw name folds to the same string as the picked entry's name
- **THEN** the row resolves against that entry and no write is made

#### Scenario: Non-catalog result writes nothing

- **WHEN** the user picks an Open Food Facts or scanned result rather than a catalog entry
- **THEN** the row resolves against it and no synonym is written

#### Scenario: Failed write still resolves the row

- **WHEN** the synonym write fails
- **THEN** the row still resolves against the picked food and the import continues

#### Scenario: Proposed synonym string edited before confirming

- **WHEN** the proposal is `synonym-of` `Oliven` with synonym `grüne Oliven, entsteint` and the user shortens it to `grüne Oliven` before confirming
- **THEN** `Oliven` gains exactly `grüne Oliven` as a synonym

## MODIFIED Requirements

### Requirement: Confirm endpoint persists the resolution and returns a matched draft row

The system SHALL expose `POST /confirm-ingredient-resolution` accepting a (possibly user-edited) resolution — either `{ kind: 'new-food', entry }` or `{ kind: 'synonym', foodId, synonym }` — together with the original draft ingredient fields (`name`, `amount`, `unit`, `pieceQuantity?`, `note?`, `rawDisplayAmount?`, `rawDisplayUnitLabel?`). The endpoint SHALL:

1. Persist the resolution to the catalog: a `new-food` entry is validated with the catalog entry rules and appended; a `synonym` is added to the `synonyms` of the catalog entry identified by `foodId`, deduplicated case-insensitively, and is searchable immediately without a separate index-registration step.
2. For a `new-food` entry, derive the persisted `id` from the entry's canonical name rather than trusting a client-supplied id, so an entry renamed in the resolve sheet is keyed by the name it is stored under. A name that yields no valid identifier SHALL be rejected with `422` and persist nothing. The entry's `synonyms` are persisted as submitted, deduplicated case-insensitively against each other and the canonical name.
3. Build and return a `MatchedDraftIngredient` for the original fields against the resolved entry, applying the **same post-match rules as AI import matching** (catalog unit wins with `unitOverridden`, piece preservation/drop by unit, untracked inheritance including `displayQuantity` population, note preserved verbatim from the submitted original fields).

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

#### Scenario: Folded-name collision rejected

- **WHEN** the client confirms a new food whose folded canonical name equals an existing catalog entry's folded name
- **THEN** the response is `409`, the catalog is unchanged, and the client can fall back to manual matching

#### Scenario: Synonym for an unknown food rejected

- **WHEN** the client confirms `{ kind: 'synonym', foodId: 'nicht-vorhanden', synonym: 'egal' }`
- **THEN** the response is `404` and the catalog is unchanged

### Requirement: Review screen prefetches proposals and resolves per item with show-and-confirm

When the AI-import review screen mounts with at least one unmatched ingredient, the frontend SHALL fire one background `propose-ingredient-resolutions` request for all unmatched items without blocking any interaction. Each unmatched row SHALL expose a resolve affordance that opens a confirm step showing the proposal for that item — all entry values (name, synonyms, unit, per-100 macros, untracked) and the resolved row's note editable before confirming, and the proposed verdict itself overridable per the verdict-override requirement. Confirming calls `confirm-ingredient-resolution` and, on success, moves the row out of the unmatched panel into the ingredient list as the returned matched row, with the draft's original amount/unit/note intact. Manual catalog matching lives inside the confirm sheet (per the design handoff) and SHALL be reachable for every item in **every** proposal state — ready, loading, skip, and error — so a hung or failed propose call never blocks manual resolution; rows whose verdict is `skip` or whose proposal errored MUST still open the sheet (showing its fallback actions). A discard (✕) action SHALL remain directly on every unmatched row regardless of proposal state.

#### Scenario: Proposals prefetched on mount

- **WHEN** the review screen mounts with 4 unmatched ingredients
- **THEN** exactly one propose request is fired in the background and the screen remains fully interactive while it is in flight

#### Scenario: Confirm moves the row with values intact

- **WHEN** the user opens the proposal for `Kirschtomaten 50 g`, leaves the values unchanged, and confirms
- **THEN** the unmatched panel no longer lists `Kirschtomaten` and the ingredient list contains a row `Kirschtomaten, 50 g` with the confirmed macros

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
