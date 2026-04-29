## Context

Today, ingredient search hits Open Food Facts only (`OpenFoodFactsService`), which is great for packaged products but thin on raw foods. The user works in German and the existing `IngredientSearchResult` is OFF-shaped (`offId: string`). The repo persists everything as JSON files; there's no DB engine and no plan to add one for this change.

The BLS 4.0 (2025) dataset is a CSV (`BLS_4_0_Daten_2025_DE.csv`, ~7,140 rows, semicolon-delimited, UTF-8 with BOM, CRLF) sitting at the repo root. It has ~150 columns; we only care about a handful (BLS code, German name, English name, kcal/100g, protein, fat, carbs).

Hexagonal architecture rules: BLS is an ingredient-source adapter behind the existing `IngredientSearchService` port. The aggregator that fans out to OFF + BLS is also an adapter; the domain stays unaware of how many sources exist or how they're stored.

## Goals / Non-Goals

**Goals:**
- Make BLS foods searchable via the existing `/ingredients/search` endpoint, returning results merged with OFF.
- Add explicit source attribution (`source: 'OFF' | 'BLS'`) to every search result, so the UI can render a small badge.
- Match the user's working language: case-insensitive, **diacritic-insensitive** substring matching against German + English names.
- Keep the change lean: no new database, no full-text search engine, no new runtime dependencies.
- Boot fast and search fast — sub-millisecond per query for ~7K rows is trivially achievable in-memory.

**Non-Goals:**
- No Postgres, no SQLite, no tsvector, no Lucene/MeiliSearch.
- No fuzzy matching, no synonyms, no stemming. Substring + diacritic folding only.
- No deduplication between OFF and BLS hits — informational duplicates are acceptable for MVP.
- No vitamin/mineral coverage, even though BLS has it. Calories + macros only for now.
- No barcode lookup against BLS (it has none).
- No editing of the BLS dataset by the user.
- No language toggle — German is the default working language; the OFF query already pins `lang:de`.

## Decisions

### D1. Build-time CSV → JSON, not runtime CSV parsing

A build script (`backend/scripts/build-bls-data.ts`, run via `pnpm --filter @forkcast/backend build:bls`) reads the CSV, picks the columns we need, drops calorie-less rows, and emits `backend/data/bls.json`. The generated file is committed to the repo.

**Why:** parsing a 1.7 MB semicolon-CSV with German floats (`,` decimals) on every boot is wasted work. Pre-baking it into JSON means cold start does a single `JSON.parse` on a much smaller artifact, the runtime has zero CSV-parsing code, and reviewers can `diff` the data shape directly.

**Alternative considered:** parse the CSV at boot. Rejected — extra surface for unicode/locale bugs, slower cold start, harder to test, and the CSV changes at most yearly.

### D2. In-memory linear search

`InMemoryBlsService` loads the JSON at boot into an array of `{ id, name_de, name_en, name_de_folded, name_en_folded, macrosPerUnit }`. Search is a single `Array.filter` doing substring match on the folded names.

**Why:** ~7K rows × ~50 char names × 2 folded forms ≈ 700 KB of strings. Substring scan is sub-millisecond. We don't need an index, a trie, or n-grams at this volume.

**Alternative considered:** Lunr/MiniSearch. Rejected — overkill for the dataset size, a new dep, and we'd need to re-tune scoring. We can add it later if relevance becomes a concern.

### D3. Diacritic folding via `String.normalize('NFD')` + combining-mark strip

Both indexed names and the query are folded with:

```ts
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
```

This is precomputed once per row at load time; query folding happens per request (cheap).

**Why:** `Käse` ↔ `kase`, `Möhre` ↔ `mohre`, `Püree` ↔ `puree`. Without this, German users typing on an English keyboard miss obvious results. `ß` is intentionally **not** mapped to `ss` in MVP — it's rarely typed differently than displayed in food contexts. We can revisit if it bites.

**Alternative considered:** explicit umlaut map (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`). Rejected for now — it's heavier and ä/oe/ue are typed less often than diacritic-stripping covers.

### D4. Generic `IngredientSearchResult` shape

```ts
export interface IngredientSearchResult {
  id: string;          // formerly `offId`
  source: 'OFF' | 'BLS';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
}
```

The existing `mapOffProduct` is updated to set `source: 'OFF'` and emit `id` instead of `offId`. The frontend list key becomes `${source}:${id}`.

**Why:** The existing field name lies once we have a second source. Renaming now is cheaper than living with a misleading field. No persisted data carries `offId`, so the change is contained to the search request/response shape.

**Alternative considered:** keep `offId` and add an optional `blsId`, plus a `source`. Rejected — sentinels for "the other source" produce ugly conditionals everywhere.

### D5. Composite aggregator service

A new `CompositeIngredientSearchService` implements `IngredientSearchService` by holding both `OpenFoodFactsService` and `InMemoryBlsService`, and:

- `searchByName(q)`: runs both in parallel via `Promise.allSettled`, returns `[...blsHits, ...offHits]`. If OFF rejects (network blip), BLS hits still come through.
- `searchByBarcode(b)`: delegates to OFF only. BLS has no barcodes.

The HTTP handler is unchanged — it depends on the port, not the adapter.

**Why:** preserves the port boundary. Hexagonal-purity bonus: we could swap the BLS adapter for a DB-backed one later without touching `search-ingredients.handler.ts`.

**Trade-off:** if OFF is slow, the response is OFF-slow. We could return BLS-first as a streaming response, but that's premature.

### D6. Result ordering: BLS first, then OFF

Within each source, current ordering is preserved (BLS sorted alphabetically by German name; OFF in API-returned order). Across sources, BLS comes before OFF because BLS targets the "raw food" gap that motivated this change — the user's most common miss.

**Why:** the search is most useful when the surfaced food matches what the user actually buys. Raw foods first is the right bias.

**Alternative considered:** interleave by relevance score. Rejected for MVP — we don't have a score, and a deterministic stable ordering is friendlier for tests.

### D7. Result limits

BLS returns at most 20 hits per query (matching OFF's `page_size=20`). Total response size ≤ 40. No pagination — the user is expected to refine the query.

### D8. Frontend badge

Inline pill next to the name, e.g.:

```
Käse, Camembert       BLS · 282 kcal / g
Camembert Géramont    OFF · 290 kcal / g
```

Tailwind: tiny uppercase chip, `BLS` accent in a muted neutral, `OFF` in a softer tone. Distinct enough to register at a glance, quiet enough not to add visual noise.

## Risks / Trade-offs

- **Stale data**: BLS 2025 is a static yearly snapshot. If a new BLS version drops, regenerating is one script run + commit. → Document the regeneration command in the README near the other scripts.
- **Locale-sensitive number parsing**: BLS uses `,` as decimal separator. → Build script normalizes `,` → `.` per cell before `Number(...)`, and rejects rows where any kept macro fails to parse. Tests cover both happy path and bad rows.
- **Encoding gotchas**: UTF-8 with BOM + CRLF line endings. → Build script strips the BOM and splits on `\r?\n`; verified against the actual file at design time.
- **`offId → id` rename ripples through the FE**: ~3 call sites (search panel, recipe ingredient picker, MSW fixtures). → Pure refactor; tests catch any miss.
- **Memory footprint**: <1 MB at runtime. Negligible.
- **OFF outage paints BLS-only results**: The aggregator uses `Promise.allSettled`. We log the failed source on the server but do not surface a partial-result error to the client; an empty OFF list is indistinguishable from "OFF found nothing." → Acceptable; revisit if the user complains about silent OFF outages.
- **No dedup**: A search for "Milch" returns BLS "Milch, Vollmilch, 3,5%" *and* OFF "Vollmilch 3,5%". → Acceptable for MVP; the source badge makes the distinction explicit.

## Migration Plan

No data migration. The change is additive:

1. Rename `offId → id` and add `source` to `IngredientSearchResult` (TS-only, both ends update together).
2. Ship the build script + `bls.json` in the same commit so the backend can boot.
3. The HTTP response shape gains a field and renames one — coordinated FE/BE PR. No runtime backwards-compat needed; this is a single-tenant personal app.

Rollback: revert the commit. JSON storage stays untouched — log entries persisted before the change have no relation to BLS or OFF identifiers.
