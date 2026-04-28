## Context

Today, every full ingredient added to the daily log goes through `SearchPanel` → OFF API → `FullEntryConfirm`. The `LogEntry` model already stores everything we need to reconstruct a "previously used ingredient": full entries persist `name`, `unit`, and `macrosPerUnit` (see `backend/src/domain/meal-log/types.ts`). Quick entries are free-form labels with hand-typed calories/macros and have no canonical identity, so they are out of scope for this feature.

The `LogEntryRepository` (`backend/src/domain/meal-log/log-entry.repository.ts`) currently exposes only `findByDate / findById / save / update / remove`. There is no "load all entries" path, but the JSON file infrastructure (`JsonLogEntryRepository`) already keeps the entire dataset in a single file, so an `findAll` extension is cheap.

The drawer (`frontend/src/features/log-ingredient/log-ingredient-drawer.tsx`) currently has two tabs (`'search' | 'quick'`). The product requirement places the new tab as the **second** tab; the user-facing order will be Search → Recent → Quick.

## Goals / Non-Goals

**Goals:**
- Provide a one-tap path to re-log any ingredient previously logged as a full entry.
- Local fuzzy search across the full list, no backend filter parameter.
- Sort by **last-used date** descending so the freshest staples come first.
- Fetch lazily — only after the drawer is open *and* the Recent tab is selected — to avoid a wasted request on every drawer open.
- Reuse the existing `FullEntryConfirm` step for amount entry & submit.

**Non-Goals:**
- No filters (slot, time-window, "last 30 days") in this change. The proposal explicitly defers these.
- No quick-entry recents (free-form labels with no canonical identity — would just clutter the list).
- No favoriting / pinning. Sort by recency only.
- No server-side search / pagination. The dataset is solo-use; the full list is small enough to ship in one response.
- No new persistence (no separate "ingredient catalog" table). The list is derived on read.
- **No separate Open Food Facts cache.** A dedicated OFF cache would be a different feature with different semantics (recently-*searched* vs. recently-*used*) and would duplicate fields the `LogEntry` already snapshots. If we later want offline OFF browsing, barcode-scan caching, or surfacing items the user searched but didn't log, that is a separate proposal — not folded into this one.
- No optimistic local update of the recents list when a new entry is logged (let React Query invalidation handle staleness if/when needed; for v1 the cache simply lives for the drawer's lifetime).

## Decisions

### 1. Read model: derive on the fly from `LogEntryRepository`

Add `findAll(): Promise<LogEntry[]>` to `LogEntryRepository`. `JsonLogEntryRepository` already loads the whole JSON file; the implementation is a one-liner. The new query `ListRecentlyUsedIngredients` filters to `type === 'full'`, dedupes, sorts, and returns.

**Why over a stored "ingredient catalog":** persistence today is a single JSON file, and total entries scale with personal use (hundreds per year, not millions). A full scan is fine and avoids a second source of truth that can drift. If volume ever justifies it, we can introduce an index without changing the API contract.

**Alternative considered:** add a dedicated `IngredientCatalogRepository` that's written to on each `LogIngredient` command. Rejected for v1 — extra write path, extra invariant to maintain, and no measured need.

### 2. Ingredient identity: `(name, unit)` tuple

Two log entries refer to the "same" ingredient when their `name` AND `unit` match (case-insensitive on `name`). When duplicates collide, keep the one with the **most recent** `loggedAt`, and surface its macros — that way macro corrections naturally propagate forward.

**Why not include `macrosPerUnit` in identity:** users can re-log the same product after the OFF entry was updated; treating those as different ingredients would clutter the list with near-duplicates.

**Why not use `offId`:** the current `LogEntry` model does **not** persist `offId` on full entries (see `FullIngredientEntry` in `meal-log/types.ts`). Adding it would be a bigger change and is unnecessary — name+unit is sufficient identity for personal use. If we later want exact-product identity, we can add `offId` as an optional field without breaking this contract.

### 3. Domain placement: new bounded slice `meal-log` (read side)

The query lives at `backend/src/domain/meal-log/list-recently-used-ingredients.use-case.ts`. It is a **CQRS read** that only depends on `LogEntryRepository`. It returns a new domain type:

```ts
interface RecentlyUsedIngredient {
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
  lastUsedAt: string; // ISO datetime, == max(loggedAt) across collapsed entries
}
```

It does **not** belong under `domain/ingredient-search/` — that bounded context is "search OFF for a new ingredient." Recents are a meal-log concern (they describe history, not catalog lookup).

### 4. HTTP shape

`GET /recently-used-ingredients` → `200 application/json` with body `RecentlyUsedIngredient[]`, sorted by `lastUsedAt` desc. No query params. Empty array on no history (not 404).

Handler at `backend/src/http/meal-log/list-recently-used-ingredients.handler.ts`, registered in `backend/src/index.ts`.

### 5. Frontend: lazy fetch + local fuzzy search

- New React Query hook `useRecentlyUsedIngredients` with `enabled: open && tab === 'recent'`. The `enabled` flag is what makes the request fire on tab-select rather than drawer-open. Stale time defaults are fine (5 min) — recents barely move during a single drawer session.
- Local fuzzy match: use `fuse.js` (small, well-known, ranked output). Threshold ~0.4 matches "oat" → "Oat milk". Search is recomputed on each keystroke against the in-memory list — no debounce needed since it's CPU-only and the list is small.
- The Recent tab panel renders a search input + result list visually similar to `SearchPanel` for consistency. Selecting a row fires `onSelect(result)` where `result` is shaped as `IngredientSearchResult` (synthesizing a stable client-side `offId` from `name|unit`) so it slots straight into the existing `FullEntryConfirm`.

**Alternative considered:** hand-rolled subsequence scorer instead of `fuse.js`. Rejected — fuzzy ranking is a solved problem, the dep is ~12 KB gzipped, and ranking quality directly affects UX.

### 6. Tab ordering and reset behavior

The drawer's `Tab` union becomes `'search' | 'recent' | 'quick'`. Render order in the tab bar: Search, Recent, Quick. Selecting a recent ingredient transitions to `step: 'confirm'` reusing the existing `selected` state slot. `handleTabChange` resets `step` and `selected` — same semantics as today.

Default tab on open stays `'search'`. (Switching the default to `'recent'` is tempting but a no-history user would land on an empty list; revisit later.)

## Risks / Trade-offs

- **[Inconsistent macros across history]** → If the same ingredient was logged once with stale OFF macros and again with corrected macros, the Recent row shows the most recent set. Accept — that is the desired "macro correction propagates forward" behavior. Edge case: user logs the wrong product under the right name; surfacing latest is still less surprising than surfacing oldest or averaging.
- **[Stale list during a session]** → If the user logs a new ingredient and re-opens the drawer, the Recent list won't reflect it until the cache invalidates. Mitigation: on successful `LogIngredient` mutation, invalidate `['recently-used-ingredients']`. (Captured in tasks.md.)
- **[Full-list payload grows unbounded]** → For a solo user this is hundreds of distinct ingredients at most. If it ever crosses a few thousand, add a `?limit=` and a server-side `LIKE` filter without changing the client contract.
- **[`fuse.js` dep weight]** → ~12 KB gzipped. Acceptable for a PWA. Alternative is hand-rolled, but ranking quality is worth the bytes.
- **[Identity collisions]** → Two genuinely different products that happen to share a name and unit collapse to one row. Extremely unlikely in solo use. If it happens, user can fall back to OFF search.

## Open Questions

- Should we also dedupe-aware **prefer the row whose macros most often appeared** (modal) instead of "latest wins"? Deferred — latest is simpler and matches user expectation that "I just corrected this."
- Empty-state copy for a brand-new user with zero full-entry history. Suggest: "No ingredients yet — log one from Search and it'll show up here." (Final wording can be set during implementation; not architecturally significant.)
