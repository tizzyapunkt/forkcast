## 1. Confidence in the scorer (domain, TDD)

- [x] 1.1 In `score-food-match.test.ts`, add failing tests for a new `matchFoodEntry(entry, foldedQuery)`, one per spec scenario of "Import auto-matches confident name matches only":
  - Honig/Honigmelone and Reis/Reisnudeln are partial
  - Kichererbse/Kichererbsen and Ei/Eier are confident
  - Peanut-butter-Pulver vs Butter is partial, and Bio-Tomaten vs Tomaten is confident
  - Kichererbsen (aus der Dose, abgetropft) vs Kichererbsen is confident
  - Erdnussmus as a synonym is confident
  - Butter vs Erdnussbutter is partial

  Also assert that every existing tier score is unchanged. Verify they fail with `pnpm --filter @forkcast/backend test score-food-match`.
- [x] 1.2 Implement `matchFoodEntry` returning `{ score, confident }`, with `scoreFoodMatch` delegating to it, per design Decisions 1–2. Verify the 1.1 tests and all existing scoring tests pass.

## 2. Results carry the confidence

- [x] 2.1 Add optional `matchConfidence: 'confident' | 'partial'` to `IngredientSearchResult`. Add failing tests:
  - `rankIndexedFoods` sets it per result, in unchanged order
  - the composite service's SCAN name search sets it

  Verify they fail.
- [x] 2.2 Set the field in `rank-food-entries.ts` and in `searchScannedByName`. Verify the 2.1 tests pass and the existing search suites are unchanged.

## 3. Import accepts confident candidates only

- [x] 3.1 In `import-recipe-from-photos.use-case.test.ts`, add failing tests for the modified scenarios:
  - Honig with only a partial Honigmelone → unmatched, with provenance `candidates[0]` = Honigmelone and `chosen: null`
  - Peanut-butter-Pulver with a partial Butter → unmatched
  - partial catalog hits fall through to a confident SCAN `Reis`
  - a confident candidate ranked below a partial one is chosen
  - the normalized retry runs when the raw name has only partial hits
  - a result without `matchConfidence` still matches (fakes and back-compat)

  Verify they fail.
- [x] 3.2 Change the cascade in the use case: find the first confident candidate across CATALOG → SCAN, then the normalized retry; keep the first tier's partial candidates for an unmatched row's provenance. Verify the 3.1 tests pass and the existing use-case suite is green.

## 4. Verification

- [x] 4.1 Run `make check` and verify it is green.
- [x] 4.2 Run the real import on `rezepte/IMG_7376.jpeg` against the dev backend. Verify:
  - `Honig` and `Peanut-butter-Pulver` land in the unmatched panel, not on Honigmelone or Butter
  - Sojasauce, Hähnchenbrust, Erdnussmus → Erdnussbutter (synonym) and the counted foods still match

  Verified without the browser (the Chrome extension was disconnected). I ran the real catalog ranking plus the import's confidence rule against the dev catalog, using the 24 ingredient names Haiku produced for IMG_7369/IMG_7376 in earlier runs.
  - `Honig` (was Honigmelone) and `Peanut-butter-Pulver` (was Butter) are now unmatched, with the rejected candidate kept.
  - The other 22 are unchanged, including synonym and inflection matches: Erdnussmus → Erdnussbutter, Ei → Hühnerei, Kichererbse → Kichererbsen, Reis → Weißer Reis, Salatgurke → Gurke.
  - `Frischkäse, 0,2 % Fett` still lands on Doppelrahmstufe through the normalized retry. That's out of scope (a qualifier problem).
- [x] 4.3 Run `openspec validate confident-import-matches --strict` and verify it passes.
