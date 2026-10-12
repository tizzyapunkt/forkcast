# Proposal

## Why

The browser demo runs the real backend in the visitor's browser. Two things stop that today: every persistence adapter reads and writes JSON files through `node:fs` directly, and all wiring (repositories, services, routes) lives in the `index.ts` boot script, so there is no way to build the same app with different adapters. This change removes both obstacles without changing day-to-day behavior, so the demo can swap adapters instead of forking code.

While every catalog adapter is being touched anyway, the two one-off migrations from the catalog's earlier file layout go too. The only deployment that needed them has already run them, and carrying them onto the new port would only add surface the demo has to work around.

## What Changes

- A `JsonDocument` port (read the stored text, or nothing when absent; write) that every JSON-backed adapter uses for persistence instead of `node:fs`.
- A file-system adapter for it, used by the self-hosted backend, with today's semantics: same paths, same formatting; every write becomes atomic (temp file + rename), as the catalog's already are.
- The JSON repositories (log entries, favorites, nutrition goal, body profile, weight log, recipes), the scanned-products store and the catalog store move onto the port. The catalog's "install the starting point only when no catalog exists" is expressed through the port too, so any adapter (and later the demo) gets the same rule.
- `index.ts` is split: a `createApp(deps)` factory builds the Hono app from its dependencies; `index.ts` only reads config, builds the file-system dependencies and serves the app.
- **BREAKING (for pre-rename data volumes only):** the one-off migrations are removed: adopting a pre-rename `foods.json` as the catalog, and folding the retired user-foods overlay (`user-foods.json`) into it, together with their `LEGACY_CATALOG_PATH` / `LEGACY_OVERLAY_PATH` settings. A volume that still holds only those files boots with the bundled starting point instead.
- No API or data format change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `food-catalog`: the requirement that an existing user-foods overlay is migrated into the catalog once is removed.

## Impact

- `backend/src/index.ts`, new `createApp` module, all files under `backend/src/infrastructure/*/json-*.ts`, `json-catalog.store.ts`, `backend/src/config/app-config.ts`, and their tests.
- Removed: `infrastructure/food-catalog/migrate-user-foods-overlay.ts`, `domain/food-catalog/merge-overlay.ts` and their tests.
- The existing repository and use-case tests must pass unchanged in intent; repository tests may gain an in-memory `JsonDocument` to run without disk.
- Unblocks `browser-demo`.
