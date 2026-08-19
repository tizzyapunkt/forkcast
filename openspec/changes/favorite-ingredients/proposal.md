## Why

The same handful of ingredients gets logged nearly every day (Skyr, Haferflocken, Hähnchenbrust). Today the only shortcut is the Recent tab, which is a mechanical recency list: it grows unbounded, reorders itself every time something else is logged, and cannot be curated. The one-off ingredient logged yesterday outranks the staple logged every morning. A user-curated favorites list makes the daily-driver foods reachable in one tap and keeps them in a stable place — the same problem exists when assembling a recipe, so the list must be available in the recipe ingredient picker too.

## What Changes

- New `Favorites` list of user-curated ingredients, persisted server-side so it is shared across devices and survives a reinstall.
- A favorite is a **snapshot** of `name`, `unit`, `macrosPerUnit` (plus `untracked`) — the same shape a recent or a log entry carries. Any pickable ingredient can be favorited regardless of its source (`CATALOG`, `OFF`, `SCAN`, `RECENT`); nothing is tied to a catalog entry id, so a later catalog edit or deletion leaves favorites intact, exactly as it leaves recipes and logged days intact.
- Favorite identity is `name` (case-insensitive) + `unit` — the identity rule already used by recently-used ingredients. Favoriting an ingredient that is already favorited refreshes its stored macros rather than creating a duplicate.
- A star toggle appears on every **search result row** and every **recent row**, in both the log drawer and the recipe ingredient picker. Tapping the star toggles favorite state without selecting the row.
- A new `Favorites` tab placed directly after Search: the log drawer's tabs read Search, Favorites, Recent, Recipes, Quick, and the recipe ingredient picker's read Search, Favorites, Recent. **Search stays first and stays the tab selected on open** in both surfaces.
- The favorites list is filterable client-side with the same fuzzy search the Recent tab uses.
- A favorite carries the **last used amount** — the `amount` of the most recent full log entry matching its identity — and picking it in the log drawer pre-fills the confirm step's amount input, the way a Recent pick already does. A favorite never logged yet has no last amount and opens with an empty input.
- Backend gains a favorites store (JSON file in the data directory, like every other repository) and three authenticated operations: list, favorite, unfavorite.

Non-goals: favoriting recipes (the Recipes tab is unchanged), reordering favorites by hand, folders/tags, and any favorites limit.

## Capabilities

### New Capabilities
- `favorite-ingredients`: a user-curated, server-persisted set of ingredient snapshots; the favorite/unfavorite operations, the list query enriched with last-used amount, the HTTP endpoints, the star toggle on search and recent rows, and the Favorites tab in the log drawer and recipe ingredient picker.

### Modified Capabilities
- `recently-used-ingredients`: the "Recent tab in the log drawer" requirement fixes tab order and position — Recent moves to third, behind the new Favorites tab, and the drawer's tab set now includes Favorites (and the already-shipped Recipes tab, which the current spec text predates). The star on Recent rows is specified by the new `favorite-ingredients` capability, not here.

## Impact

**Backend**
- New `backend/src/domain/favorite-ingredients/` (types, repository port, `favorite-ingredient`, `unfavorite-ingredient`, `list-favorite-ingredients` use cases), `backend/src/infrastructure/favorite-ingredients/json-favorite-ingredient.repository.ts`, `backend/src/http/favorite-ingredients/`.
- `backend/src/index.ts`: wire the new repository into `bootstrap` and register `GET /favorite-ingredients`, `POST /favorite-ingredient`, `POST /unfavorite-ingredient` behind the existing auth middleware.
- New `./data/favorite-ingredients.json`, constructed in `index.ts` like the other JSON adapters (no config change).
- The list query reads the log-entry repository as well, to derive `lastAmount` / `lastUsedAt` per favorite; the collapse-by-identity logic is extracted from `list-recently-used-ingredients.use-case.ts` and shared.

**Frontend**
- New `frontend/src/api/favorite-ingredients.ts`, `frontend/src/queries/use-favorite-ingredients.ts`, `frontend/src/queries/use-toggle-favorite-ingredient.ts`, `queryKeys.favoriteIngredients()`.
- New `frontend/src/features/log-ingredient/favorites-panel.tsx` and `favorite-star.tsx`; both consumed by `log-ingredient-drawer.tsx` and `recipes/recipe-ingredient-picker.tsx`.
- `search-panel.tsx` and `recent-panel.tsx` rows are restructured so the star is a sibling button of the row button (a button cannot nest inside a button).
- Log mutations (`use-log-ingredient`, `use-edit-log-entry`, `use-remove-log-entry`, `use-log-recipe`, `use-remove-recipe-log`) additionally invalidate the favorites key, since `lastAmount` / `lastUsedAt` are derived from log history.
- New German strings in `frontend/src/i18n/de.ts`.

**No impact on**: the food catalog, saved recipes, logged days, grocery lists, or any existing endpoint's contract.
