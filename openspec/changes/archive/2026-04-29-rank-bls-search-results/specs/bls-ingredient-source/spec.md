## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Search result limits are bounded per source

The BLS service SHALL return at most 20 results per query, selected as the 20 highest-ranked entries by relevance score (with ties broken per the ranking requirement). The OFF query continues to use the existing `page_size=20`. The composite response SHALL therefore contain at most 40 results.

#### Scenario: Bulk match is capped at the 20 highest-ranked BLS hits
- **WHEN** a query matches more than 20 BLS entries
- **THEN** only the 20 entries with the highest relevance scores (with deterministic tiebreaking) are returned, and any matched entry with a strictly higher score than an included entry is never excluded
