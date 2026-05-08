## REMOVED Requirements

### Requirement: BLS dataset is loaded as a searchable in-memory ingredient source

**Reason**: The BLS 4.0 (2025) dataset is being retired. Its names, lack of synonyms, and absence of piece-weight references made it unsuitable as forkcast's primary ingredient catalog. It is replaced by a curated, AI-seeded food database (see capability `curated-foods-source`).

**Migration**: Remove the bundled CSV, the build script, the `data/bls.json` artifact, the `'BLS'` literal in `IngredientSource`, and the BLS in-memory adapter. Replace with the FOODS source documented in `curated-foods-source`. The composite ingredient search service is rewired to compose FOODS and OFF instead of BLS and OFF.

### Requirement: BLS name search is case- and diacritic-insensitive substring matching

**Reason**: Replaced by the equivalent requirement on the curated FOODS source, extended to also match against per-entry synonyms (see `curated-foods-source` → "FOODS name search is case- and diacritic-insensitive across canonical name and synonyms").

**Migration**: No data migration. The folding helper (`fold`) is retained and reused by the FOODS scorer.

### Requirement: BLS search results carry source attribution and macros

**Reason**: Replaced by the equivalent requirement on the curated FOODS source, with `source: 'FOODS'` instead of `source: 'BLS'` and a per-entry `unit` field (`'g'` or `'ml'`) instead of always `'g'` (see `curated-foods-source` → "FOODS search results carry source attribution and macros").

**Migration**: API consumers must update any string comparisons against `source === 'BLS'` to `source === 'FOODS'`. Result `unit` may now be `'ml'` for liquids, where it was always `'g'` under BLS.

### Requirement: Composite ingredient search merges BLS and OFF results

**Reason**: Replaced by an equivalent merge across FOODS and OFF (see `ingredient-search-source-toggle` → "Backend search endpoint accepts a `sources` query parameter" and "`IngredientSearchService.searchByName` accepts an optional source set"). The merge order remains "primary catalog first, then OFF" — the primary catalog is now FOODS, not BLS.

**Migration**: The composite service is rewired in `bootstrap`. The HTTP default applied when the `sources` query parameter is absent flips from `['bls']` to `['off']` (see `ingredient-search-source-toggle`).

### Requirement: Barcode lookup remains OFF-only

**Reason**: This requirement carries over verbatim under the FOODS source (see `curated-foods-source` → "Barcode lookup remains OFF-only"). It is removed here only because the `bls-ingredient-source` capability itself is retired.

**Migration**: No behavior change. The same barcode handler continues to delegate to OFF.

### Requirement: Search result limits are bounded per source

**Reason**: Replaced by the equivalent bound on the FOODS source (see `curated-foods-source` → "FOODS search result count is bounded"). The OFF page-size limit and the composite cap are unchanged.

**Migration**: None.

### Requirement: BLS search results are ranked by name-match relevance

**Reason**: Replaced by the equivalent ranking requirement on the FOODS source, extended with a canonical-over-synonym tier so a canonical-name match always outranks a synonym match at the same tier (see `curated-foods-source` → "FOODS search results are ranked with canonical-over-synonym tiering").

**Migration**: The five-tier scoring algorithm is reused as-is. The German/English tier-value pair (`{ exact: 100, … }` vs `{ exact: 90, … }`) is repurposed: canonical names use the higher pair, synonyms use the lower pair.

### Requirement: BLS search ties are broken by name length, then locale order

**Reason**: Replaced by the equivalent tie-break rule on the FOODS source (see `curated-foods-source` → "FOODS search ties are broken by canonical name length, then locale order").

**Migration**: None.

### Requirement: Frontend renders source-attribution badge per result

**Reason**: Replaced by the equivalent badge rule on the FOODS source, with the `BLS` badge label replaced by `FOODS` (see `curated-foods-source` → "Frontend renders source-attribution badge per result").

**Migration**: Update the badge rendering and the React list key prefix from `BLS:${id}` to `FOODS:${id}`.

### Requirement: Generic search-result shape replaces OFF-specific field

**Reason**: Replaced by the equivalent shape requirement on the FOODS source, restricting the `source` discriminator to `'FOODS' | 'OFF'` (see `curated-foods-source` → "Generic search-result shape exposes FOODS and OFF as the only sources").

**Migration**: Update the `IngredientSearchResult` type and any consumer code that pattern-matches on `source === 'BLS'`.
