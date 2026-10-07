## ADDED Requirements

### Requirement: Catalog entries can carry English display fields

A catalog entry SHALL accept an optional English display name next to its canonical German `name`. The field is optional: an entry without it stays valid, and an existing catalog file without it loads unchanged. When present, the English name MUST be a non-empty string and MUST NOT case-insensitively equal another entry's canonical or English name. The canonical German `name` remains the source of the entry's `id`. The bundled seed SHALL carry an English name for every entry.

#### Scenario: Entry without English fields stays valid
- **WHEN** the catalog is loaded from a file whose entries carry no English name
- **THEN** every entry loads and is searchable as before

#### Scenario: Empty English name rejected
- **WHEN** a create or update sets the English name to an empty or whitespace-only string
- **THEN** the response is `400` and the catalog is unchanged

#### Scenario: Seed is fully translated
- **WHEN** the bundled seed is inspected
- **THEN** every entry has an English name

## MODIFIED Requirements

### Requirement: Catalog name search is case- and diacritic-insensitive across canonical name and synonyms

The system SHALL match a query against each entry's canonical `name`, its English name when present, and each of its `synonyms` by substring comparison after lowercasing and stripping Unicode combining marks (NFD → strip diacritics). Both the query and the indexed strings SHALL be folded. Matching SHALL consider all of these names regardless of the requested locale. Queries shorter than 2 characters after trimming SHALL return an empty list.

#### Scenario: Diacritic folding matches German names without umlauts

- **WHEN** the user searches for `mohre`
- **THEN** the results include the entry whose canonical name is `Möhre`

#### Scenario: Synonym match returns the canonical name

- **WHEN** the user searches for `karotte` in the German locale and an entry has `name: "Möhre"` with `synonyms: ["Karotte"]`
- **THEN** the results include a result whose `name` is `Möhre`

#### Scenario: English name matches in either locale

- **WHEN** the user searches for `carrot` in the German locale and the entry `Möhre` has the English name `Carrot`
- **THEN** the results include a result whose `name` is `Möhre`

#### Scenario: Too-short query

- **WHEN** the user submits a query of 0 or 1 character after trimming
- **THEN** the catalog returns an empty list

### Requirement: Catalog search results carry source attribution and macros

Each catalog result SHALL conform to the shared `IngredientSearchResult` shape with `source: 'CATALOG'`, `id` set to the entry's id, `name` set to the entry's display name for the requested locale, `unit` set to the entry's unit, and `macrosPerUnit` derived by dividing each per-100 value by 100. The search endpoint SHALL accept an optional `locale` of `de` or `en`. Absent or unknown values mean `de`. For `de` the display name is the canonical name. For `en` it is the English name, falling back to the canonical name when the entry has none. When the entry has `untracked: true` the result SHALL carry `untracked: true`; otherwise it SHALL carry `untracked: false` or omit the field, and consumers MUST treat absent and `false` as equivalent.

#### Scenario: Result shape includes source, id, and unit

- **WHEN** any catalog entry is returned from a name search
- **THEN** the result has `source === 'CATALOG'`, `id` equal to the entry's id, `unit` equal to the entry's unit, and `macrosPerUnit` populated

#### Scenario: Macros are scaled per gram or millilitre

- **WHEN** an entry has `unit: "g"` and `macrosPer100 = { calories: 250, protein: 10, carbs: 0, fat: 23 }`
- **THEN** the returned `macrosPerUnit` has `calories === 2.5`, `protein === 0.1`, `carbs === 0`, and `fat === 0.23`

#### Scenario: English locale returns English names

- **WHEN** a search for `apfel` is made with `locale=en` and the matching entry has the English name `Apple`
- **THEN** the result's `name` is `Apple`

#### Scenario: English locale falls back to the canonical name

- **WHEN** a search is made with `locale=en` and the matching entry has no English name
- **THEN** the result's `name` is the canonical German name

#### Scenario: Default locale is German

- **WHEN** a search is made without a `locale` parameter
- **THEN** results carry canonical German names

#### Scenario: Untracked flag carried through

- **WHEN** an entry with `untracked: true` matches a query
- **THEN** the returned result carries `untracked: true`

### Requirement: Catalog manager screen lists, searches, and edits the catalog

The frontend SHALL provide a catalog manager screen, reachable from settings, that lists catalog entries with their display name for the active locale, unit, and per-100 calories, offers a text filter over the canonical name, English name and synonyms, and supports creating a new entry, editing an existing entry, and deleting an entry. The editor SHALL expose name, English name, synonyms, unit (`g`/`ml`), the four per-100 macro values, the untracked flag, and piece weights. Validation errors SHALL be surfaced inline without discarding the user's input. Deletion SHALL require an explicit confirmation step.

#### Scenario: Entry corrected from the manager

- **WHEN** the user opens an entry whose macros are wrong, corrects the calories, and saves
- **THEN** the list shows the corrected value and a subsequent ingredient search returns the corrected macros

#### Scenario: English name added from the manager

- **WHEN** the user adds the English name `Balsamic vinegar` to the entry `Balsamicoessig` and saves
- **THEN** a search with `locale=en` returns the entry named `Balsamic vinegar`

#### Scenario: Bad synonym removed

- **WHEN** the user removes the synonym `Ölpacked getrocknete Tomaten` from an entry and saves
- **THEN** the entry no longer carries that synonym and a search for it no longer matches the entry

#### Scenario: Deletion is confirmed before it happens

- **WHEN** the user taps delete on an entry
- **THEN** a confirmation is required before the entry is removed, and dismissing it leaves the entry in place

#### Scenario: Invalid input surfaced inline

- **WHEN** the user marks an entry untracked while its macros are non-zero and saves
- **THEN** an inline error explains the conflict and the user's in-progress input is preserved

### Requirement: Creating a food by hand starts blank with an optional AI fill

The catalog manager's create form SHALL open with empty fields and SHALL NOT call any AI service on open. It SHALL offer an explicit fill action that, when invoked with a non-empty name, requests suggested unit, synonyms, per-100 macros and an English name, and populates the corresponding fields, marking the populated macro values as estimates. The name may be typed in German or English. The user SHALL be able to edit every filled field before saving, and SHALL be able to save a hand-typed entry without ever invoking the fill action. A failed fill request SHALL surface an error and leave the user's input intact.

#### Scenario: Form opens empty and makes no AI call

- **WHEN** the user opens the create form
- **THEN** all fields are empty and no AI request has been made

#### Scenario: Fill populates suggestions on request

- **WHEN** the user types `Balsamicoessig` and invokes the fill action
- **THEN** unit, synonyms, per-100 macros and an English name are populated with suggestions and the macro values are marked as estimates

#### Scenario: Hand-typed entry saves without AI

- **WHEN** the user fills every field manually and saves without invoking the fill action
- **THEN** the entry is created with exactly the typed values

#### Scenario: Failed fill preserves input

- **WHEN** the fill request fails
- **THEN** an error is shown and the fields the user already typed are unchanged

### Requirement: Catalog search results are ranked with canonical-over-synonym tiering

The system SHALL rank catalog results by a tiered relevance score, where each entry's score is the maximum of (i) the score against its folded canonical name using the canonical tier values, (ii) the score against its folded English name, when present, using the canonical tier values, and (iii) the maximum score across its folded synonyms using the synonym tier values. The five tiers, highest to lowest, are: exact, whole-word, prefix, token-start, substring. Token boundaries are start-of-string, end-of-string, or one of: whitespace, `,`, `(`, `)`, `/`, `-`. Canonical tier values SHALL be strictly higher than the corresponding synonym tier values.

#### Scenario: Exact canonical match outranks substring canonical match

- **WHEN** the user searches for `Möhre` and the catalog contains both an entry whose `name` equals `Möhre` and entries whose `name` merely contains the word
- **THEN** the entry whose `name` equals `Möhre` appears first

#### Scenario: Canonical match outranks synonym match of the same tier

- **WHEN** entry A has `Karotte` among its `synonyms` and entry B has `name` equal to `Karotte`, and the user searches for `Karotte`
- **THEN** entry B appears before entry A

#### Scenario: English name scores in the canonical tier

- **WHEN** entry A has `carrot` among its `synonyms`, entry B has the English name `Carrot`, and the user searches for `carrot`
- **THEN** entry B appears before entry A

#### Scenario: Best synonym match contributes when no canonical match exists

- **WHEN** the user searches for `carrot`, neither the entry's canonical name nor its English name contains the query, and one of its synonyms equals `carrot`
- **THEN** that entry is included with the synonym-tier exact score

### Requirement: Catalog search ties are broken by canonical name length, then locale order

When two entries have the same relevance score, the system SHALL order them by the length of their display name for the requested locale ascending, then by that display name's `localeCompare`. For the German locale the display name is the canonical `name`. Ordering SHALL be deterministic across calls with the same query, locale and catalog content.

#### Scenario: Shorter name wins within the same tier

- **WHEN** two entries produce the same-tier canonical match and one display name is shorter
- **THEN** the shorter-named entry appears first

#### Scenario: Locale order breaks remaining ties

- **WHEN** two entries have the same score and the same display name length
- **THEN** they are ordered by `localeCompare` of their display names and repeat queries return the same order
