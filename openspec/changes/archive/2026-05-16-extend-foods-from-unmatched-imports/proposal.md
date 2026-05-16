## Why

The AI recipe import flow regularly produces ingredient rows that don't match anything in the curated FOODS catalog — either because the food is genuinely missing, or because the name is a synonym the catalog hasn't been taught yet. Today these vanish: the user manually fills in the row in the review UI and the gap in the catalog stays open, so the same ingredient is unmatched again on the next import. We need a feedback loop that turns recurring misses into permanent catalog improvements without forcing manual key-list edits for every new food.

## What Changes

- Add a server-side collector that captures every **strict-unmatched** ingredient (extractor returned a name, search returned zero hits — *after* a normalization fallback, see below) during AI recipe import. Stored in a small JSON file (`backend/data/unmatched-ingredients.json`), deduped by folded name (lowercase + NFD diacritic strip), with `count`, `firstSeenAt`, `lastSeenAt`, and up to 5 sample raw payloads (`rawName`, `rawUnit?`, `rawDisplayUnitLabel?`) per entry.
- Tighten the extractor's `extract-recipe-tool.ts` schema + system prompt so the `name` field carries only the food noun. Preparation, cut, and quality modifiers (e.g. "fein gehackt", "geschält") must go into recipe `steps`, not into `name`. Leading adjectives that change the food itself (e.g. "Zuckerfreier Ahornsirup") are preserved.
- Add a defensive normalization step in the import use case: when `searchByName(raw.name)` returns zero hits, retry once with `normalizeIngredientName(raw.name)` — which strips trailing `, …` and `(…)` clauses. If the retry matches, the row is matched as normal. If still unmatched, the **normalized** name is what gets recorded into the unmatched store, so variants like `Ingwer, fein gehackt` / `Ingwer, geschält` dedupe to a single `Ingwer` entry.
- Add two HTTP endpoints, auth-protected like everything else:
  - `GET /unmatched-ingredients/export` — returns the collected JSON; **no side effects**.
  - `POST /unmatched-ingredients/clear` — atomically empties the store; called explicitly by the user.
- Add a small settings/admin UI surface with two distinct buttons: **Export** (downloads JSON) and **Clear** (with a confirm dialog). Decoupling them protects against partial-download data loss.
- Add a new build script `backend/scripts/build-foods-augment.ts` (exposed as `pnpm --filter @forkcast/backend build:foods:augment`) that reads an exported JSON file path and the current `backend/data/foods.json`, then for each unmatched ingredient:
  1. Calls **Haiku** (`claude-haiku-4-5-20251001`) with a classifier tool that returns one of: `{ verdict: 'synonym-of', existingId, confidence }`, `{ verdict: 'new-food', proposedKey }`, `{ verdict: 'skip', reason }`. Uses the existing FOODS catalog as context (canonical names + synonyms).
  2. Prompts the user in the terminal per item: `[a]ccept / [e]dit / [s]kip / [r]ename`. Edits let the user override the verdict, change the target id, or rename the proposed new-food key.
  3. For accepted `synonym-of` verdicts: appends the unmatched name to the target entry's `synonyms` array (deduped, never duplicates the canonical name).
  4. For accepted `new-food` verdicts: calls **Opus** (`claude-opus-4-7`, same model + tool used by `build:foods`) to draft a full `FoodEntry` (name, synonyms, unit, macrosPer100, optional pieces). Appends the resulting entry to `foods.json`.
- The augment script **extends** `foods.json` — it never overwrites unrelated entries. Output is re-sorted by `id` and re-validated against the existing food-entry schema before writing.
- The augment script also appends accepted new-food keys to `backend/scripts/foods-seed-keys.ts`, so a future full `build:foods` regeneration stays in sync. Existing entries in the seed list are untouched.
- Support a `--dry-run` flag on the augment script that prints the proposed diff (per-entry `add synonyms`, `add new food`, `skip`) without writing to either file.

## Capabilities

### New Capabilities
- `unmatched-ingredient-collection`: capture, expose, export, and clear the set of ingredient names that produced zero search hits during AI recipe import.

### Modified Capabilities
- `ai-recipe-import`: thread an "unmatched recorder" port into the import use case so every strict-unmatched ingredient is recorded as a side effect of matching, without changing the response shape.
- `curated-foods-source`: document the new `build:foods:augment` script as a second, additive build mode for `foods.json`, with its own validation rules (extends, never overwrites).

## Impact

- Backend
  - `backend/src/domain/ai-recipe-import/import-recipe-from-photos.use-case.ts` — invoke the unmatched recorder for each `RawIngredient` that produces zero search hits.
  - `backend/src/domain/ai-recipe-import/types.ts` — new port type for the recorder.
  - `backend/src/domain/unmatched-ingredients/` (new) — domain types, repository port, in-memory + JSON adapter.
  - `backend/src/infrastructure/unmatched-ingredients/` (new) — JSON-file adapter that follows the existing pattern (`backend/data/*.json`).
  - `backend/src/http/unmatched-ingredients/` (new) — `export` and `clear` handlers, wired into `index.ts` behind the same auth middleware as every other route.
  - `backend/src/bootstrap.ts` / `backend/src/index.ts` — construct the repository, wire it into the import use case deps and the new handlers.
  - `backend/scripts/build-foods-augment.ts` (new), `backend/scripts/build-foods-classifier-tool.ts` (new), and shared helpers extracted from `build-foods-helpers.ts` if needed.
  - `backend/package.json` — add `build:foods:augment` script.
- Frontend
  - `frontend/src/features/unmatched-ingredients/` (new) — small admin/settings panel with Export + Clear actions (vaul drawer or a section on an existing settings screen — TBD in design).
  - `frontend/src/api/unmatched-ingredients.ts` (new) — fetch wrappers for `GET /export` and `POST /clear`.
- Data
  - `backend/data/unmatched-ingredients.json` — new on-disk store. Initial content: `{ "entries": [] }`.
- No new external dependencies (Anthropic SDK already present). No DB engine.
- Risk: write contention on the JSON store if imports run concurrently — mitigated by single-user usage today and the existing per-file write pattern; design.md will spell out the read-modify-write rule.
- Risk: the augment script could write a `foods.json` that drifts from `foods-seed-keys.ts` — mitigated by always updating both files in the same script run, and validating the result against the existing schema before writing.
