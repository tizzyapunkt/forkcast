# bls-ingredient-source

## Purpose

Serve ingredient search results from the German BLS 4.0 (2025) nutrition database as an in-memory, locally-bundled ingredient source, complementing Open Food Facts. Provides authoritative per-100g macros for whole foods with case- and diacritic-insensitive name matching and relevance-ranked results.

## Requirements

### Requirement: BLS dataset is loaded as a searchable in-memory ingredient source

The system SHALL load the BLS 4.0 (2025) ingredient dataset from a pre-built JSON artifact into memory at backend startup, and SHALL expose it through the same `IngredientSearchService` port that already serves Open Food Facts results. The dataset SHALL include only entries that have a valid kcal/100g value; rows missing calories SHALL be excluded at build time.

#### Scenario: Backend starts with a valid bls.json artifact

- **WHEN** the backend boots and `backend/data/bls.json` exists and contains well-formed entries
- **THEN** the BLS in-memory service is initialized and reports `>0` entries available for search

#### Scenario: BLS rows without calories are excluded

- **WHEN** the build script encounters a CSV row whose `ENERCC` (kcal/100g) value is missing or unparseable
- **THEN** that row is excluded from `bls.json`, and the runtime BLS service never returns it

### Requirement: BLS name search is case- and diacritic-insensitive substring matching

The system SHALL match a query against each BLS entry's German name (`Lebensmittelbezeichnung`) and English name (`Food name`) by performing a substring comparison after lowercasing and stripping Unicode combining marks (NFD → strip diacritics). Both the query and the indexed names SHALL be folded. The system SHALL ignore queries shorter than 2 characters after trimming.

#### Scenario: Diacritic folding matches German names without umlauts

- **WHEN** the user searches for `kase`
- **THEN** the response includes the BLS entry whose German name is `Käse, Camembert`

#### Scenario: Case-insensitive substring matching

- **WHEN** the user searches for `MÖHRE`
- **THEN** the response includes BLS entries whose German name contains `möhre`, `Möhre`, or `MÖHRE` in any casing

#### Scenario: English name fallback

- **WHEN** the user searches for `carrot`
- **THEN** the response includes BLS entries whose English `Food name` contains `carrot`, even if the German name does not

#### Scenario: Empty or too-short query

- **WHEN** the user submits a query of length 0 or 1 character (after trim)
- **THEN** the BLS service returns an empty list

### Requirement: BLS search results carry source attribution and macros

Each BLS result SHALL conform to the shared `IngredientSearchResult` shape with `source: 'BLS'`, `id` set to the BLS code, `unit: 'g'`, and `macrosPerUnit` derived by dividing the per-100g values by 100 for `calories`, `protein`, `carbs`, and `fat`. The `name` field SHALL be the German `Lebensmittelbezeichnung`.

#### Scenario: Result shape includes source and id

- **WHEN** any BLS entry is returned from `searchByName`
- **THEN** the result has `source === 'BLS'`, `id` equal to the entry's BLS code, `unit === 'g'`, and `macrosPerUnit` populated

#### Scenario: Macros are scaled per gram

- **WHEN** a BLS entry has `ENERCC = 250` kcal/100g and `PROT625 = 10` g/100g
- **THEN** the returned `macrosPerUnit` has `calories === 2.5` and `protein === 0.1`

### Requirement: Composite ingredient search merges BLS and OFF results

The HTTP `/ingredients/search` endpoint SHALL be served by a composite `IngredientSearchService` that fans out to both the BLS in-memory service and the Open Food Facts service in parallel and returns a single merged list. BLS hits SHALL appear before OFF hits in the response. If one source fails, the other source's results SHALL still be returned.

#### Scenario: Both sources contribute results

- **WHEN** the user searches for `milch`
- **THEN** the response contains BLS results first (with `source: 'BLS'`) followed by OFF results (with `source: 'OFF'`)

#### Scenario: OFF source fails but BLS succeeds

- **WHEN** the OFF API throws or rejects during a search
- **THEN** the response still contains the BLS-only results (and the OFF failure is logged server-side)

#### Scenario: BLS source returns nothing for a packaged product

- **WHEN** the user searches for a brand name that exists only in OFF
- **THEN** the response contains only OFF results, with `source: 'OFF'`

### Requirement: Barcode lookup remains OFF-only

The system SHALL NOT attempt to resolve barcodes against BLS (which has no barcodes). Barcode lookup SHALL continue to query Open Food Facts and return either a single OFF-tagged result or `null`.

#### Scenario: Known barcode resolves via OFF

- **WHEN** the user submits a barcode that exists in OFF
- **THEN** the response is a single result with `source: 'OFF'`

#### Scenario: Unknown barcode

- **WHEN** the user submits a barcode unknown to OFF
- **THEN** the response is a 404 (existing behavior preserved)

### Requirement: Search result limits are bounded per source

The BLS service SHALL return at most 20 results per query, selected as the 20 highest-ranked entries by relevance score (with ties broken per the ranking requirement). The OFF query continues to use the existing `page_size=20`. The composite response SHALL therefore contain at most 40 results.

#### Scenario: Bulk match is capped at the 20 highest-ranked BLS hits

- **WHEN** a query matches more than 20 BLS entries
- **THEN** only the 20 entries with the highest relevance scores (with deterministic tiebreaking) are returned, and any matched entry with a strictly higher score than an included entry is never excluded

### Requirement: BLS search results are ranked by name-match relevance

The system SHALL rank BLS search results by a tiered relevance score computed per matched entry, returning higher-scoring entries first. The score SHALL be derived from how the folded query matches the entry's folded German name (`name_de_folded`) and folded English name (`name_en_folded`), using the following tiers from highest to lowest:

1. **Exact match** — the folded name equals the folded query.
2. **Whole-word match** — the folded query appears in the folded name bounded on both sides by start-of-string, end-of-string, or one of: whitespace, `,`, `(`, `)`, `/`, `-`.
3. **Prefix match** — the folded name starts with the folded query.
4. **Token-start match** — the folded query appears immediately after a token boundary (start-of-string, whitespace, `,`, `(`, `)`, `/`, `-`).
5. **Substring match** — the folded query appears anywhere in the folded name.

A match in `name_de_folded` SHALL outrank a match in `name_en_folded` of the same or weaker tier. The final score per entry SHALL be the maximum of its German-name and English-name scores.

#### Scenario: Exact German match outranks substring match

- **WHEN** the user searches for `Hähnchenbrust` and the dataset contains both an entry whose `name_de` equals `Hähnchenbrust` and entries whose `name_de` merely contains the word
- **THEN** the entry whose `name_de` equals `Hähnchenbrust` appears first in the response

#### Scenario: Whole-word German match outranks token-start match

- **WHEN** the user searches for `Reis` and the dataset contains an entry whose `name_de` is `Reis, gekocht` and another whose `name_de` is `Reisnudeln`
- **THEN** `Reis, gekocht` (whole-word match) appears before `Reisnudeln` (prefix/token-start match)

#### Scenario: German match outranks English match of the same tier

- **WHEN** the user searches for a query that produces a substring match in some entries' `name_de` and a substring match in other entries' `name_en` only
- **THEN** all entries with a German-name substring match appear before entries that match only via the English name

#### Scenario: English-only match still ranks above no match

- **WHEN** the user searches for `carrot` and an entry's `name_en` contains `carrot` while its `name_de` does not
- **THEN** that entry is included in the response with a positive score

### Requirement: BLS search ties are broken by name length, then locale order

When two BLS entries have the same relevance score, the system SHALL order them by `name_de` length ascending (shorter first). If `name_de` length is also equal, the system SHALL order them by `name_de.localeCompare`. Result ordering SHALL be deterministic across calls with the same query and dataset.

#### Scenario: Shorter name wins within the same tier

- **WHEN** two entries both produce a whole-word match for the same query and one entry's `name_de` is shorter than the other's
- **THEN** the entry with the shorter `name_de` appears first

#### Scenario: Locale order breaks remaining ties

- **WHEN** two entries have the same score and the same `name_de` length
- **THEN** they are ordered by `name_de.localeCompare`, and the same query against the same dataset always returns the same order

### Requirement: Frontend renders source-attribution badge per result

The frontend search result list SHALL render a small visual badge next to each result showing its `source` (`BLS` or `OFF`). The list key for each result SHALL be `${source}:${id}` to remain unique across sources.

#### Scenario: Badge visible on each row

- **WHEN** the search panel renders a non-empty result list
- **THEN** every row has a `BLS` or `OFF` badge corresponding to the result's `source` field

#### Scenario: Same id across sources renders distinct rows

- **WHEN** an OFF result and a BLS result happen to share the same `id` value
- **THEN** both rows render without React duplicate-key warnings

### Requirement: Generic search-result shape replaces OFF-specific field

The `IngredientSearchResult` type (backend and frontend) SHALL expose a generic `id: string` field and a `source: 'OFF' | 'BLS'` discriminator. The previous `offId` field SHALL be removed.

#### Scenario: OFF mapper sets source and id

- **WHEN** an OFF product is mapped to a search result
- **THEN** the result has `source: 'OFF'` and `id` equal to the OFF product code

#### Scenario: BLS mapper sets source and id

- **WHEN** a BLS row is mapped to a search result
- **THEN** the result has `source: 'BLS'` and `id` equal to the BLS code
