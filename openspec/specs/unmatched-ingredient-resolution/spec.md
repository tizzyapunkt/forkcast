# unmatched-ingredient-resolution

## Purpose

Resolve unmatched ingredients interactively at AI-import review time (and from any ingredient search panel) by drafting AI proposals — synonym-of, new-food, or skip — and confirming them into the user-foods overlay. A single batch AI call triages all unmatched items; each confirmation persists the resolution and returns a matched draft row, so the resolved food participates in subsequent searches without a backend restart.

## Requirements

### Requirement: Batch proposal endpoint triages and drafts resolutions in one AI call

The system SHALL expose `POST /propose-ingredient-resolutions` accepting `{ items: [{ name, note?, unit?, amount?, pieceQuantity? }] }` (the unmatched draft rows) and returning one proposal per item from a **single** Anthropic call. Each proposal SHALL be exactly one of:

- `{ verdict: 'synonym-of', foodId, synonym, confidence, food }` — the item is an alternate name of an existing catalog food (curated or overlay); `synonym` is the name to learn, `foodId` the existing entry, and `food` an embedded summary of the referenced entry (canonical name, unit, per-100 macros, untracked) so the client can render the confirmation without an extra lookup.
- `{ verdict: 'new-food', entry, confidence }` — `entry` is a complete draft `FoodEntry` (id as kebab-case ASCII key, canonical German name, synonyms, unit `g|ml`, macrosPer100, optional pieces, optional untracked).
- `{ verdict: 'skip', reason }` — ambiguous, garbled, or out-of-scope.

`confidence` SHALL be categorical (`high | medium | low`), matching the existing classifier contract — the system MUST NOT present it as a numeric percentage.

The model prompt MUST include each item's `name` together with its `note` (preparation/quality modifiers change nutrition, e.g. "Tomaten, getrocknet in Öl"), and the top-K (K=8) fuzzy candidates per item from the FOODS and USER sources rather than the full catalog. The endpoint MUST NOT persist anything. Proposals whose drafted entry fails food-entry validation SHALL be degraded to `skip` with a reason, not fail the whole batch.

#### Scenario: Batch returns one proposal per item

- **WHEN** the client posts 4 unmatched items
- **THEN** the response is `200` with exactly 4 proposals in item order, each carrying one of the three verdicts

#### Scenario: Note influences the drafted entry

- **WHEN** an item is `{ name: "Tomaten", note: "getrocknet in Öl" }`
- **THEN** the model receives both name and note, and a `new-food` proposal for that item represents oil-packed dried tomatoes (canonical name reflecting the note), not fresh tomatoes

#### Scenario: Synonym proposal references an existing food

- **WHEN** an item `grüne Oliven` closely matches the existing curated entry `oliven` surfaced in its candidate list
- **THEN** the proposal for that item MAY be `{ verdict: 'synonym-of', foodId: 'oliven', synonym: 'grüne Oliven', confidence: ... }` and MUST NOT be a `new-food` duplicate of the same entry

#### Scenario: Propose persists nothing

- **WHEN** a propose call succeeds
- **THEN** the user-foods overlay and curated index are unchanged

#### Scenario: Invalid drafted entry degrades to skip

- **WHEN** the model returns a `new-food` entry with negative calories for one item
- **THEN** that item's proposal is returned as `skip` with a reason, and the other items' proposals are unaffected

### Requirement: Proposal endpoint mirrors AI-import error and auth semantics

The propose endpoint SHALL require a valid session cookie (`401` otherwise, before any AI call). When `ANTHROPIC_API_KEY` is not configured, it SHALL return `503` with the stable error code `ai-import-not-configured`. Upstream AI errors, timeouts, or unparseable tool output SHALL return `502` with a stable error code and MUST NOT be retried automatically. For each successful call, the system SHALL log model id, item count, input/output token counts, and duration; ingredient names MAY be logged, image data and recipe text MUST NOT appear (none is sent).

#### Scenario: Unconfigured backend

- **WHEN** the backend runs without `ANTHROPIC_API_KEY` and a client calls `POST /propose-ingredient-resolutions`
- **THEN** the response is `503` with `error: "ai-import-not-configured"`

#### Scenario: Upstream failure surfaces as bad gateway

- **WHEN** the Anthropic API returns a 5xx during a propose call
- **THEN** the response is `502` and no retry is made

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

### Requirement: Search panel offers create-with-AI when a query finds no suitable result

The shared ingredient search panel SHALL render a create-with-AI affordance whenever a query of at least 2 characters has produced results (including an empty list), so the user can create the food when nothing returned fits. Triggering it SHALL call `propose-ingredient-resolutions` with a single item `{ name: <query string> }` and present the same editable show-and-confirm step used by the review screen's resolve flow. On confirm (via `confirm-ingredient-resolution`), the confirmed entry SHALL be delivered to the host flow exactly as if it had been selected from the search results — `source: 'USER'` for a new food, or the curated entry (`source: 'FOODS'`) for a synonym verdict — so all picker consumers (recipe-form add, review-screen replace, meal logging) proceed through their normal post-selection steps unchanged. A `skip` verdict or propose failure SHALL surface a non-blocking message and leave the search interaction intact.

#### Scenario: Create from an empty picker search

- **WHEN** the user searches `Balsamicoessig` in the recipe-form picker, gets no suitable result, triggers create-with-AI, and confirms the proposal
- **THEN** the picker continues to its amount step with the confirmed entry, and the overlay contains the new food

#### Scenario: Wrong match swapped to a newly created food

- **WHEN** the user taps a mismatched row's name on the review screen, searches the picker without finding the correct food, and creates it via the affordance
- **THEN** the row is replaced with the confirmed entry per the existing replace rules (amount preserved)

#### Scenario: Synonym verdict from the picker selects the curated entry

- **WHEN** the create-with-AI proposal for the picker query returns a `synonym-of` verdict and the user confirms
- **THEN** the synonym is persisted to the overlay and the curated entry is delivered as the selection with `source: 'FOODS'`

#### Scenario: Skip verdict leaves the search usable

- **WHEN** the create-with-AI proposal returns `skip`
- **THEN** a non-blocking message explains no proposal is available and the user can continue searching or cancel

### Requirement: Resolved foods participate in subsequent searches without restart

A food or synonym confirmed during review SHALL be findable in the same backend process by the import matching cascade and by picker search (per the `food-catalog` capability), so re-importing a recipe with the same ingredient does not produce the same unmatched row again. A confirmed food SHALL also be visible and editable in the catalog manager.

#### Scenario: Re-import after resolution matches

- **WHEN** the user confirms `Kirschtomaten` during one import review and then imports another recipe containing `Kirschtomaten`
- **THEN** the second draft carries that ingredient as matched (source `CATALOG`) rather than unmatched

#### Scenario: Confirmed food is correctable afterwards

- **WHEN** the user confirms a food with an AI-estimated macro value and later opens the catalog manager
- **THEN** that food is listed and its macros, name, and synonyms can be corrected or the entry deleted
