## ADDED Requirements

### Requirement: Import auto-matches confident name matches only

The name search SHALL report, for every result, whether it matched the query *confidently*. It SHALL report this without changing its ranking or its result set. Names and synonyms are compared case- and diacritic-folded. Word boundaries are whitespace, `,`, `(`, `)`, `/` and `-`.

A hit is confident when the query and a catalog name or synonym relate in one of these ways:

- **Exact:** they are equal.
- **Whole word, not a compound modifier:** one appears in the other as a boundary-delimited word, and the character right after it is not a hyphen. German compounds put the food last, so a word followed by a hyphen ("Peanut-**butter**-Pulver", "Honig-Senf-Sauce") only modifies the food; one preceded by a hyphen ("Bio-**Tomaten**") is the food.
- **Inflected word:** the query starts a word of the name, and the rest of that word is only an inflection ending (`n`, `e`, `en`, `s`, `es`, `er`). Examples: Kichererbse → Kichererbse**n**, Ei → Ei**er**.

Every other hit is partial. That covers a prefix into a longer word (Honig → **Honig**melone, Reis → **Reis**nudeln), the tail of a compound (Butter → Erdnuss**butter**), and any mid-word substring.

AI recipe import SHALL auto-match only confident candidates. It takes the first confident candidate in rank order. The interactive ingredient search and the resolve flow's candidate search SHALL keep returning partial hits as suggestions.

#### Scenario: Prefix into a longer word is partial

- **WHEN** the query `Honig` is scored against a catalog entry `Honigmelone`
- **THEN** the hit is partial

#### Scenario: Inflection ending is confident

- **WHEN** the query `Kichererbse` is scored against `Kichererbsen`, or the query `Ei` against `Eier`
- **THEN** the hit is confident

#### Scenario: Word followed by a hyphen is partial

- **WHEN** the query `Peanut-butter-Pulver` is scored against a catalog entry `Butter`
- **THEN** the hit is partial

#### Scenario: Word after a hyphen is confident

- **WHEN** the query `Bio-Tomaten` is scored against a catalog entry `Tomaten`
- **THEN** the hit is confident

#### Scenario: Whole word inside a longer query is confident

- **WHEN** the query `Kichererbsen (aus der Dose, abgetropft)` is scored against a catalog entry `Kichererbsen`
- **THEN** the hit is confident

#### Scenario: Synonym exact match is confident

- **WHEN** the query `Erdnussmus` is scored against a catalog entry `Erdnussbutter` with the synonym `Erdnussmus`
- **THEN** the hit is confident

#### Scenario: A confident candidate below a partial one is chosen

- **WHEN** the catalog returns `Kichererbsenmehl` (partial) and `Kichererbsen` (confident) for the query `Kichererbse`, in either rank order
- **THEN** the import matches `Kichererbsen`

#### Scenario: Interactive search still suggests partial hits

- **WHEN** the user searches the catalog for `Honig` and only `Honigmelone` contains it
- **THEN** `Honigmelone` is returned as a search result

## MODIFIED Requirements

### Requirement: Ingredient matching against existing catalog

The system SHALL, for each ingredient name extracted from the photos, attempt to match it using a strict source cascade: first the user's catalog (`CATALOG`, including synonyms), then — only when the catalog returns zero candidates — scanned products (`SCAN`) via name search. The first tier returning at least one *confident* candidate (see "Import auto-matches confident name matches only") wins, and the lower tier MUST NOT be consulted. A tier that returns only partial candidates does not stop the cascade. Open Food Facts MUST NOT be queried during import matching.

When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit`, `macrosPerUnit`, and `untracked` flag, while keeping the model-extracted `amount`, and MUST carry the winning tier as its `source` (`CATALOG` or `SCAN`). When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no tier produces a confident candidate, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), `unit` (if any), `pieceQuantity` (if any), `note` (if any), and the spoon measure — `rawDisplayAmount`, `rawDisplayUnitLabel` and `gramsPerSpoon` (each if any) — without macros, without `displayQuantity`, and without an `untracked` flag (the user sets it manually in the review UI if needed).

When the model returns piece-quantity fields for an ingredient (see "Resolve piece quantities to gram weights"), the matching pipeline MUST preserve them on the draft row, subject to:
- If the resolved catalog `unit` is `g` or `ml`, `pieceQuantity` is preserved verbatim and the catalog `unit` is used.
- If the resolved catalog `unit` is anything other than `g` or `ml` (e.g. `tbsp`, `piece`), `pieceQuantity` MUST be dropped and the row falls back to the catalog unit's macros, because piece quantities are only meaningful when the row is mass-tracked.
- The `unitOverridden` flag MUST be raised when the model's `unit` differs from the catalog `unit`, regardless of whether `pieceQuantity` is set.

When the extractor returns a `note` field on an ingredient, the matching pipeline MUST preserve it verbatim on the resulting draft row, regardless of match outcome. The note MUST NOT influence matching, normalization, or any post-match flag. The note rides along on both matched and unmatched rows.

#### Scenario: Matched ingredient

- **WHEN** the model extracts an ingredient name "olive oil" and the catalog returns a matching entry with `unit: "ml"` and known macros
- **THEN** the draft row contains the matched name, `unit: "ml"`, the matched `macrosPerUnit`, and the model's extracted `amount`
- **AND** the row is not flagged as unmatched

#### Scenario: Food confirmed in an earlier import matches on a later one

- **WHEN** the model extracts `Kirschtomaten` and the catalog contains a `Kirschtomaten` entry the user confirmed during a previous import
- **THEN** the draft row is matched against that entry with `source: 'CATALOG'`

#### Scenario: Scanned product matched when the catalog has no hit

- **WHEN** the model extracts `Skyr`, the catalog returns zero candidates, and a scanned product named `Skyr` exists
- **THEN** the draft row is matched against the scanned product with `source: 'SCAN'`

#### Scenario: Catalog hit wins without consulting scanned products

- **WHEN** the model extracts an ingredient for which the catalog returns at least one candidate
- **THEN** the SCAN tier is not searched for that ingredient

#### Scenario: OFF never queried during import

- **WHEN** an import draft is matched end to end
- **THEN** no Open Food Facts search is performed for any ingredient

#### Scenario: Unit override flagged

- **WHEN** the model extracts `{ name: "Joghurt", amount: 150, unit: "ml" }` and the catalog match has `unit: "g"`
- **THEN** the draft row uses `unit: "g"` (catalog wins), keeps `amount: 150`, and is flagged `unitOverridden: true`

#### Scenario: Prefix into a longer compound is not a match

- **WHEN** the model extracts `Honig`, the catalog has no Honig entry but has `Honigmelone`, and no scanned product matches
- **THEN** the draft row is unmatched, not matched against `Honigmelone`

#### Scenario: Hyphen-joined modifier is not a match

- **WHEN** the model extracts `Peanut-butter-Pulver` and the only catalog hit is `Butter`
- **THEN** the draft row is unmatched, not matched against `Butter`

#### Scenario: Partial catalog hits fall through to scanned products

- **WHEN** the model extracts `Reis`, the catalog's only hit is `Reisnudeln` (partial), and a scanned product named `Reis` exists
- **THEN** the draft row is matched against the scanned product `Reis` with `source: 'SCAN'`

#### Scenario: Unmatched ingredient

- **WHEN** the model extracts an ingredient name that has no match in either cascade tier
- **THEN** the draft row is flagged as unmatched and carries only the extracted `name`, `amount`, `unit`, `pieceQuantity` (when present), `note` (when present), and the spoon measure fields (when present), with no `macrosPerUnit` and no `untracked` flag

#### Scenario: Unmatched ingredient keeps its spoon measure

- **WHEN** the model extracts `{ name: "Erdnussmus", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL", gramsPerSpoon: 16 }` and no cascade tier has a match for `Erdnussmus`
- **THEN** the unmatched draft row carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"`, `gramsPerSpoon: 16`, no `amount`, and no `displayQuantity`

#### Scenario: Piece quantity preserved through mass-unit match

- **WHEN** the model extracts `{ name: "Zwiebel", amount: 150, unit: "g", pieceAmount: 1, pieceUnitLabel: "Zwiebel", gramsPerPiece: 150 }` and the catalog match for "Zwiebel" has `unit: "g"` with known macros
- **THEN** the draft row contains the matched name, `unit: "g"`, matched macros, `amount: 150`, and `pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`

#### Scenario: Piece quantity dropped through non-mass match

- **WHEN** the model extracts `{ name: "Knoblauch", amount: 6, unit: "g", pieceAmount: 2, pieceUnitLabel: "Zehe", gramsPerPiece: 3 }` and the catalog match for "Knoblauch" has `unit: "tbsp"`
- **THEN** the draft row uses the catalog `unit: "tbsp"`, drops the `pieceQuantity`, and is flagged `unitOverridden: true`

#### Scenario: Untracked inherited from the catalog match

- **WHEN** the model extracts `{ name: "salt", amount: 5, unit: "g" }` and the catalog match for `salz` has `unit: "g"` and `untracked: true`
- **THEN** the matched draft row carries `untracked: true` (the flag is inherited from the catalog match)

#### Scenario: Tracked match yields no untracked flag on the draft row

- **WHEN** the model extracts an ingredient that matches a tracked catalog entry
- **THEN** the matched draft row carries `untracked: false` (or omits the field) — the row is treated as tracked

#### Scenario: Note preserved on matched row

- **WHEN** the model extracts `{ name: "Ingwer", amount: 5, unit: "g", note: "fein gehackt" }` and the catalog match for `Ingwer` has `unit: "g"` with known macros
- **THEN** the matched draft row contains `note: "fein gehackt"` alongside the matched fields

#### Scenario: Note preserved on unmatched row

- **WHEN** the model extracts `{ name: "Yuzu-Schale", amount: 2, unit: "g", note: "fein abgerieben" }` and no cascade tier has a match for `Yuzu-Schale`
- **THEN** the unmatched draft row contains `note: "fein abgerieben"` alongside the extracted name, amount, and unit

#### Scenario: Note absent when extractor omits it

- **WHEN** the model extracts an ingredient with no `note` field on it
- **THEN** the resulting draft row has no `note` field, regardless of match outcome

### Requirement: Match attempt falls back to a normalized name across the cascade

When the full source cascade (FOODS → USER → SCAN) returns no confident candidate for `raw.name`, the system SHALL compute a normalized form of `raw.name` by stripping a single trailing `, …` clause and a single trailing `(…)` parenthetical, then collapsing whitespace. If the normalized form differs from the raw form, the system SHALL retry the full cascade once with the normalized name. Leading adjectives MUST NOT be stripped during normalization.

When the retry returns at least one confident candidate, the row SHALL be matched as if the winning tier had returned that candidate for the raw name — all existing matching rules (unit override, piece-drop, untracked inheritance, etc.) apply unchanged. When the retry also returns no confident candidate, the row is flagged unmatched.

#### Scenario: Comma-suffix normalization rescues a match

- **WHEN** the extractor returns `{ name: "Ingwer, fein gehackt", amount: 5, unit: "g" }` and the FOODS tier has an entry whose canonical name is `"Ingwer"`
- **THEN** the cascade runs twice (first with `"Ingwer, fein gehackt"`, then with `"Ingwer"`) and the draft row is matched against the `Ingwer` entry with `amount: 5, unit: "g"`

#### Scenario: No retry when raw and normalized are identical

- **WHEN** the extractor returns `{ name: "unicorn dust", amount: 1, unit: "tsp" }` and the cascade returns zero candidates
- **THEN** the cascade is not retried (normalization yields `"unicorn dust"` unchanged) and the row is flagged unmatched

#### Scenario: Retry when the raw name only has partial hits

- **WHEN** the extractor returns `{ name: "Hafer, zart", amount: 40, unit: "g" }`, every tier returns only partial candidates for that raw name, and the catalog has an entry `Hafer`
- **THEN** the cascade is retried with `"Hafer"` and the draft row is matched against `Hafer`

#### Scenario: No retry when raw name already matches

- **WHEN** the extractor returns `{ name: "Ingwer", amount: 5, unit: "g" }` and the FOODS tier returns at least one confident candidate
- **THEN** the cascade runs exactly once and the row is matched

### Requirement: Match provenance is returned on every import response

The import endpoint SHALL return a `provenance` object on every successful recipe-draft response, with no configuration gating. `provenance.ingredients` SHALL be a parallel array to the draft's `ingredients`: entry *i* describes how draft ingredient *i* was matched, in extraction order, so a client can correlate a row to its provenance by position without name matching.

For each extracted ingredient, the entry MUST include:

- `raw`: the parsed ingredient before any matching (name, amount, unit, piece-quantity fields, raw display fields and `gramsPerSpoon` when present, note when present, and `sourceText` when present). Its structured fields reflect the parser's validation and spoon normalization (see "Validate model-returned piece arithmetic" and "Parser moves spoon and ounce values off the canonical unit"). `sourceText` is the one field no parsing step alters, and it records the line exactly as read.
- `candidates`: the top candidates returned by the winning cascade tier for the raw name, in rank order, capped at 5. For an unmatched row, these are the partial candidates of the first tier that returned any, so a rejected near-miss (e.g. `Honigmelone` for `Honig`) stays visible. Each candidate exposes `name`, `source`, `unit`, and `untracked`.
- `chosen`: the candidate picked as the match, or `null` when no tier matched.
- `flags`: a flat object of the post-match flags that fired on this row (`unitOverridden`, `pieceQuantityDropped`, `untrackedInherited`, `missingAmount`, `spoonEstimated`). `spoonEstimated` is `true` only when a tracked row's `amount` came from the model's per-spoon estimate (see "Importer converts spoon measures on tracked matches"). Rows converted by fixed volume or by catalog density are deterministic and carry `spoonEstimated: false`.

The provenance payload MUST NOT be persisted anywhere; it exists only on the request-scoped response and MUST NOT appear on a saved recipe.

#### Scenario: Provenance present without configuration

- **WHEN** a client calls `POST /import-recipe-from-photos` with a valid image whose extraction yields two ingredients, with no import-debug environment variable set
- **THEN** the response is `200` with a `provenance.ingredients` array of length 2, each entry containing `raw`, `candidates`, `chosen`, and `flags`

#### Scenario: Provenance is positionally parallel to the draft ingredients

- **WHEN** an import yields a draft whose second ingredient is unmatched and whose third is matched
- **THEN** `provenance.ingredients[1].chosen` is `null` and `provenance.ingredients[2].chosen` describes the match for draft ingredient index 2

#### Scenario: Matched row carries chosen and the unit-override flag

- **WHEN** the model extracts `{ name: "Joghurt", amount: 150, unit: "ml" }` and the catalog match has `unit: "g"`
- **THEN** that provenance entry has a non-null `chosen` with `unit: "g"`, `flags.unitOverridden` is `true`, `flags.pieceQuantityDropped` is `false`, and `candidates[0]` matches `chosen`

#### Scenario: Unmatched row carries null chosen

- **WHEN** the model extracts an ingredient name that no cascade tier matches
- **THEN** that provenance entry has `chosen: null`, an empty `candidates` array, and all `flags` false

#### Scenario: Rejected partial candidates stay on an unmatched row

- **WHEN** the model extracts `Honig` and the only catalog hit is the partial `Honigmelone`
- **THEN** that provenance entry has `chosen: null` and `candidates[0].name` is `Honigmelone`

#### Scenario: Candidate cap

- **WHEN** the winning tier returns more than 5 candidates for a raw ingredient name
- **THEN** that entry's `candidates` array has length exactly 5, in the original rank order

#### Scenario: Verbatim source text carried on raw

- **WHEN** the model extracts `{ name: "Zwiebel", amount: 150, unit: "g", pieceAmount: 1, pieceUnitLabel: "Zwiebel", gramsPerPiece: 150, sourceText: "1 mittelgroße Zwiebel, gewürfelt" }`
- **THEN** that provenance entry's `raw.sourceText` is `"1 mittelgroße Zwiebel, gewürfelt"`, whether or not the ingredient matched

#### Scenario: Normalized spoon keeps the printed line on raw

- **WHEN** the model extracts `{ name: "Olivenöl", amount: 2, unit: "tbsp", sourceText: "2 EL Olivenöl" }`
- **THEN** that provenance entry's `raw` carries `rawDisplayAmount: 2`, `rawDisplayUnitLabel: "EL"`, no `amount` or `unit`, and `sourceText: "2 EL Olivenöl"` exactly as the model returned it

#### Scenario: Estimated spoon amount flagged

- **WHEN** an import converts `{ name: "Haferflocken", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL", gramsPerSpoon: 8 }` against a tracked `g` entry without `density`
- **THEN** that provenance entry has `flags.spoonEstimated: true` and `flags.missingAmount: false`

#### Scenario: Deterministic spoon conversion not flagged

- **WHEN** an import converts `{ name: "Olivenöl", rawDisplayAmount: 2, rawDisplayUnitLabel: "EL" }` against a tracked `ml` entry
- **THEN** that provenance entry has `flags.spoonEstimated: false`

#### Scenario: Provenance is not persisted

- **WHEN** the user saves a reviewed draft
- **THEN** the stored recipe carries no provenance data
