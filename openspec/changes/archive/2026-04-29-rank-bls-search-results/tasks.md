## 1. Scoring function (TDD)

- [x] 1.1 Add `backend/src/domain/ingredient-search/score-bls-match.test.ts` covering: zero-score for non-match; tier ordering (exact > whole-word > prefix > token-start > substring); German-vs-English precedence (German tier dominates equal/weaker English tier; English exact still beats German substring); token-boundary characters (whitespace, `,`, `(`, `)`, `/`, `-`); inputs are already folded.
- [x] 1.2 Implement `scoreBlsMatch(entry: BlsIndexedEntry, foldedQuery: string): number` in `backend/src/domain/ingredient-search/score-bls-match.ts` returning the max of German/English tiered scores per the design (DE: 100/80/60/40/20, EN: 90/70/50/30/10).
- [x] 1.3 Run `pnpm --filter @forkcast/backend test` for the new file and confirm it passes.

## 2. Apply ranking in the BLS adapter

- [x] 2.1 Update existing `backend/src/infrastructure/ingredient-search/in-memory-bls.service.test.ts`: replace any assertions about alphabetical ordering with assertions covering ranking — exact match first, whole-word above token-start, length tiebreaker, top-20 cap selects highest-scoring entries.
- [x] 2.2 Refactor `InMemoryBlsService.searchByName` to compute `score = scoreBlsMatch(entry, q)` per entry, drop entries with `score === 0`, sort by `(score desc, name_de.length asc, name_de.localeCompare)`, then `slice(0, 20)` and `map(mapBlsEntry)`.
- [x] 2.3 Run `pnpm --filter @forkcast/backend test` and confirm all backend tests pass.

## 3. Verification

- [x] 3.1 Manually verify with `Hähnchenbrust`, `Reis`, `Möhre`, and `carrot` against the dev backend that the bare-ingredient entry now appears first.
- [x] 3.2 Run `pnpm --filter @forkcast/backend lint` and fix any issues.
- [x] 3.3 Run `openspec validate rank-bls-search-results --strict` and confirm it passes.
