## Why

BLS ingredient search currently returns matches sorted alphabetically by German name. For common queries like `Hähnchenbrust`, this buries the obvious single-ingredient hit underneath dish-style entries that merely contain the word. Users expect the most specific, name-matching ingredient to appear first.

## What Changes

- Replace the alphabetical sort in the BLS in-memory search with a relevance-based ranking.
- Compute a tiered score per matched entry from highest to lowest:
  1. Exact match of the full name
  2. Whole-word match (token bounded by start/end or non-letter chars)
  3. Prefix match at the start of the name
  4. Token-start match (start of any whitespace/comma-separated token inside the name)
  5. Substring match (current behavior, lowest)
- Prefer matches in the German name (`name_de`) over the English name (`name_en`) when otherwise tied.
- Tiebreaker within the same tier: shorter `name_de` ranks higher.
- Keep query semantics (single substring, case- and diacritic-insensitive) and the 20-result cap unchanged; ranking only reorders which 20 results are returned and in what order.

## Capabilities

### New Capabilities
- _(none)_

### Modified Capabilities
- `bls-ingredient-source`: search result ordering is no longer alphabetical; it is now ranked by name-match relevance with German preferred over English. The 20-result cap now applies to the top-scoring entries rather than the alphabetically-first entries.

## Impact

- Code: `backend/src/infrastructure/ingredient-search/in-memory-bls.service.ts` (sort + slice change), new scoring helper in `backend/src/domain/ingredient-search/` (pure function, easy to unit-test).
- API: response shape unchanged; only result order changes.
- Frontend: no changes required.
- Tests: existing BLS service tests need updates where they assert ordering; new unit tests for the scoring function.
