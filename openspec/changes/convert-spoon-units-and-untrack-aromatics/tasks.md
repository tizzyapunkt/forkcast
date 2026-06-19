## 1. Catalog `density` field (backend domain)

- [x] 1.1 TDD `domain/foods/validate-food-entry.test.ts`: `density` is optional; when present must be a positive finite number (reject `0`, negative, NaN, non-number); absent passes. Implement in `validate-food-entry.ts` and add `density?: number` to `FoodEntry` (`domain/foods/types.ts`)
- [x] 1.2 TDD `domain/foods/map-food-entry.test.ts`: `density` carries through to `IngredientSearchResult` when present, omitted otherwise. Add `density?: number` to `ingredient-search/types.ts` and map it in `map-food-entry.ts`

## 2. Spoon→ml conversion (backend domain)

- [x] 2.1 TDD `domain/ai-recipe-import/convert-spoon-amount.test.ts`: label table (TL/Teelöffel/tsp=5, EL/Esslöffel/tbsp=15, Tasse/cup=240; case/diacritic/trim tolerant; unknown → undefined) and `convertSpoonToAmount(rawDisplayAmount, rawDisplayUnitLabel, unit, density?)` — ml-unit returns volume; g-unit returns volume×density only with density else undefined; missing/zero amount defaults handled; result rounded to 1 decimal
- [x] 2.2 Implement `convert-spoon-amount.ts`

## 3. Wire conversion into the matched-row builder

- [x] 3.1 TDD `domain/ai-recipe-import/build-matched-row.test.ts`: add `density` to `MatchSourceFood`; tracked g-unit + density + "2 TL" → converted `amount`, no `displayQuantity`, `missingAmount` false; tracked ml-unit + "2 EL" → 30, no density needed; tracked g-unit no density + spoon → `amount` null, `missingAmount` true (unchanged); non-spoon label → unchanged/`missingAmount`; stated canonical `amount` wins (no conversion); untracked branch unchanged
- [x] 3.2 Implement: add `density?` to `MatchSourceFood`, convert in the tracked path of `buildMatchedRowWithFlags`
- [x] 3.3 Plumb `density` into `MatchSourceFood` at both call sites: `import-recipe-from-photos.use-case.ts` (from `top.density`) and `food-resolution/confirm-resolution.use-case.ts` synonym path (from the curated `findById` result); confirm the curated `findById` returns `density`

## 4. Build tooling + prompts (optional density on generated entries)

- [x] 4.1 Add optional `density` to the entry schema in `build-foods-tool.ts` and `resolution-tool.ts` with a short description; add a one-line prompt note (only for spoon-measured dry staples) so regenerations may populate it. No behavior change when omitted

## 5. Seed data

- [x] 5.1 `scripts/foods-seed-keys.ts`: change `ingwer` and `knoblauch` to `{ key, untracked: true }`
- [x] 5.2 Hand-edit `data/foods.json` (committed source of truth): set `ingwer`/`knoblauch` to `untracked: true` with all-zero `macrosPer100` (drop `pieces`); add `density` to the spoon-measured dry staples (`speisestärke`, `weizenmehl-405`, `dinkelvollkornmehl`)

## 6. Verify

- [x] 6.1 `make check` green (lint + typecheck + fmt-check + tests, both workspaces)
- [ ] 6.2 `openspec validate convert-spoon-units-and-untrack-aromatics --strict` from repo root — _openspec CLI not installed in this environment; deltas authored to match the existing `## ADDED`/`## MODIFIED Requirements` + scenario format_
- [ ] 6.3 Browser smoke (`make dev-http`) — _not run: needs a real `ANTHROPIC_API_KEY` for the extraction call; `make smoke` (non-AI resolution round-trip) passed and confirms the edited `foods.json` loads_
