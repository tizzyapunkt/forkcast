## ADDED Requirements

### Requirement: Optional debug payload on the import response

When the backend is configured to emit debug information (env var `RECIPE_IMPORT_DEBUG=true` at startup; the variable accepts only the literal strings `true` or `false`, case-insensitive, and defaults to `false`), the import endpoint SHALL return an additional `debug` object on the recipe draft response. The `debug` object MUST contain a per-ingredient breakdown that lets a developer diagnose ingredient-matching mismatches without re-running the import.

For each ingredient extracted by the vision model, the `debug.ingredients` entry MUST include:
- `raw`: the ingredient as returned by the model, verbatim (name, amount, unit, piece-quantity fields, raw display fields if present), before any matching.
- `candidates`: the top N candidates returned by `IngredientSearchService.searchByName` for the raw name, in rank order. The cap N is fixed at 5. Each candidate exposes `name`, `source` (`FOODS` or `OFF`), `unit`, and `untracked`.
- `chosen`: the candidate picked as the match, or `null` when no match was found. `chosen` MUST be reference-equal in content to the corresponding entry in `candidates` (typically the first), or `null`.
- `flags`: a flat object with the post-match flags that fired on this row: `unitOverridden`, `pieceQuantityDropped`, `untrackedInherited` (booleans).

When `RECIPE_IMPORT_DEBUG` is not configured, the `debug` field MUST be absent from the response entirely (not `null`, not an empty object), so existing clients are unaffected.

The `debug` payload MUST NOT be persisted anywhere. It exists only on the request-scoped response.

#### Scenario: Debug field omitted by default
- **WHEN** the backend starts without `RECIPE_IMPORT_DEBUG` set and a client calls `POST /import-recipe-from-photos` with a valid image
- **THEN** the response is `200` with the existing draft shape
- **AND** the response body has no `debug` property

#### Scenario: Debug field present when enabled
- **WHEN** the backend starts with `RECIPE_IMPORT_DEBUG=1` and a client calls `POST /import-recipe-from-photos` with a valid image whose extraction yields two ingredients
- **THEN** the response is `200` with a `debug.ingredients` array of length 2
- **AND** each entry contains `raw`, `candidates`, `chosen`, and `flags`

#### Scenario: Matched row carries chosen and unit-override flag
- **WHEN** debug is enabled and the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the debug entry for that ingredient has a non-null `chosen` with `unit: "g"`
- **AND** `flags.unitOverridden` is `true`
- **AND** `flags.pieceQuantityDropped` is `false`
- **AND** `flags.untrackedInherited` is `false`
- **AND** `candidates[0]` matches the `chosen` candidate

#### Scenario: Unmatched row carries null chosen
- **WHEN** debug is enabled and the model extracts an ingredient name that has no match in the catalog
- **THEN** the debug entry has `chosen: null`
- **AND** `candidates` is an empty array
- **AND** all `flags` are `false`

#### Scenario: Piece-quantity drop is flagged
- **WHEN** debug is enabled and the model extracts `{ name: "Knoblauch", amount: 6, unit: "g", pieceAmount: 2, pieceUnitLabel: "Zehe", gramsPerPiece: 3 }` and the catalog match has `unit: "tbsp"`
- **THEN** the debug entry's `flags.pieceQuantityDropped` is `true`
- **AND** `flags.unitOverridden` is `true`

#### Scenario: Untracked inheritance is flagged
- **WHEN** debug is enabled and the model extracts `{ name: "salt", amount: 5, unit: "g" }` and the catalog match has `unit: "g"` and `untracked: true`
- **THEN** the debug entry's `flags.untrackedInherited` is `true`

#### Scenario: Candidate cap
- **WHEN** debug is enabled and the search service returns more than 5 candidates for a raw ingredient name
- **THEN** the debug entry's `candidates` array has length exactly 5, in the original rank order

### Requirement: Debug box on the import review screen

The "Add Recipe from Photo" review screen SHALL render a collapsible "Debug" box at the bottom of the screen when, and only when, the import response includes a `debug` field. The box MUST be collapsed by default; expanding it reveals one block per ingredient showing:

- the raw extracted name (and amount/unit/piece fields if present),
- the chosen match's name, source, and unit (or an explicit "unmatched" indicator if `chosen` is null),
- the list of top candidates in rank order with name, source, and unit,
- the flags that fired (`unitOverridden`, `pieceQuantityDropped`, `untrackedInherited`) when true.

The box MUST NOT render at all when `draft.debug` is undefined. The box's labels MAY remain in English (this is a developer tool, not user-facing copy).

#### Scenario: Box hidden when debug field absent
- **WHEN** the review screen receives a draft whose response has no `debug` field
- **THEN** no element with the debug box role/test-id is in the rendered output

#### Scenario: Box visible when debug field present
- **WHEN** the review screen receives a draft whose response has a `debug` field with at least one ingredient entry
- **THEN** the debug box is rendered, collapsed by default, with a toggle to expand it

#### Scenario: Expanded box shows raw, chosen, candidates, and flags
- **WHEN** the user expands the debug box on a draft whose `debug.ingredients[0]` has `raw.name = "tomato paste"`, `chosen.name = "Tomatenmark"`, three candidates, and `flags.unitOverridden = true`
- **THEN** the rendered block contains the raw name, the chosen name, all three candidate names in order, and a visible `unitOverridden` indicator
