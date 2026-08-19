## Context

See proposal.md — Why.

Relevant current state:

- `SearchPanel` and `RecentPanel` (both in `features/log-ingredient/`) are shared by two surfaces: `LogIngredientDrawer` and `RecipeIngredientPicker`. Each list row is today a single full-width `<button>` — a star cannot simply be nested inside it.
- Recently-used ingredients are derived on the fly from the log-entry repository (`listRecentlyUsedIngredients`), collapsing entries by `name.toLowerCase()|unit` and surfacing `lastAmount` / `lastUsedAt`. Favorites reuse that identity rule and that derivation.
- Every backend store is a JSON file adapter behind a domain port, constructed in `index.ts` with a hardcoded `./data/*.json` path and initialized through `bootstrap()`. All non-auth routes sit behind `makeAuthMiddleware`.
- Search results (`IngredientSearchResult`) carry `source: 'CATALOG' | 'OFF' | 'SCAN' | 'RECENT'` and an `id` whose meaning differs per source; recents already synthesize a fake id (`recent:<name>|<unit>`).

## Goals / Non-Goals

**Goals:**

- One shared favorites list behind a domain port, usable from both surfaces without either surface owning the state.
- Favorite state is readable from a search row without a per-row request.
- Star interaction never costs the user a mis-tap into the confirm step.

**Non-Goals:**

- Offline queueing of favorite toggles (the app's other mutations are online-only too).
- Migrating the existing Recent tab onto the favorites store, or capping/pruning either list.
- A generic "favoritable thing" abstraction covering recipes — see proposal Non-goals.

## Decisions

### Snapshot store keyed by `name|unit`, not a catalog reference

A favorite stores `{ name, unit, macrosPerUnit, untracked?, favoritedAt }`, with identity `name.toLowerCase()|unit`.

Rationale: it matches the established rule in this codebase — recipes and log entries already snapshot the ingredient rather than referencing the catalog, precisely so catalog edits and deletions cannot rewrite history (see `food-catalog` spec, "Deleting a catalog entry does not alter saved recipes or logged days"). Using the same identity as recently-used ingredients means one mental model, and it makes the star on a Recent row and the star on a Search row agree without any id translation.

Alternatives considered:

- *Catalog entry id.* Would let macro corrections flow through automatically, but excludes OFF and scanned results from being favorited at all, and would need a deletion cascade. Rejected — the user explicitly wants to favorite anything pickable.
- *Both (id when available, snapshot otherwise).* Two row kinds, two toggle-state lookups, two test matrices, for a benefit (auto-updating macros) that only helps catalog-sourced favorites. Rejected as premature.

Consequence: macros freeze at favoriting time. Mitigated by making the favorite write an idempotent upsert that refreshes macros — re-favoriting a stale entry costs two taps (unstar/star, or just star again from a fresh search result).

### `lastAmount` derived at read time, not stored

The list use case takes both the favorites repository and the `LogEntryRepository` and joins them in memory on the identity key, reusing exactly the collapse logic `listRecentlyUsedIngredients` performs.

Rationale: the log entries are the source of truth for "last used". Storing a denormalized `lastAmount` on the favorite would need write-through from four mutation paths (log, edit, remove, recipe log/unlog) and would silently drift the moment one is missed. The data volume is a personal log read fully into memory already; there is no performance case for denormalizing.

Alternative considered: reusing `listRecentlyUsedIngredients` verbatim and looking each favorite up in its output. That is the same cost, but drags the `RecentlyUsedIngredient` type into the favorites domain. Instead, extract the shared collapse into a small helper in the meal-log domain (`latestFullEntryByIdentity`) that both use cases call — one derivation rule, two consumers.

### Sort: used first by recency, then never-used by `favoritedAt`

A favorite the user actually logs is the one they want at the top. Never-used favorites (just starred from a search) still need a deterministic slot; newest-first puts a just-added favorite where the user will look for it. Pure `favoritedAt` ordering was rejected as it buries daily drivers under whatever was starred last; pure `lastUsedAt` ordering leaves never-used favorites unordered.

### Frontend: one query for the list, derived `Set` for star state

`useFavoriteIngredients()` fetches `GET /favorite-ingredients` into the React Query cache under `queryKeys.favoriteIngredients()`. `SearchPanel` and `RecentPanel` consume the same cached list and build a `Set` of identity keys to decide each row's star state — no per-row request, and one HTTP call shared by both panels and the Favorites tab.

This query is enabled whenever the drawer or picker is open, not only when the Favorites tab is selected — the star on Search rows needs it immediately. That deliberately differs from the Recent tab's lazy-fetch requirement, which stays untouched: recents can be large and are only needed on demand, whereas the favorites list is small and is needed to render the default tab correctly.

`useToggleFavoriteIngredient()` posts `/favorite-ingredient` or `/unfavorite-ingredient` and optimistically updates the cached list, rolling back and surfacing an error on failure (the spec requires the toggle to revert). It invalidates `queryKeys.favoriteIngredients()` on settle. The five log mutations add the same key to the `recentlyUsedIngredients` invalidation they already perform, since `lastAmount` is derived.

### Row markup: star is a sibling of the row button

Each row becomes `<li class="flex items-center"><button class="flex-1">…</button><FavoriteStar/></li>`. Nesting an interactive control inside a `<button>` is invalid HTML and produces unreliable click targeting, so the row button shrinks rather than wrapping the star. The star is an icon button (lucide `Star`, filled when favorited) with an `aria-label` naming the action and the ingredient, sized to the existing touch-target conventions.

Gated rows (`disableUntracked`) keep their disabled row button; the star stays enabled — favoriting an untracked ingredient is still meaningful in the recipe picker.

### `FavoritesPanel` mirrors `RecentPanel`

Same structure: fuse.js over `name` with the same options, same loading/empty/no-match states, same row shape. `onSelect(result, defaultAmount?)` matches `RecentPanel`'s signature so the drawer can reuse `handleRecentSelect` and the picker can keep ignoring the second argument — which is why the picker's amount step opens empty, consistent with how a Recent pick already behaves there.

A favorite is converted to an `IngredientSearchResult` with `source: 'RECENT'` and a synthetic id, exactly as `RecentPanel` does today, so the downstream confirm step needs no change. A dedicated `'FAVORITE'` source literal was considered and rejected: `source` drives the attribution badge and the search-source toggle, and adding a literal there would ripple into the backend's shared type for no user-visible gain.

## Risks / Trade-offs

- **Frozen macros drift from a corrected catalog entry** → re-favoriting is an idempotent upsert that refreshes them; the same trade-off already governs recipes and log entries.
- **Two lists (Favorites, Recent) look near-identical and may confuse** → the Favorites tab's empty state names the star explicitly, and favorites are user-chosen so the lists diverge in practice.
- **Optimistic toggle can flip back on a failed write** → the rollback is specified and tested; the row stays usable either way.
- **Five tabs crowd the drawer header on a narrow phone** → tab labels are short German words already in use (`Favoriten`); if it overflows, the tab bar gets horizontal scroll rather than a re-order, since the tab order is now spec'd.
- **A renamed catalog entry makes an old favorite look stale** (favorite keeps the old name) → acceptable; the favorite still logs correct macros, and unstar/star fixes it.

## Migration Plan

No migration. A missing `./data/favorite-ingredients.json` is created empty on first write, exactly as the other JSON adapters behave; a deploy without the file yields an empty Favorites tab. Rollback is removing the routes and the tab — no other data is touched, and the orphaned JSON file is inert.
