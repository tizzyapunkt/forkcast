# ai-recipe-import — delta

The per-ingredient match record stops being a gated developer aid and becomes user-facing provenance: always returned, renamed, and rendered inline on the review screen where the correction is actually made. The collapsed monospace debug box is removed in favour of a raw-line subtitle per row, an uncertainty marker, and candidate-first replacement.

## ADDED Requirements

### Requirement: Match provenance is returned on every import response

The import endpoint SHALL return a `provenance` object on every successful recipe-draft response, with no configuration gating. `provenance.ingredients` SHALL be a parallel array to the draft's `ingredients`: entry *i* describes how draft ingredient *i* was matched, in extraction order, so a client can correlate a row to its provenance by position without name matching.

For each extracted ingredient, the entry MUST include:

- `raw`: the ingredient exactly as returned by the vision model before any matching (name, amount, unit, piece-quantity fields, raw display fields when present, note when present).
- `candidates`: the top candidates returned by the winning cascade tier for the raw name, in rank order, capped at 5. Each candidate exposes `name`, `source`, `unit`, and `untracked`.
- `chosen`: the candidate picked as the match, or `null` when no tier matched.
- `flags`: a flat object of the post-match flags that fired on this row (`unitOverridden`, `pieceQuantityDropped`, `untrackedInherited`, `missingAmount`).

The provenance payload MUST NOT be persisted anywhere; it exists only on the request-scoped response and MUST NOT appear on a saved recipe.

#### Scenario: Provenance present without configuration

- **WHEN** a client calls `POST /import-recipe-from-photos` with a valid image whose extraction yields two ingredients, with no import-debug environment variable set
- **THEN** the response is `200` with a `provenance.ingredients` array of length 2, each entry containing `raw`, `candidates`, `chosen`, and `flags`

#### Scenario: Provenance is positionally parallel to the draft ingredients

- **WHEN** an import yields a draft whose second ingredient is unmatched and whose third is matched
- **THEN** `provenance.ingredients[1].chosen` is `null` and `provenance.ingredients[2].chosen` describes the match for draft ingredient index 2

#### Scenario: Matched row carries chosen and the unit-override flag

- **WHEN** the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** that provenance entry has a non-null `chosen` with `unit: "g"`, `flags.unitOverridden` is `true`, `flags.pieceQuantityDropped` is `false`, and `candidates[0]` matches `chosen`

#### Scenario: Unmatched row carries null chosen

- **WHEN** the model extracts an ingredient name that no cascade tier matches
- **THEN** that provenance entry has `chosen: null`, an empty `candidates` array, and all `flags` false

#### Scenario: Candidate cap

- **WHEN** the winning tier returns more than 5 candidates for a raw ingredient name
- **THEN** that entry's `candidates` array has length exactly 5, in the original rank order

#### Scenario: Provenance is not persisted

- **WHEN** the user saves a reviewed draft
- **THEN** the stored recipe carries no provenance data

### Requirement: Review screen shows the raw extracted line on each imported row

The import review screen SHALL display, beneath each ingredient row that came from the import, the raw text the model read for that row — the extracted name together with its extracted amount and unit when present — visually subordinate to the matched name. This makes a mismatch between what the photo said and what the row now claims visible without opening a source photo.

Rows the user adds manually after import SHALL NOT show a raw line, and replacing a row's ingredient SHALL leave the raw line unchanged, because it records what was read, not what was chosen.

#### Scenario: Raw line rendered under the matched name

- **WHEN** the model read `2 EL Tomatenmark` and the matcher chose the catalog entry `Tomatenmark`
- **THEN** that row shows `Tomatenmark` with the raw extracted line beneath it

#### Scenario: Mismatch is visible without the photo

- **WHEN** the model read `Kirschtomaten` and the matcher chose `Tomatenmark`
- **THEN** the row shows `Tomatenmark` with `Kirschtomaten` as its raw line, so the two can be compared in place

#### Scenario: Manually added row has no raw line

- **WHEN** the user adds an ingredient through the picker after the draft loaded
- **THEN** that row shows no raw extracted line

#### Scenario: Raw line survives a replacement

- **WHEN** the user replaces a row's ingredient with a different catalog entry
- **THEN** the row's raw extracted line is unchanged and still shows what the model read

### Requirement: Replacing an imported ingredient offers the ranked candidates first

When the user opens the replace flow on an imported row, the picker SHALL present that row's provenance `candidates` as directly selectable options, in rank order, above the search input, each labelled with its name and source. Selecting a candidate SHALL apply it to the row exactly as a search result would, and SHALL close the picker. The search input SHALL remain available for anything not among the candidates. When the row has no candidates, the picker SHALL open on search as it does today, with no empty candidate section.

#### Scenario: Candidates offered without typing

- **WHEN** the user opens the replace flow on a row whose provenance carries three candidates
- **THEN** all three are listed in rank order above the search input, before any query is typed

#### Scenario: Selecting a candidate replaces the row

- **WHEN** the user taps the second candidate
- **THEN** the row adopts that ingredient's name, unit, and macros — keeping the row's existing amount, per the existing replace rules — and the picker closes

#### Scenario: Search still available

- **WHEN** the user ignores the candidates and types a query
- **THEN** search results are returned and selecting one replaces the row as before

#### Scenario: No candidate section when there are none

- **WHEN** the user opens the replace flow on a row whose provenance has an empty `candidates` array
- **THEN** the picker shows the search input with no empty candidate section

#### Scenario: Manually added rows are unaffected

- **WHEN** the user opens the replace flow on a row they added manually
- **THEN** the picker shows the search input with no candidate section

### Requirement: Rows with uncertain matches are marked

The review screen SHALL render a quiet inline marker on any imported row whose provenance indicates the match warrants a look: any of `flags.unitOverridden`, `flags.pieceQuantityDropped`, `flags.untrackedInherited`, or `flags.missingAmount` is true, or `chosen` is non-null while `candidates` held more than one option. The marker SHALL state which condition applies in German and MUST NOT block saving or require dismissal.

#### Scenario: Unit override marked

- **WHEN** a row's provenance has `flags.unitOverridden` true
- **THEN** that row shows a marker explaining the extracted unit was replaced by the catalog unit

#### Scenario: Ambiguous match marked

- **WHEN** a row matched while its tier returned four candidates
- **THEN** that row shows a marker indicating alternatives exist

#### Scenario: Confident match unmarked

- **WHEN** a row matched as the only candidate with no flags set
- **THEN** that row shows no marker

#### Scenario: Marker never blocks saving

- **WHEN** several rows carry markers and the user submits the form
- **THEN** the recipe saves without requiring the markers to be dismissed

## REMOVED Requirements

### Requirement: Optional debug payload on the import response

**Reason**: The payload is no longer optional and no longer a debug aid. It is the data the review screen needs to show what the AI read and what else it considered, so gating it behind `RECIPE_IMPORT_DEBUG` — which the frontend never set, making it unreachable from the app — defeated its only real use. Replaced by "Match provenance is returned on every import response".

**Migration**: Remove the `RECIPE_IMPORT_DEBUG` env var, its config parsing, and the `includeDebug` handler/use-case flag. Rename `RecipeDraftDebug` → `RecipeDraftProvenance`, `IngredientMatchDebug` → `IngredientMatchProvenance`, and the response field `debug` → `provenance`. The per-entry shape (`raw`, `candidates`, `chosen`, `flags`) is unchanged, so no consumer logic changes beyond the field name. **BREAKING** for any client reading `draft.debug`.

### Requirement: Debug box on the import review screen

**Reason**: A collapsed monospace box below the submit button is the wrong place and the wrong register for information needed while editing each row. Its content is redistributed inline — the raw line onto the row, the candidates into the replace flow, the flags into an uncertainty marker — in German rather than developer English.

**Migration**: Delete the `DebugBox` component and its tests. No replacement toggle: the information is always visible where it is used.
