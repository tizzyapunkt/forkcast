## Context

`InMemoryBlsService.searchByName` filters the in-memory BLS index by a folded substring match across `name_de_folded` / `name_en_folded`, then sorts alphabetically by `name_de` and returns the first 20 results. Because the alphabetical sort is independent of how well an entry matches the query, single-word ingredients (e.g. the row literally named `Hähnchenbrust`) are routinely buried beneath dish-style entries that happen to contain the same word (`Hähnchengeschnetzeltes mit Hähnchenbrust …`).

The dataset is small (~10k entries) and already lives fully in memory, so per-query scoring across all matches is cheap and needs no new infrastructure (no Lunr, no SQLite FTS, no MiniSearch). A pure scoring function plus a different sort key is sufficient.

## Goals / Non-Goals

**Goals:**
- Most-specific name matches appear first for typical single-word queries.
- Deterministic ordering (no randomness; ties broken consistently).
- Pure, easily unit-testable scoring logic isolated from infrastructure.
- No change to API shape, query semantics, or 20-result cap.

**Non-Goals:**
- Multi-token / "all words must match" query parsing — explicitly deferred (single-substring matching stays).
- Fuzzy matching, typo tolerance, or stemming.
- Cross-source ranking (BLS-vs-OFF ordering stays as-is: BLS first, then OFF).
- Personalized ranking, recency, or usage-frequency boosts.
- Indexing / precomputed inverted indexes — unnecessary for this dataset size.

## Decisions

### Decision 1: Tiered integer score, higher is better

A new pure function `scoreBlsMatch(entry, foldedQuery): number` returns a non-negative integer score. Zero means "no match" (caller filters those out). The caller sorts descending by score, with `name_de.length` ascending as the tiebreaker.

Tier values (chosen so each tier dominates the next regardless of length):

| Tier | Match kind on `name_de_folded` | Score |
|------|-------------------------------|-------|
| 1    | Exact match (`name === query`) | 100   |
| 2    | Whole-word match (`\bquery\b`) | 80    |
| 3    | Prefix match (`name.startsWith(query)`) | 60 |
| 4    | Token-start match (start of any whitespace/comma/`(` / `)` / `/`-separated token) | 40 |
| 5    | Plain substring | 20 |

For matches that hit only `name_en_folded`, the same tier ladder is used but with values reduced by `10` (e.g. exact-en = 90, whole-word-en = 70, …, substring-en = 10). This guarantees any German match outranks any English match of an equal-or-weaker tier. (An English exact match still beats a German plain substring, which is the desired behavior — `carrot` should match `Karotte` strongly.)

The score per entry is `max(score_de, score_en)`.

**Why tiered integers over weighted sums of features?** Composite floating-point scores are harder to reason about and test, and the intuition the user described maps cleanly to ordered tiers. A change to one tier never silently re-orders another tier.

**Why 20-point gaps?** Leaves headroom to insert a tier later without renumbering, while keeping all values in a small, readable range.

### Decision 2: Tiebreaker is `name_de.length` ascending

Within a tier, shorter `name_de` wins. This naturally surfaces the bare ingredient (`Hähnchenbrust`) above composite names of the same tier (`Hähnchenbrust paniert mit Reis`). Final tiebreaker (when length is also equal) is `name_de.localeCompare`, so ordering remains deterministic.

### Decision 3: Token boundary definition

A "token boundary" inside a name is any position adjacent to one of: start-of-string, end-of-string, whitespace, `,`, `(`, `)`, `/`, `-`. Implementation uses a precomputed regex per query: `\b` is unreliable for non-ASCII because the query is folded (diacritics stripped, lowercased) but underscores/digits behave fine. We construct the regex from the escaped folded query with explicit boundary character classes:

```ts
const boundary = `(?:^|[\\s,()/-])`;
const wholeWord = new RegExp(`${boundary}${escaped}(?:$|[\\s,()/-])`);
const tokenStart = new RegExp(`${boundary}${escaped}`);
```

This is computed once per call and applied to all candidates.

### Decision 4: Scoring lives in the domain layer

`scoreBlsMatch` is placed in `backend/src/domain/ingredient-search/score-bls-match.ts` alongside `fold.ts`. It depends only on `BlsIndexedEntry` and a folded query string — no I/O, no framework. The `InMemoryBlsService` adapter calls it during the existing filter/sort step.

This keeps the rule "domain code has no technical dependencies" intact and makes the scoring trivially unit-testable.

### Decision 5: Filter and score in one pass

To avoid scanning the index twice, replace the current `.filter(...).sort(...).slice(20)` chain with a single `.reduce` that builds an array of `{ entry, score }` for entries with `score > 0`, then sorts and slices. For ~10k entries this is still O(n) work plus an O(k log k) sort where `k` is the number of matches.

## Risks / Trade-offs

- **Risk**: Existing tests that assert alphabetical order of BLS results will fail. → **Mitigation**: Update those tests to assert ranking order (or assert set membership where order is incidental). Audit during implementation.
- **Risk**: An entry whose German name is a near-duplicate of another (e.g. trailing comma variants) may now appear in a different position than users expect. → **Mitigation**: Length tiebreaker plus locale comparison keeps ordering deterministic; document the tiers in the spec so behavior is observable, not magical.
- **Trade-off**: A token-start hit in `name_de` (tier 4 = 40) outranks a substring hit, even if the substring hit is in a much shorter name. This is intentional — match quality dominates length. Length only breaks ties within the same tier.
- **Trade-off**: No multi-word query support means a search for `huhn brust` still does a literal substring lookup and likely returns nothing useful. Accepted; deferred to a later change.
