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

1. Persist the resolution to the user-foods overlay (new food validated with curated rules; synonym appended and registered on the live index).
2. Build and return a `MatchedDraftIngredient` for the original fields against the resolved entry, applying the **same post-match rules as AI import matching** (catalog unit wins with `unitOverridden`, piece preservation/drop by unit, untracked inheritance including `displayQuantity` population, note preserved verbatim).

A `new-food` confirm whose entry's folded canonical name or id collides with an existing curated or overlay food SHALL return `409` with a stable error code and persist nothing. The endpoint SHALL require a valid session cookie (`401` otherwise). Confirm MUST NOT require a prior propose call (edited or manual payloads are valid).

#### Scenario: New-food confirm returns a resolved row with original quantities

- **WHEN** the client confirms `{ kind: 'new-food', entry: <Kirschtomaten, unit g, macros> }` with original fields `{ name: "Kirschtomaten", amount: 50, unit: "g" }`
- **THEN** the overlay contains the entry and the response carries a matched draft row `{ matched: true, name: "Kirschtomaten", unit: "g", amount: 50, macrosPerUnit: <per-unit values>, source: 'USER' }`

#### Scenario: Synonym confirm resolves against the curated entry

- **WHEN** the client confirms `{ kind: 'synonym', foodId: 'oliven', synonym: 'grüne Oliven' }` with original fields `{ name: "grüne Oliven", amount: 25, unit: "g", note: "große" }`
- **THEN** the overlay records the synonym, the live FOODS index matches `grüne Oliven`, and the response row adopts the curated entry's unit/macros with `amount: 25` and `note: "große"` preserved

#### Scenario: Untracked entry confirm populates displayQuantity

- **WHEN** the client confirms an untracked entry for original fields carrying `rawDisplayUnitLabel: "Prise"` and no amount
- **THEN** the returned row has `untracked: true`, `amount: 0`, and `displayQuantity: { amount: 1, unitLabel: "Prise" }`, per the existing import matching rules

#### Scenario: Folded-name collision rejected

- **WHEN** the client confirms a new food whose folded canonical name equals an existing curated entry's folded name
- **THEN** the response is `409`, the overlay is unchanged, and the client can fall back to manual matching

### Requirement: Review screen prefetches proposals and resolves per item with show-and-confirm

When the AI-import review screen mounts with at least one unmatched ingredient, the frontend SHALL fire one background `propose-ingredient-resolutions` request for all unmatched items without blocking any interaction. Each unmatched row SHALL expose a resolve affordance that opens a confirm step showing the proposal for that item — all entry values (name, unit, per-100 macros, untracked) editable before confirming. Confirming calls `confirm-ingredient-resolution` and, on success, moves the row out of the unmatched panel into the ingredient list as the returned matched row, with the draft's original amount/unit/note intact. Manual catalog matching lives inside the confirm sheet (per the design handoff) and SHALL be reachable for every item in **every** proposal state — ready, loading, skip, and error — so a hung or failed propose call never blocks manual resolution; rows whose verdict is `skip` or whose proposal errored MUST still open the sheet (showing its fallback actions). A discard (✕) action SHALL remain directly on every unmatched row regardless of proposal state.

#### Scenario: Proposals prefetched on mount

- **WHEN** the review screen mounts with 4 unmatched ingredients
- **THEN** exactly one propose request is fired in the background and the screen remains fully interactive while it is in flight

#### Scenario: Confirm moves the row with values intact

- **WHEN** the user opens the proposal for `Kirschtomaten 50 g`, leaves the values unchanged, and confirms
- **THEN** the unmatched panel no longer lists `Kirschtomaten` and the ingredient list contains a row `Kirschtomaten, 50 g` with the confirmed macros

#### Scenario: User edits a proposal before confirming

- **WHEN** the user changes the proposed calories for `Balsamicoessig` from 88 to 94 per 100 ml and confirms
- **THEN** the overlay entry and the resolved row both carry the edited value

#### Scenario: Proposal failure leaves manual paths intact

- **WHEN** the propose request fails with `502`
- **THEN** the unmatched panel still renders every row with a non-blocking error affordance, each row still opens the sheet's manual catalog search, and discard (✕) stays available on the row

#### Scenario: Skip verdict falls back to manual handling

- **WHEN** an item's proposal verdict is `skip`
- **THEN** that row indicates no AI proposal is available, still opens the sheet (fallback actions: manual catalog search, discard), and can be discarded from the row

#### Scenario: Manual match reachable while proposals load

- **WHEN** the batch propose request is still in flight and the user opens an unmatched item's sheet
- **THEN** the loading state offers a path to manual catalog search without waiting for the proposal

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

A food or synonym confirmed during review SHALL be findable in the same backend process by the import matching cascade and by picker search (per the `user-foods-overlay` capability), so re-importing a recipe with the same ingredient does not produce the same unmatched row again.

#### Scenario: Re-import after resolution matches

- **WHEN** the user confirms `Kirschtomaten` during one import review and then imports another recipe containing `Kirschtomaten`
- **THEN** the second draft carries that ingredient as matched (source `USER`) rather than unmatched
