## ADDED Requirements

### Requirement: Extractor transcribes each ingredient line verbatim

The `extract_recipe` tool schema SHALL include an optional `sourceText` field (a string) on each ingredient. The system prompt SHALL instruct the model to always populate it with the ingredient line exactly as printed in the photos, in the original language and casing. That includes the stated amount in its written form (e.g. `½`, `1-2`, `eine`), the unit word as written (e.g. `EL`, `Zehen`, `Dose`), size adjectives, brand words, and inline preparation modifiers. Only leading list markers (bullets, dashes, checkboxes) are stripped.

`sourceText` is a transcription, not an interpretation. The model MUST NOT normalize, translate, convert units, resolve fractions, add an estimated weight, or include text that is not on the ingredient line. When one printed line yields several ingredients (e.g. `Salz und Pfeffer`), each resulting ingredient MUST carry the same full line as its `sourceText`. When a line continues across two images, `sourceText` is the joined line.

The parser SHALL trim the value. Empty values (after trim) and values whose trimmed length exceeds 200 characters MUST be dropped (treated as absent). A missing or dropped `sourceText` MUST NOT fail the import. `sourceText` MUST NOT influence matching, amount resolution, piece-quantity validation, or any post-match flag, and it MUST NOT appear on any draft ingredient row or saved recipe.

#### Scenario: Counted food transcribed as printed

- **WHEN** the source recipe states the line `1 mittelgroße Zwiebel, gewürfelt`
- **THEN** the extracted ingredient carries `sourceText: "1 mittelgroße Zwiebel, gewürfelt"`
- **AND** its `name`, `pieceQuantity`, resolved `amount`/`unit` and `note` are produced exactly as they are without the field

#### Scenario: Spoon measure transcribed without conversion

- **WHEN** the source recipe states `2 EL Olivenöl`
- **THEN** the extracted ingredient carries `sourceText: "2 EL Olivenöl"`, regardless of any canonical amount or unit the model also returned

#### Scenario: Fraction glyph kept as written

- **WHEN** the source recipe states `½ TL Kreuzkümmel`
- **THEN** the extracted ingredient carries `sourceText: "½ TL Kreuzkümmel"`, not `0.5 TL Kreuzkümmel`

#### Scenario: One line split into several ingredients

- **WHEN** the source recipe states the line `Salz und Pfeffer` and the model returns two ingredients `Salz` and `Pfeffer`
- **THEN** both ingredients carry `sourceText: "Salz und Pfeffer"`

#### Scenario: List marker stripped

- **WHEN** the source recipe states the line `• 200 g Mehl`
- **THEN** the extracted ingredient carries `sourceText: "200 g Mehl"`

#### Scenario: Empty or overlong source text dropped

- **WHEN** the model returns an ingredient with `sourceText: "   "`, or with a `sourceText` whose trimmed length exceeds 200 characters
- **THEN** the parsed ingredient has no `sourceText`, and the rest of the ingredient (name, amount, unit, piece fields, note) is preserved

#### Scenario: Missing source text does not fail the import

- **WHEN** the model returns an ingredient without `sourceText`
- **THEN** the import succeeds and that ingredient's provenance `raw` entry has no `sourceText`

#### Scenario: Source text not carried onto the draft row

- **WHEN** an import yields an ingredient with `sourceText` present
- **THEN** the corresponding draft ingredient row (matched or unmatched) carries no `sourceText`, and a recipe saved from the draft stores none

## MODIFIED Requirements

### Requirement: Match provenance is returned on every import response

The import endpoint SHALL return a `provenance` object on every successful recipe-draft response, with no configuration gating. `provenance.ingredients` SHALL be a parallel array to the draft's `ingredients`: entry *i* describes how draft ingredient *i* was matched, in extraction order, so a client can correlate a row to its provenance by position without name matching.

For each extracted ingredient, the entry MUST include:

- `raw`: the ingredient exactly as returned by the vision model before any matching (name, amount, unit, piece-quantity fields, raw display fields when present, note when present, and `sourceText` when present).
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

#### Scenario: Verbatim source text carried on raw

- **WHEN** the model extracts `{ name: "Zwiebel", amount: 150, unit: "g", pieceAmount: 1, pieceUnitLabel: "Zwiebel", gramsPerPiece: 150, sourceText: "1 mittelgroße Zwiebel, gewürfelt" }`
- **THEN** that provenance entry's `raw.sourceText` is `"1 mittelgroße Zwiebel, gewürfelt"`, whether or not the ingredient matched

#### Scenario: Provenance is not persisted

- **WHEN** the user saves a reviewed draft
- **THEN** the stored recipe carries no provenance data

### Requirement: Review screen shows the raw extracted line on each imported row

The import review screen SHALL display, with each ingredient that came from the import, the text the model read for it, visually subordinate to the row's name. This makes a mismatch between what the photo said and what the row now claims visible without opening a source photo.

The raw line SHALL show the provenance `raw.sourceText` verbatim when present. When `sourceText` is absent, the raw line SHALL be reconstructed from the raw record using the recipe's own framing, in this order of preference: the piece count and piece label when `pieceQuantity` is present, else the raw display amount and unit label when `rawDisplayUnitLabel` is present, else the canonical `amount` and `unit` when present, always followed by the extracted name. The raw line MUST NOT present a total derived from an AI piece-weight estimate as the amount that was read.

The raw line SHALL appear:

- beneath each matched ingredient row in the ingredient list;
- on each row of the unmatched-ingredients panel;
- in the resolve sheet's item header when it is opened for an unmatched import row.

Rows the user adds manually after import SHALL NOT show a raw line. Replacing a row's ingredient SHALL leave the raw line unchanged, because it records what was read, not what was chosen.

#### Scenario: Raw line rendered under the matched name

- **WHEN** the model read `2 EL Tomatenmark` and the matcher chose the catalog entry `Tomatenmark`
- **THEN** that row shows `Tomatenmark` with the raw extracted line beneath it

#### Scenario: Mismatch is visible without the photo

- **WHEN** the model read `Kirschtomaten` and the matcher chose `Tomatenmark`
- **THEN** the row shows `Tomatenmark` with `Kirschtomaten` as its raw line, so the two can be compared in place

#### Scenario: Verbatim line shown instead of the gram estimate

- **WHEN** a matched row's provenance has `raw.sourceText: "1 mittelgroße Zwiebel, gewürfelt"`, `raw.amount: 150`, `raw.unit: "g"`, and `raw.pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`
- **THEN** the row's raw line shows `1 mittelgroße Zwiebel, gewürfelt` and does not show `150 g`

#### Scenario: Verbatim spoon measure shown instead of a conversion

- **WHEN** a matched row's provenance has `raw.sourceText: "2 EL Olivenöl"`, `raw.amount: 30`, and `raw.unit: "ml"`
- **THEN** the row's raw line shows `2 EL Olivenöl` and does not show `30 ml`

#### Scenario: Fallback prefers the piece count over the resolved total

- **WHEN** a row's provenance has no `sourceText`, `raw.name: "Zwiebel"`, `raw.amount: 150`, `raw.unit: "g"`, and `raw.pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`
- **THEN** the row's raw line shows the count `1` with `Zwiebel` and does not show `150 g`

#### Scenario: Fallback prefers the display quantity over a canonical conversion

- **WHEN** a row's provenance has no `sourceText`, `raw.name: "Olivenöl"`, `raw.amount: 30`, `raw.unit: "ml"`, `raw.rawDisplayAmount: 2`, and `raw.rawDisplayUnitLabel: "EL"`
- **THEN** the row's raw line shows `2 EL Olivenöl` and does not show `30 ml`

#### Scenario: Fallback uses the canonical amount for mass-stated ingredients

- **WHEN** a row's provenance has no `sourceText`, `raw.name: "Mehl"`, `raw.amount: 200`, `raw.unit: "g"`, and no piece or raw display fields
- **THEN** the row's raw line shows `200 g Mehl`

#### Scenario: Unmatched panel row shows the raw line

- **WHEN** the import yields an unmatched ingredient whose provenance has `raw.sourceText: "2 Stangen Zitronengras, angedrückt"`
- **THEN** that row in the unmatched-ingredients panel shows `2 Stangen Zitronengras, angedrückt` as its raw line

#### Scenario: Resolve sheet header shows the raw line

- **WHEN** the user opens the resolve sheet for that unmatched row
- **THEN** the sheet's item header shows `2 Stangen Zitronengras, angedrückt` as the raw line

#### Scenario: Manually added row has no raw line

- **WHEN** the user adds an ingredient through the picker after the draft loaded
- **THEN** that row shows no raw extracted line

#### Scenario: Raw line survives a replacement

- **WHEN** the user replaces a row's ingredient with a different catalog entry
- **THEN** the row's raw extracted line is unchanged and still shows what the model read
