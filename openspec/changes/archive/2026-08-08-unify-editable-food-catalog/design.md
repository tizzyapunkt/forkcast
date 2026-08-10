## Context

See proposal.md — Why. The constraints that shape the approach:

- `backend/docker-entrypoint.sh:4` runs `cp /app/backend/foods.json.img /app/backend/data/foods.json` unconditionally on every start. This single line is why FOODS is read-only at runtime and why the overlay exists at all.
- The two stores already share an entry shape. `FoodEntry` in `foods.json` and the overlay's `foods[]` are validated by the same rules; merging is a union, not a conversion.
- Every data file in `backend/data/` is tracked in git, including genuinely runtime state (`log-entries.json`, `recipes.json`). A tracked, runtime-writable catalog is consistent with the existing convention rather than a new one.
- Recipes and log entries store macro **snapshots** (`RecipeIngredient`, `FullIngredientEntry` — neither holds a `foodId`). Nothing downstream references a catalog entry by identity, which is what makes hard deletion safe.
- Single user, single process, no concurrent editing (confirmed with the user). Atomic file writes are sufficient; no locking or conflict resolution.
- The AI drafting module is currently shared between the runtime resolve flow and the `build:foods` script. Deleting the script leaves the module with one consumer, and this change adds a second (the catalog manager's fill action).

## Goals / Non-Goals

**Goals:**

- One store, one source literal, one place to fix a bad entry.
- A deploy can never destroy catalog data — the failure mode that today's entrypoint guarantees.
- Dev and production behave identically at boot, so seeding is exercised on every `pnpm dev` against a fresh checkout rather than only in a container.
- Delete the round-trip pipeline outright rather than leaving dormant scripts behind.

**Non-Goals:**

- Per-entry history, audit trail, or undo. A snapshot export is the recovery mechanism.
- Bulk edit, import-a-catalog-file, or merge-two-catalogs flows.
- Pagination or server-side filtering in the manager — ~190 entries render and filter client-side without trouble.
- Any change to import extraction or the review screen (that is `show-import-match-provenance`).

## Decisions

### Rename the artifact to `catalog.json`, seed from a tracked repo copy

Runtime catalog lives at `<dataDir>/catalog.json`. The repo's tracked `backend/data/catalog.json` (a `git mv` of today's `foods.json`, plus the migrated overlay content) doubles as the committed starting point. The Dockerfile copies it to `/app/backend/catalog.seed.json`, outside the volume, exactly as it copies `foods.json.img` today.

Renaming rather than keeping `foods.json` is deliberate: `source: 'CATALOG'`, the `catalog` query value, and the file should agree, and this change is already breaking those identifiers. *Alternative considered:* keep the filename to shrink the diff — rejected, it leaves the ubiquitous language split between "foods" on disk and "catalog" everywhere else, which is the exact confusion this change exists to remove.

### Seed-if-absent lives in application boot, not the entrypoint

The entrypoint stops copying entirely. The backend, at startup, checks for `<dataDir>/catalog.json` and installs the bundled seed only when it is missing. *Alternative considered:* `cp -n` in the entrypoint — rejected, because dev has no entrypoint, so the seeding path would only ever run in production, and the one behaviour whose failure destroys data would be the one never exercised by tests. In Node it is covered by the same test suite as everything else.

The seed path is injected as configuration so tests can point it at a fixture, and so a missing seed in dev is a clear startup error rather than an empty catalog.

### Migration runs once, keyed on the legacy file's existence

At boot, if `<dataDir>/user-foods.json` exists: merge its `foods[]` (skip id collisions, log a warning) and its `synonyms[]` (dedupe case-insensitively, skip orphans with a warning) into the catalog, write the catalog atomically, then delete the legacy file. Absence of the file is the "already migrated" marker — no extra flag, no schema version. The merge is idempotent, so a crash between write and delete replays harmlessly.

*Alternative considered:* a one-shot CLI migration — rejected, it would need to be run manually on the home server at exactly the right moment during deploy, and forgetting it silently loses the confirmations.

### Domain-language commands, not REST resources

Per CLAUDE.md's API design rule and the existing endpoint style (`/import-recipe-from-photos`, `/confirm-ingredient-resolution`):

- `GET /catalog` — the full list for the manager
- `POST /add-catalog-entry`, `POST /update-catalog-entry`, `POST /remove-catalog-entry`
- `GET /export-catalog` — snapshot, no side effects
- `POST /draft-catalog-entry` — the AI fill

Search continues to go through `GET /search-ingredients?sources=catalog`. The manager's list endpoint is separate from search on purpose: search is ranked, capped at 20, and folded; the manager needs the unranked whole.

### The AI fill gets its own narrow endpoint

This resolves the question left open during exploration. `POST /draft-catalog-entry` takes `{ name }` and returns one candidate entry (unit, synonyms, per-100 macros). It reuses the shared drafting module — same model, tool schema, and system prompt as the resolve flow — but not `propose-resolutions`, which answers a different question (batch triage of unmatched import lines: *is this a synonym of an existing food, or a new one?*). The manager's form already knows it is creating a new entry; routing it through the triage endpoint would make it interpret and discard a `synonym-of` verdict it has no use for.

Macro fields populated by a fill are marked as estimates in the UI, reusing the existing estimate affordance from `NewFoodEditor`.

### Ids are derived from the name, collisions rejected

A created entry's `id` is the folded, ASCII kebab-case slug of its canonical name. A slug that already exists is a `400` (create) or `409` (resolution confirm, preserving today's contract) rather than being silently suffixed — a duplicate id almost always means the user is re-adding something that already exists, and the right answer is to edit that entry instead. The manager surfaces the existing entry when this happens.

Ids are immutable once created. Renaming an entry changes `name`, never `id`; nothing references ids across stores, so a stale-looking id is harmless.

### Search index rebuild strategy

Every accepted write rebuilds the in-memory index from the catalog. At ~190 entries this is microseconds and removes a whole class of bugs where the index and the file disagree — notably the current `synonym-of` path, which has to register a synonym on the live index *and* append it to the overlay as two separate steps.

## Risks / Trade-offs

- **A bug in seed-if-absent overwrites a live catalog** → the highest-consequence failure in this change. Mitigated by putting it in Node under test (explicit cases: absent → seeded; present → byte-identical after boot; present-but-empty-array → left alone), and by the deploy order below, which takes a snapshot before the first restart.
- **The volume becomes the sole home of the catalog** → accepted by the user, who backs the volume up. Additionally mitigated by the snapshot export and by the repo's tracked `catalog.json`, which can be refreshed from a snapshot at any time.
- **Deleting an entry loses hand-corrected macros with no undo** → deletion requires explicit confirmation, and the snapshot export is the recovery path. Not mitigated further by design (no tombstones — an explicit decision).
- **A recommitted starting point never reaches a running instance** → correct and intended, but surprising. Called out in the settings panel copy: the snapshot is for backup and fresh installs, not for pushing changes into a live app.
- **`source` narrowing is a wide mechanical diff** → touches both workspaces. Mitigated by making it a type-level break: narrowing the union turns every stale `'FOODS'` / `'USER'` literal into a compile error rather than a silent runtime mismatch.
- **Two AI entry points into the catalog (resolve flow, fill action) can drift** → both call the one shared drafting module; the module keeps a single prompt and tool schema.

## Migration Plan

1. Ship the change. On the first start the backend finds an existing `data/foods.json`, treats it as the catalog (rename-on-read), folds in `user-foods.json`, writes `catalog.json`, and deletes the legacy overlay file.
2. Before deploying, take a manual copy of the volume's `foods.json` and `user-foods.json` — the one-time safety net for step 1.
3. After the first successful boot, export a snapshot from Settings and commit it as `backend/data/catalog.json` so the repo's starting point reflects the merged reality.

**Rollback:** redeploy the previous image and restore the two files copied in step 2. The previous image's entrypoint will overwrite `foods.json` from the image on start — which is the old (destructive) behaviour, so the restored copy must be put in place *after* that container is running, or the restore must target `user-foods.json` only and accept the image's `foods.json`.

## Open Questions

- Whether the catalog manager should offer a "duplicate this entry" shortcut for near-identical foods (e.g. two yoghurt variants). Deferrable: it is additive, changes no requirement, and is better judged after the manager has been used.
