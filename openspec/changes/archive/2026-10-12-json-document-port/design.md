# Design

## Context

See proposal.md for the motivation. Current state:

- Nine adapters touch `node:fs` directly: six plain repositories (log entries, favorites, nutrition goal, body profile, weight log, recipes), `JsonScannedProductStore`, `JsonCatalogStore` and `migrateUserFoodsOverlay` (removed by decision 6). Each takes a file path in its constructor.
- The six plain repositories share one shape: `init()` creates the directory, a read returns the parsed file or an empty value when the file is absent, and a write is `writeFile(JSON.stringify(x, null, 2))` with no temp file. They have no write queue.
- The scanned-products and catalog stores are stricter. They write a temp file and rename it, add a trailing newline, serialise writes through a promise queue, and treat a file that doesn't parse as empty with a warning. The catalog also holds its entries and search index in memory.
- On boot, `JsonCatalogStore.init()` creates the directory, adopts a legacy `foods.json` by renaming it, installs the bundled seed when no catalog exists (byte-for-byte `copyFile`, which a test checks), and then loads. `migrateUserFoodsOverlay` reads a legacy overlay file, merges it in and deletes it.
- `index.ts` builds everything, registers about 50 routes inline, and calls `serve()`. HTTP handler tests build their own small Hono apps, and nothing builds the full app in a test.
- Repository tests use real temp directories.

## Goals / Non-Goals

**Goals:**

- No module that `createApp` imports, directly or through the adapters it is given, needs `node:fs` or `node:path`.
- Self-hosted behavior stays the same: the same files, the same JSON formatting, the same boot sequence and log lines, the same seed handling. The only exception is the one-off legacy migrations, which are removed (decision 6).
- `createApp(deps)` takes ready-built ports and services. A test can build the whole app over in-memory documents and drive it over HTTP.

**Non-Goals:**

- Making the backend run in a browser. Other Node-only imports reached from `createApp` stay as they are: `node:crypto` in `domain/auth/auth.service.ts` and `domain/shopping/import-token.ts`, and `@hono/node-server`, which stays in `index.ts`. `browser-demo` deals with them.
- An IndexedDB adapter (that's `browser-demo`).
- Adding write queues to the six plain repositories, or changing their read-modify-write behavior.
- Changing data formats or file names. The config surface changes only by dropping the two legacy path settings.

## Decisions

### 1. The port works on text, not parsed JSON

```ts
// backend/src/infrastructure/json-document/json-document.ts
export interface JsonDocument {
  /** Where the document lives, for log and error messages (a file path, a store key). */
  readonly location: string;
  /** The stored text, or null when nothing is stored. */
  read(): Promise<string | null>;
  /** Replace the stored text. Durable once the promise resolves; never leaves a half-written document. */
  write(text: string): Promise<void>;
}
```

Each adapter keeps its own `JSON.parse` / `JSON.stringify`. The catalog and scanned stores therefore keep their "unparseable means empty, with a warning" handling and their trailing newline. The plain repositories keep throwing on corrupt JSON, as they do today. Seeding copies text unchanged, so the installed catalog stays byte-identical to the seed.

*Alternative considered:* `read(): Promise<unknown>` / `write(value: unknown)`. The port would have to choose one parse-error policy and one output format, which changes the behavior of either the plain repositories or the stricter stores. Rejected.

*Name:* it stays `JsonDocument`, as agreed. The document holds JSON text. The port doesn't parse it.

### 2. One file adapter, and all writes become atomic

`FileJsonDocument(path)` does two things:

- `read`: returns null when the file doesn't exist, otherwise `readFile` as UTF-8.
- `write`: runs `mkdir(dirname, { recursive: true })`, writes `<path>.tmp`, then renames it over `<path>`.

Making the directory on write replaces every adapter's `init()` mkdir. The six plain repositories become atomic as a side effect. That's strictly safer, nothing changes in what they write, and no reader can tell the difference.

*Alternative considered:* keep plain `writeFile` for those six. That would keep two write paths for no benefit. Rejected.

### 3. Adapters take documents, not paths

- `new JsonLogEntryRepository(doc)`, and the same for the other five repositories and `JsonScannedProductStore`. Their `init()` methods disappear, and they drop out of the `bootstrap([...])` list.
- `new JsonCatalogStore({ document, seed? })`, where `seed` is also a `JsonDocument`. `init()` keeps its order of authority, expressed through the port:
  1. An existing document wins.
  2. Otherwise, if a seed is given, its text is written to `document`. A seed with no content throws the same "cannot seed an empty catalog" error as today, built from `location`.
  3. Load.
  
  Log lines keep their wording, with `location` in place of the path.

Keeping seed handling inside the store, rather than in a file-system boot step, keeps one copy of the "install a starting point only when nothing exists" rule. `browser-demo` gets that rule for free: a demo session's empty IndexedDB document plus an in-bundle seed document gives the copy-on-write catalog the first exploration asked for.

*Alternative considered:* move seed handling out into a file-system `prepareCatalogFile()`, as proposal.md first sketched. The demo would then need its own seeding logic. Rejected, and proposal.md is updated to match.

### 4. `createApp(deps)` is a plain factory

```ts
// backend/src/app.ts
export interface AppDeps {
  auth: { password: string; jwtSecret: string };
  logEntries: LogEntryRepository;
  favoriteIngredients: FavoriteIngredientRepository;
  nutritionGoal: NutritionGoalRepository;
  bodyProfile: BodyProfileRepository;
  weightLog: WeightLogRepository;
  recipes: RecipeRepository;
  scannedProducts: ScannedProductStore;
  catalog: CatalogStore;                       // already initialised
  openFoodFacts: IngredientSearchService;
  diagnostics: DiagnosticsLog;
  ai: AiDeps | null;                           // null means the "not configured" handlers
}
export function createApp(deps: AppDeps): Hono;
```

- `AiDeps` holds the four already-built Anthropic adapters (recipe extractor, product extractor, resolution proposer, catalog drafter) and the image limits. The Anthropic SDK is imported only in `index.ts`, so `app.ts` never pulls it in.
- `createApp` builds `CatalogSearchService` and `CompositeIngredientSearchService` from `deps`, registers the middleware and every route in today's order, and returns the app. The order matters: the public routes come before `makeAuthMiddleware`.
- `index.ts` keeps reading config, building `FileJsonDocument`s from today's paths, running `bootstrap([catalogStore])`, the "AI not configured" warning, and `serve({ fetch: createApp(deps).fetch, port: 3000 })`.
- Where possible, the dependency types are the domain ports, not the concrete classes.

*Alternative considered:* a per-request dependency resolver, or AsyncLocalStorage. That isn't needed. The demo builds one app per browser. Rejected as speculative.

### 5. Tests

- **`FileJsonDocument`:** read when absent, write creates missing directories, no `.tmp` left behind.
- **`InMemoryJsonDocument`:** a small adapter in `infrastructure/json-document/`, used by tests now and available to `browser-demo`.
- **Repository and store tests:** keep their temp-directory integration style, constructed through `new FileJsonDocument(path)`. Their assertions don't change, and `catalog-seed.test.ts` still checks byte-identical seeding. The legacy-adoption and overlay-migration tests go with the code they cover (decision 6).
- **New `app.test.ts`:** builds `createApp` over in-memory documents and a stub OFF service. It logs in, logs an ingredient, reads the daily log and searches the catalog. This proves the factory works with no disk. Login uses a fixed password and secret from `deps.auth`.
- **`bootstrap.test.ts`:** it used repository `init()` to prove the data directory gets created. That job moved to `FileJsonDocument.write` and is tested there, so the bootstrap test now checks only `bootstrap`'s own contract: it initialises every part and rejects when one fails.

### 6. The one-off legacy migrations are removed, not ported

Two boot steps only existed to migrate the catalog's earlier file layout:
- adopting a pre-rename `foods.json` as the catalog;
- folding the retired user-foods overlay into the catalog (`migrateUserFoodsOverlay` and the domain merge `mergeOverlayIntoCatalog`).

The only deployment that had those files has already run both steps. So they are deleted, together with `LEGACY_CATALOG_PATH`, `LEGACY_OVERLAY_PATH` and their config fields, instead of moving onto the port. As a result, the port loses `remove()`: nothing else deletes a document. `browser-demo` can add it back if its "Reset demo" turns out to need it.

*Alternative considered:* port them as written, as the first version of this design did. That keeps code no volume needs, and an extra port method. Rejected at the author's request.

## Risks / Trade-offs

- [A route gets lost or reordered when moving out of `index.ts`] → Move the route list as a block, without rewriting it. `app.test.ts` covers one public route, one authenticated route and the auth wall. A manual smoke run (`scripts/smoke-backend.sh`) checks the rest against a real data directory.
- [A volume that still holds only a pre-rename `foods.json` or an unmigrated `user-foods.json` upgrades] → It boots with the bundled starting point, and the old files sit unread next to it. Nothing is deleted, so booting a release from before this change on that volume still migrates them. The only known deployment has already migrated.
- [A temp file plus rename on every write is slower for the plain repositories] → These are small single-user JSON files. It's negligible.
- [A Docker volume where `<path>.tmp` can't be renamed, for example across devices] → The temp file sits in the same directory as the target, as the catalog already does in production. No new risk.

## Migration Plan

There's nothing to migrate for any volume that has booted since the catalog was introduced. File names, contents and formatting don't change. Rollback means reverting the commit; the old migrations come back with it.
