## Context

The AI recipe import pipeline (`import-recipe-from-photos.use-case.ts`) already detects strict-unmatched ingredients: when `IngredientSearchService.searchByName(name, {'FOODS'})` returns an empty list, the row is flagged `matched: false` and surfaced for the user to fix manually. That moment is lossless today only at the per-import level — across imports, the signal disappears.

Meanwhile, the FOODS catalog is built by a single Opus-driven script (`build:foods`) that takes a hand-edited key list (`backend/scripts/foods-seed-keys.ts`) and generates `backend/data/foods.json` from scratch. There's no way to extend the catalog incrementally without manually editing the seed list and re-running a full regeneration.

Stakeholders: solo developer/user. Single-user app, JSON persistence, no DB, hexagonal backend with `domain/`, `infrastructure/`, `http/` layers. Backend uses Anthropic SDK (`@anthropic-ai/sdk`) — Opus for `build:foods`. Haiku model id is `claude-haiku-4-5-20251001`.

## Goals / Non-Goals

**Goals:**
- Turn recurring unmatched ingredients into permanent catalog improvements via a feedback loop that doesn't require code edits in the hot path.
- Keep the import response shape unchanged — recording is a passive side effect.
- Make the augment script safe by default: dry-run preview, human confirmation per item, atomic writes.
- Keep export and clear physically separate, so a partial download can never lose data.
- Preserve the invariant that `foods.json` is the source of truth, with `foods-seed-keys.ts` staying in sync so a future `build:foods` rerun reproduces the augmented catalog.

**Non-Goals:**
- No automatic merging of unmatched ingredients without human review.
- No retroactive re-matching of historical recipes when the catalog grows — user can re-import if they care.
- No analytics, no dashboards, no histograms — just a flat list with frequency counts.
- No multi-user concurrency model (single-user assumption holds).
- No edit/inspect UI for the collected store beyond Export + Clear — the augment script is the editing surface.
- No capture of matched-but-wrong cases (user picker swaps). Noted as a follow-up.

## Decisions

### 0. Name normalization on the match path

The vision LLM tends to bundle prep modifiers into the ingredient `name` field (`"Ingwer, fein gehackt"`, `"Knoblauchzehe, fein gehackt"`). Without intervention these produce strict-unmatched rows that the augment script would propose as new foods, when in fact the catalog already has `Ingwer` / `Knoblauchzehe`. Two layers of defense:

- **Source-of-truth fix at extraction**: the `extract-recipe-tool.ts` tool schema and system prompt require the `name` field to be the food noun only. Prep modifiers go into `steps`. Leading adjectives that change the food (e.g. "Zuckerfreier Ahornsirup", "Geräucherter Lachs") are kept.
- **Safety net in the matcher**: `matchIngredient` first searches with the raw name. If that returns zero hits, it computes `normalizeIngredientName(raw.name)` (strip trailing `, …` and `(…)`) and searches once more. If the second search matches, the row is matched. If it still doesn't, the **normalized** name (not the raw one) is what gets handed to `recorder.record`, so e.g. five variants of `Ingwer, …` dedupe to one `Ingwer` entry in the unmatched store.

Why not strip more aggressively (e.g. leading adjectives)? Because qualifiers like "Zuckerfreier" or "Geräucherter" change the nutrition profile; silently normalizing them would map distinct foods onto a single catalog id. The augment script's HITL prompt is the right place to resolve those — the user can flip the verdict to "synonym-of <parent>" or "new-food" per item.

Open follow-up (separate change, not blocking): preserve the stripped prep modifier as an optional `note` field on the recipe ingredient row, so the prep info survives into the saved recipe even when the source recipe doesn't repeat it in steps. Captured in user memory; out of scope here.

### 1. Capture site: inside the use case, behind a port

Add an `UnmatchedIngredientRecorder` port to `ImportRecipeFromPhotosDeps`:

```ts
interface UnmatchedIngredientRecorder {
  record(raw: RawIngredient): Promise<void>;
}
```

The use case calls `deps.recorder?.record(raw)` (fire-and-forget, awaited) only on the strict-unmatched branch in `matchIngredient`. The port is optional in `deps` so tests can omit it. The infrastructure adapter is a JSON-file repository.

**Why a port:** keeps domain code free of file I/O, matches the hexagonal pattern used elsewhere (`RecipeRepository`, `IngredientSearchService`). Recording stays a domain concern (which ingredient counts as unmatched) while *how* it persists is an adapter detail.

**Alternative considered:** record in the HTTP handler after the use case returns, by re-walking `draft.ingredients` for `matched: false`. Rejected: it duplicates the unmatched-detection rule that already lives in the use case, and would silently drop the original `RawIngredient` (the draft only carries the trimmed shape).

### 2. Storage shape

`backend/data/unmatched-ingredients.json`:

```json
{
  "entries": [
    {
      "name": "Buchweizenmehl",
      "foldedName": "buchweizenmehl",
      "count": 3,
      "firstSeenAt": "2026-05-16T09:12:00.000Z",
      "lastSeenAt": "2026-05-16T18:44:21.000Z",
      "samples": [
        { "rawName": "Buchweizenmehl", "rawUnit": "g" },
        { "rawName": "buckwheat flour", "rawUnit": "g" },
        { "rawName": "Buchweizenmehl", "rawDisplayUnitLabel": "EL" }
      ]
    }
  ]
}
```

- Dedupe key: `foldedName` (lowercase + NFD diacritic strip, identical to `index-food-entry.ts`'s folder). Reuse that helper rather than duplicating logic.
- `samples` is capped at 5 entries. New samples bump out the oldest when full. Each sample captures only what the LLM returned for that occurrence — never logs photos, never logs surrounding recipe context.
- `count` is the running total. We never drop entries automatically; the user clears explicitly.
- File is sorted by `foldedName` ascending before write so diffs are reviewable.

**Why a flat list:** matches the existing JSON-file pattern (`recipes.json`, `log-entries.json`). No DB engine is justified for a feature this small.

**Alternative considered:** append-only log of every unmatched event. Rejected: would grow without bound and require a downstream dedupe step in the augment script. Folding + count at write time keeps the file small and shaped for direct human review.

### 3. Read-modify-write with last-write-wins

Each `record()` reads the JSON, merges the new sample into the matching entry (or creates one), and writes it back. Writes happen one-at-a-time per process via a simple in-memory promise chain (`this.queue = this.queue.then(...)`).

**Why this is acceptable:** single-user app, single backend process. The same pattern is used by `recipes.json` writes today. A crash mid-write would corrupt the file, but the file is recoverable from `git` and a future loss of "the recipe import I just did" is acceptable. We can revisit if/when this app goes multi-tenant.

**Alternative considered:** SQLite. Rejected: violates "build only what's needed" — there's no second consumer that needs query power, and JSON keeps the file directly auditable.

### 4. HTTP surface: two endpoints, both auth-protected

```
GET  /unmatched-ingredients/export   → 200 { entries: [...] }   ; no side effects
POST /unmatched-ingredients/clear    → 204                       ; atomic truncate
```

Both routes mount inside the existing auth middleware. No new env vars. The export endpoint always returns 200 with `entries: []` when the store is empty (rather than 404) so the UI doesn't need to special-case zero.

The clear endpoint truncates the file to `{ "entries": [] }` atomically (write-then-rename) and returns 204. There is no "clear specific entry" endpoint — the augment script handles per-entry resolution offline.

**Why two endpoints not one with side effects:** if `GET /export` cleared on success, a flaky network or a cancelled download would drop data permanently. The two-button UI makes the user confirm the export is in hand before purging.

**Alternative considered:** `POST /export-and-clear` as a transactional combo. Rejected: same partial-failure problem, and "I want to look at the JSON without consuming it" is a real flow (e.g., during development).

### 5. Frontend: Export and Clear as adjacent but distinct actions

A small `UnmatchedIngredientsPanel` lives on the settings/admin surface (location decided during implementation — likely a section in an existing settings drawer or a new menu entry, not a dedicated route). Layout:

```
Unmatched ingredients (12 entries)

[ Export JSON ]   [ Clear ]
```

- **Export** triggers `GET /unmatched-ingredients/export`, then writes the response body to a download (`Blob` + temporary `<a download>`). Filename: `unmatched-ingredients-YYYYMMDD-HHMM.json` (timestamp in user's local tz).
- **Clear** opens a confirm dialog ("Permanently clear N collected ingredients?"); confirming calls `POST /clear` and refreshes the entry count via React Query.
- Both actions disabled (with tooltip) when the count is 0. The panel hides itself entirely if the backend returns 503 for the import endpoint (no `ANTHROPIC_API_KEY`), since unmatched collection can't happen there.

### 6. Augment script architecture

`backend/scripts/build-foods-augment.ts`. Usage:

```bash
pnpm --filter @forkcast/backend build:foods:augment <path-to-exported.json>
pnpm --filter @forkcast/backend build:foods:augment <path-to-exported.json> --dry-run
```

Flow:

1. **Load**: parse the exported JSON, load `backend/data/foods.json`, load `backend/scripts/foods-seed-keys.ts` (resolve via `import()` since it's a TypeScript module).
2. **Classify per item via Haiku**: for each unmatched entry, call `claude-haiku-4-5-20251001` with a tool-use schema that returns one of:
   - `{ verdict: 'synonym-of', existingId: string, confidence: 'high'|'medium'|'low' }`
   - `{ verdict: 'new-food', proposedKey: string }` (kebab-case, ASCII)
   - `{ verdict: 'skip', reason: string }`
   The user prompt includes the unmatched name and the full list of existing `{ id, name, synonyms }` triples from `foods.json` as context. Haiku is asked to favour `synonym-of` for clear near-matches and `new-food` otherwise.
3. **Prompt the user per item** (terminal, `node:readline`):
   ```
   [3/12] "Buchweizenmehl" (seen 3x; samples: g, g, EL)
     Haiku verdict: new-food (proposedKey: "buchweizenmehl")
     [a]ccept  [e]dit  [s]kip  [r]ename
     >
   ```
   - `accept`: keep the verdict as-is.
   - `edit`: switch verdict (e.g. flip new-food → synonym-of-<id>).
   - `skip`: drop this entry from the run (does not delete from the store; user can clear later).
   - `rename`: change `proposedKey` (for new-food) or `existingId` (for synonym-of).
4. **Apply accepted verdicts**:
   - `synonym-of`: append the unmatched name to the target entry's `synonyms` (dedupe case-insensitively against the existing canonical + synonyms; refuse to add a value that equals the canonical name).
   - `new-food`: call Opus (`claude-opus-4-7`) with the existing `build-foods-tool.ts` schema, requesting one entry for the new key (untracked flag derived from user choice during the prompt — default tracked, with an `[u]ntracked` modifier on the `edit` action). Validate the response with the existing `validate-food-entry.ts` rules; fail the run on schema error.
   - `skip`: no change.
5. **Write atomically** (only when not `--dry-run`):
   - Update `foods.json`: re-sort by `id`, run the full validator (the same one the loader uses), pretty-print with the existing `formatFoodsJson` helper (single trailing newline), write to `foods.json.tmp`, rename.
   - Update `foods-seed-keys.ts`: for each accepted `new-food`, append a line to the curated list. Strategy: parse the existing array via a regex that finds the `FOODS_SEED_KEYS = [` to closing `]` block, append before the closing bracket, preserving comments and grouping. Untracked new-foods use the `{ key: '...', untracked: true }` shape; tracked use the plain string. If parsing would be ambiguous, fail the run with a clear message asking the user to add the new keys manually (and report which).
6. **Print a summary**: counts of synonyms added, new foods added, skips. In `--dry-run` mode, the summary is the full output (no files written).

### 7. Why Haiku for classifier, Opus for nutrition

The classifier prompt is a structured comparison ("is this a synonym of one of these N existing foods?"). It's a high-volume, low-stakes call where Haiku's latency/cost wins matter more than the marginal accuracy. The nutrition drafting prompt is the same one `build:foods` uses; mixing models would risk per-100 macro drift between fresh-seeded entries and augmented ones. Keeping Opus for that call preserves consistency.

**Alternative considered:** Haiku for both. Rejected: macro accuracy is the hardest part of the catalog and the place where Opus actually earns its cost. The dollar delta on a handful of augment runs is negligible.

### 8. Validation gates

- The augment script reuses the existing `validate-food-entry.ts` to validate any entry it writes (newly drafted or modified-with-synonyms). A validation failure fails the run before any write.
- The script refuses to run if `foods.json` and `foods-seed-keys.ts` are not in a clean state (warning if `foods.json` has entries whose ids aren't in the seed list — indicates drift from a prior run).
- The `unmatched-ingredients.json` schema is validated on load by the backend (entries with non-string names or non-finite counts are skipped with a warning), but malformed export files passed to the augment script fail loudly.

## Risks / Trade-offs

- **[Risk] Concurrent imports racing on `unmatched-ingredients.json` writes** → Mitigated by the per-process write queue. Single-user app today; if multi-user comes later, switch to a small DB or a lock file.
- **[Risk] User runs `build:foods` (full refresh) after augmenting and loses synonyms not in `foods-seed-keys.ts`** → Mitigated by always updating the seed file in the same run. The seed file becomes the source of truth for which ids exist; the synonyms-on-existing-entries case is preserved because `build:foods` re-generates synonyms from Opus given the same id, and the augmented synonyms are now baked into the prompt instructions (no, that's not enough — Opus does not see the previously-saved synonyms). **Open item:** the full-refresh path loses augmented synonyms today. See "Open Questions".
- **[Risk] Haiku picks the wrong `existingId` for a synonym candidate** → Mitigated by the human-in-the-loop prompt: the user can override via `[e]dit`. Confidence is surfaced in the prompt output.
- **[Risk] `foods-seed-keys.ts` regex parsing is fragile** → Mitigated by a conservative parser that fails loudly when uncertain. Worst case the script writes `foods.json` and tells the user to add N specific keys to the seed list manually. Better than corrupting the seed file.
- **[Trade-off] No automatic re-import of historical recipes when the catalog grows** → Accept. The re-import path already exists (`POST /import-recipe-from-photos`), and the recipe list is small enough that the user can replay anything important.
- **[Trade-off] Two endpoints instead of one combined "export-and-clear"** → Accept. The extra round-trip is fine; the data-loss protection is the point.

## Migration Plan

- No data migration. The store is created on first write (`{ entries: [] }`).
- Backend changes are additive — the import response shape is unchanged. Old frontends will keep working; the panel is opt-in UI.
- Deploy steps: (1) merge backend recorder + endpoints; (2) merge frontend panel; (3) optionally export and run the augment script locally to seed the first round of synonyms.
- Rollback: revert. The JSON store is orthogonal to everything else and can be ignored or deleted.

## Open Questions

- **Full-refresh path and augmented synonyms**: today `build:foods` regenerates `foods.json` from scratch. After augmenting, the next full refresh would re-generate synonyms from Opus alone, without the augmented ones. Options to resolve later: (a) ship augmented synonyms back into the build-foods system prompt as exemplars; (b) post-process `build:foods` output by merging in augmented synonyms from a side file; (c) document that full refreshes shouldn't be run after augment cycles. Not blocking for v1; the augment script is the day-to-day path, full refresh is for catalog overhauls.
- **Pluralization vs synonym** (`Möhre` vs `Möhren`): the Haiku prompt should be instructed that simple plurals are synonyms, but edge cases may need user judgement. Defer to terminal prompts.
- **UI placement**: where exactly does the panel live in the frontend nav? Inline in an existing settings drawer is the lightest touch; finalized in implementation.
