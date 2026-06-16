# unmatched-ingredient-collection — delta

This capability is removed in full. Unmatched ingredients are now resolved interactively at import-review time (see `unmatched-ingredient-resolution`), and the curation feed for the laptop pipeline is the user-foods overlay export (see `user-foods-overlay`), which carries full confirmed entries instead of name counts.

## REMOVED Requirements

### Requirement: Strict-unmatched ingredients are recorded server-side during AI recipe import

**Reason**: Recording at import time captured stale, lossy data (names and counts, no amounts, no recipe link) the moment the user resolved an item thirty seconds later. The resolve flow supersedes it with full confirmed entries.
**Migration**: Delete the recorder wiring from the import use case. No data migration; `backend/data/unmatched-ingredients.json` is deleted.

### Requirement: Unmatched entries are deduped by folded name with running count and capped samples

**Reason**: The store no longer exists.
**Migration**: None — the user-foods overlay (`user-foods.json`) is the new persistent artifact, with richer content.

### Requirement: Export endpoint returns the collected store without side effects

**Reason**: Endpoint removed with the subsystem.
**Migration**: The curation export is now `POST /export-user-foods` (atomic export-and-clear) in the `user-foods-overlay` capability.

### Requirement: Clear endpoint atomically empties the store

**Reason**: Endpoint removed with the subsystem.
**Migration**: Clearing is part of the atomic `POST /export-user-foods` operation; no separate clear action exists.

### Requirement: Frontend exposes Export and Clear as distinct user actions

**Reason**: The settings panel for unmatched ingredients is removed.
**Migration**: The settings surface hosts the user-foods overlay export panel in its place (see `user-foods-overlay`).
