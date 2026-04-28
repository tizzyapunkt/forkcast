## Why

The Open Food Facts search is the only way to add a full ingredient today, but most days the user logs the same handful of staples (oats, chicken breast, skyr, …). Re-querying OFF and re-confirming macros every time is slow and noisy. A "recently used" tab inside the log drawer gives one-tap access to anything the user has ever logged before, removing the network round-trip and the cognitive cost of picking the right OFF result.

## What Changes

- New backend capability: list distinct ingredients the user has previously logged, sorted by date of last use (descending).
- New `GET /recently-used-ingredients` endpoint returning the full list (no pagination, no server-side filtering for now).
- New domain query (CQRS read side) `ListRecentlyUsedIngredients` that aggregates over `LogEntryRepository`, deduping full entries by ingredient identity.
- New frontend tab "Recent" inside the log drawer, positioned **second** in the tab bar (between Search and Quick).
- List is fetched **on demand**: the query fires the first time the drawer is open *and* the Recent tab is selected. It is not prefetched when the drawer opens on another tab.
- Local fuzzy search over the fetched list (no server round-trip per keystroke). Selecting a recent ingredient flows through the existing `FullEntryConfirm` step.

## Capabilities

### New Capabilities
- `recently-used-ingredients`: list distinct ingredients previously logged as full entries, sorted by last-used date, searchable client-side. Powers the "Recent" tab in the log drawer.

### Modified Capabilities
<!-- No existing specs in openspec/specs/ yet, so nothing to modify. -->

## Impact

- **Backend**
  - New domain query under `backend/src/domain/meal-log/` (or a new `recently-used-ingredients` folder — to be decided in design).
  - New HTTP handler under `backend/src/http/meal-log/`.
  - New route registration in `backend/src/index.ts`.
  - No persistence change: derived from existing `LogEntryRepository.findByDate`-style reads (or a new repository method if a full scan is required).
- **Frontend**
  - New feature folder or files under `frontend/src/features/log-ingredient/` for the Recent tab panel and local fuzzy search.
  - New React Query hook (e.g. `useRecentlyUsedIngredients`) under `frontend/src/queries/`.
  - New API client function in `frontend/src/api/client.ts`.
  - Modified `log-ingredient-drawer.tsx`: third tab `'recent'`, ordered Search → Recent → Quick.
  - New runtime dep on a small fuzzy-match library (e.g. `fuse.js`) — or a tiny hand-rolled scorer; design.md will pick.
- **No DB / infra change.** JSON file storage stays as is.
- **No breaking API changes.**
