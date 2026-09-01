## 1. Backend domain

- [x] 1.1 Extract the collapse-by-identity logic from `backend/src/domain/meal-log/list-recently-used-ingredients.use-case.ts` into a shared helper (`latestFullEntryByIdentity`) in the meal-log domain, keeping `list-recently-used-ingredients.use-case.test.ts` green unchanged
- [x] 1.2 Add `backend/src/domain/favorite-ingredients/types.ts`: `FavoriteIngredient` (`name`, `unit`, `macrosPerUnit`, optional `untracked`, `favoritedAt`), the listed shape adding optional `lastAmount` / `lastUsedAt`, and the identity key helper
- [x] 1.3 Add the repository port `favorite-ingredient.repository.ts` (`findAll`, `upsert`, `remove(name, unit)`)
- [x] 1.4 Write failing tests for `favoriteIngredient` use case: idempotent upsert refreshing macros and casing while keeping the original `favoritedAt`, same-name-different-unit stays separate, invalid payload (empty name, bad unit, negative/non-finite macros) rejected with the set unchanged
- [x] 1.5 Implement `favorite-ingredient.use-case.ts` until 1.4 passes
- [x] 1.6 Write failing tests for `unfavoriteIngredient`: removes by case-insensitive name + unit, succeeds on an absent identity, leaves the set unchanged in that case
- [x] 1.7 Implement `unfavorite-ingredient.use-case.ts` until 1.6 passes
- [x] 1.8 Write failing tests for `listFavoriteIngredients` (takes the favorites repo + `LogEntryRepository`): empty set, `lastAmount`/`lastUsedAt` from the most recent full entry, quick entries ignored, never-logged favorite omits both fields, sort order = used by `lastUsedAt` desc then never-used by `favoritedAt` desc
- [x] 1.9 Implement `list-favorite-ingredients.use-case.ts` on top of the 1.1 helper until 1.8 passes

## 2. Backend persistence and HTTP

- [x] 2.1 Write failing tests for `JsonFavoriteIngredientRepository` (missing file reads as empty, upsert replaces by identity, remove is a no-op for an absent identity, content survives a reload)
- [x] 2.2 Implement `backend/src/infrastructure/favorite-ingredients/json-favorite-ingredient.repository.ts` with an `init()` matching the other JSON adapters
- [x] 2.3 Add `backend/src/http/favorite-ingredients/` handlers for list, favorite, unfavorite — `400` on invalid payloads, `200` with `[]` for an empty list
- [x] 2.4 Wire into `backend/src/index.ts`: construct the repo with `./data/favorite-ingredients.json`, add it to `bootstrap([...])`, register `GET /favorite-ingredients`, `POST /favorite-ingredient`, `POST /unfavorite-ingredient` **below** `makeAuthMiddleware` so unauthenticated calls yield `401`
- [x] 2.5 Smoke-test the three endpoints against a running backend (favorite → list shows it with `lastAmount` after logging → unfavorite → list empty)

## 3. Frontend data layer

- [x] 3.1 Add `FavoriteIngredient` to `frontend/src/domain/` mirroring the backend listed shape
- [x] 3.2 Add `frontend/src/api/favorite-ingredients.ts` (`getFavoriteIngredients`, `favoriteIngredient`, `unfavoriteIngredient`) and `queryKeys.favoriteIngredients()`
- [x] 3.3 Add MSW handlers for the three endpoints in `frontend/src/test/msw/handlers.ts`
- [x] 3.4 Add `queries/use-favorite-ingredients.ts` (enabled flag, 5 min `staleTime`) and `queries/use-toggle-favorite-ingredient.ts` with an optimistic cache update, rollback on error, and invalidation on settle
- [x] 3.5 Add `queryKeys.favoriteIngredients()` to the invalidation lists in `use-log-ingredient`, `use-edit-log-entry`, `use-remove-log-entry`, `use-log-recipe`, `use-remove-recipe-log`
- [x] 3.6 Add the German strings (`favoritesPanel`, star `aria-label`s, tab labels for drawer and picker) to `frontend/src/i18n/de.ts`

## 4. Star toggle on ingredient rows

- [x] 4.1 Write a failing test for `FavoriteStar`: renders favorited/not-favorited state, `aria-label` names the action and ingredient, click fires the toggle and does not bubble to the row
- [x] 4.2 Implement `features/log-ingredient/favorite-star.tsx` (lucide `Star`, filled when favorited, icon-button sizing from the UI primitives)
- [x] 4.3 Restructure the `SearchPanel` row so the star is a sibling of the row button (`<li class="flex">` + `flex-1` button), keeping the source badge, kcal text, and untracked gating intact; the star stays enabled on gated rows
- [x] 4.4 Restructure the `RecentPanel` row the same way
- [x] 4.5 Extend `search-panel.test.tsx` and `recent-panel.test.tsx`: star reflects the cached favorites list, tapping the star favorites/unfavorites without selecting the row, a failed write reverts the star and surfaces an error
- [x] 4.6 Assert the gated case in `search-panel.test.tsx`: an untracked row keeps its row button disabled while its star stays operable and favorites the ingredient

## 5. Favorites tab

- [x] 5.1 Write failing tests for `FavoritesPanel`: loading, empty state pointing at the star (with the filter input still rendered), list order from the query, fuzzy filter (`skir` matches `Skyr`) with no network request, no-match state, select passes the result plus `lastAmount`
- [x] 5.2 Write failing tests for the two row variants: the drawer row shows `zuletzt <amount>` plus the energy density, a favorite with no `lastAmount` shows the not-yet-logged phrase instead, and the picker row shows neither
- [x] 5.3 Implement `features/log-ingredient/favorites-panel.tsx` mirroring `RecentPanel` (fuse.js over `name`, converts each favorite to an `IngredientSearchResult` with `source: 'RECENT'` and a synthetic id), with a prop selecting the two-line drawer row or the single-line picker row
- [x] 5.4 Render `FavoriteStar` on each Favorites row in the always-favorited state; removing drops the row from the list in place, and cover it in `favorites-panel.test.tsx`
- [x] 5.5 Add the `favorites` tab to `LogIngredientDrawer` in the order Search, Favorites, Recent, Recipes, Quick, keeping Search as the tab selected on open; pick pre-fills the confirm step with `lastAmount` and Back returns to the Favorites tab
- [x] 5.6 Add the `favorites` tab to `RecipeIngredientPicker` in the order Search, Favorites, Recent, keeping Search selected on open; picks open the amount step empty (unchanged from the Recent behavior)
- [x] 5.7 Enable the favorites query whenever the drawer or picker is open (needed for star state on the default Search tab) and assert in `log-ingredient-drawer.test.tsx` that the existing "no `/recently-used-ingredients` request on open" behavior still holds
- [x] 5.8 Extend `log-ingredient-drawer.test.tsx` and `recipe-ingredient-picker.test.tsx`: tab order and default tab, pick pre-fills (drawer) / opens empty (picker), Back returns to Favorites

## 6. Verification

- [x] 6.1 `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format` all clean
- [x] 6.2 Manual pass on a phone-width viewport: five tabs fit or scroll without wrapping, star touch target does not collide with the row tap area
- [x] 6.3 Manual pass: favorite from Search, confirm it appears in the Favorites tab, log it, reopen and confirm the amount pre-fills, unfavorite from the Recent tab and confirm it leaves the Favorites tab
- [x] 6.4 Fidelity pass against `design_handoff_favorite_ingredients/screens/` `1a`–`1e`: populated list, star in Suche, pre-filled confirm step with no chip selected, empty state, picker rows — spacing and type via tokens, no literal hex introduced
