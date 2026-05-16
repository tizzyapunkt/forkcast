## ADDED Requirements

### Requirement: Ingredient `name` field carries the food noun only

The extractor's `extract_recipe` tool schema and system prompt SHALL require that the `name` field on every extracted ingredient contains only the food noun, without preparation, cut, or quality modifiers (e.g. "fein gehackt", "geschält", "in Scheiben", "frisch gewolft"). When the source recipe writes such modifiers inline with the ingredient name, the model MUST move the prep instruction into the appropriate entry in `steps` and leave `name` clean.

Leading adjectives that change the food itself — i.e. that change the nutrition profile or identity, such as "Zuckerfreier Ahornsirup", "Geräucherter Lachs", "Gemahlener Zimt" — SHALL be preserved on `name` and SHALL NOT be moved to `steps`.

#### Scenario: Inline prep modifier moved to steps

- **WHEN** the source recipe states an ingredient line `"1 TL Ingwer, fein gehackt"` followed by a single step `"Alles vermischen und 5 min köcheln"`
- **THEN** the model returns the ingredient with `name: "Ingwer"` (no comma-suffix) and the returned `steps` carry the equivalent prep instruction (e.g. a new short step or an extension of an existing one) so the prep info is not lost

#### Scenario: Leading qualifier preserved

- **WHEN** the source recipe states `"100 ml Zuckerfreier Ahornsirup"`
- **THEN** the model returns the ingredient with `name: "Zuckerfreier Ahornsirup"` unchanged — the leading qualifier is part of the food identity

### Requirement: Match attempt falls back to a normalized name before recording

When the AI recipe import use case calls `IngredientSearchService.searchByName(raw.name, {FOODS})` and the result is empty, the system SHALL compute a normalized form of `raw.name` by stripping a single trailing `, …` clause and a single trailing `(…)` parenthetical, then collapsing whitespace. If the normalized form differs from the raw form, the system SHALL retry the search once with the normalized name. Leading adjectives MUST NOT be stripped during normalization.

When the retry returns at least one candidate, the row SHALL be matched as if the catalog had returned that candidate for the raw name — all existing matching rules (unit override, piece-drop, untracked inheritance, etc.) apply unchanged.

When the retry also returns zero candidates and a recorder is present in deps, the recorder SHALL be invoked with a `RawIngredient` whose `name` is the **normalized** form (other fields preserved). When normalization yields no change (raw and normalized are equal), the recorder SHALL be invoked with the raw `RawIngredient` exactly as today.

#### Scenario: Comma-suffix normalization rescues a match

- **WHEN** the extractor returns `{ name: "Ingwer, fein gehackt", amount: 5, unit: "g" }` and the catalog has an entry whose canonical name is `"Ingwer"`
- **THEN** the use case performs two `searchByName` calls (first with `"Ingwer, fein gehackt"`, then with `"Ingwer"`) and the draft row is matched against the `Ingwer` entry with `amount: 5, unit: "g"`

#### Scenario: Recorder receives the normalized name on unmatched

- **WHEN** the extractor returns `{ name: "Rindertatar, frisch gewolft", amount: 200, unit: "g" }`, neither the raw nor the normalized name matches any catalog entry, and a recorder is present in deps
- **THEN** the recorder is called exactly once with a `RawIngredient` whose `name` is `"Rindertatar"` (the normalized form)

#### Scenario: No retry when raw and normalized are identical

- **WHEN** the extractor returns `{ name: "unicorn dust", amount: 1, unit: "tsp" }` and `searchByName("unicorn dust")` returns zero candidates
- **THEN** the use case performs exactly one `searchByName` call (no retry, since normalization yields `"unicorn dust"` unchanged)

#### Scenario: No retry when raw name already matches

- **WHEN** the extractor returns `{ name: "Ingwer", amount: 5, unit: "g" }` and `searchByName("Ingwer")` returns at least one candidate
- **THEN** the use case performs exactly one `searchByName` call and the row is matched

### Requirement: Strict-unmatched ingredients are forwarded to the unmatched-ingredient recorder

The AI recipe import use case SHALL invoke an `UnmatchedIngredientRecorder` port for every extracted ingredient whose `IngredientSearchService.searchByName` call against the FOODS source returns zero candidates. The recorder MUST receive the original `RawIngredient` (name, amount, unit, piece fields, raw display fields) as the LLM produced it, before any matching or defaulting. The recorder port SHALL be optional in the use case's dependency object so existing tests can omit it; when absent, the use case MUST behave exactly as today.

The use case SHALL NOT block the import response on the recorder. If the recorder throws, the use case MUST log the error and continue, returning the draft to the caller as if recording had succeeded.

The use case MUST NOT forward matched rows to the recorder, including rows that triggered `unitOverridden`, `pieceQuantityDropped`, or `untrackedInherited` flags — those are matches, not unmatched ingredients.

#### Scenario: Recorder invoked on strict-unmatched row

- **WHEN** the use case processes an extracted ingredient whose FOODS search returns zero candidates and a recorder is present in deps
- **THEN** the recorder's `record` method is called exactly once with the original `RawIngredient`
- **AND** the returned draft row is flagged unmatched as specified by the existing matching requirement

#### Scenario: Recorder not invoked on matched row

- **WHEN** the use case processes an extracted ingredient whose FOODS search returns at least one candidate
- **THEN** the recorder is not called for that ingredient, regardless of which post-match flags fire

#### Scenario: Recorder failure does not break import

- **WHEN** the recorder's `record` method throws or rejects during an import
- **THEN** the use case continues processing remaining ingredients, returns the full draft to the caller, and the failure is surfaced via the logger rather than propagated to the HTTP response

#### Scenario: Recorder absent from deps

- **WHEN** the use case runs without a recorder in deps
- **THEN** every ingredient is matched exactly as before and no recorder side effects occur
