# user-foods-overlay — delta

This capability is removed in full. The overlay existed only because the curated FOODS dataset could not be written at runtime — the container entrypoint overwrote it on every start. With the catalog now living in the data volume and editable in place (see `food-catalog`), there is no second store to overlay, no `USER` source to distinguish, and nothing to drain.

## REMOVED Requirements

### Requirement: User-foods overlay store persists confirmed foods and learned synonyms

**Reason**: Confirmed foods and learned synonyms now write directly to the single catalog. A separate store for "things not yet promoted" has no meaning once nothing needs promoting.

**Migration**: On first startup after this change, `backend/data/user-foods.json` is folded into the catalog — foods appended as entries, `{ foodId, synonym }` pairs merged into the target entry's `synonyms` — then no longer read (see `food-catalog` → "Existing user-foods overlay is migrated into the catalog once"). The atomic-write guarantee carries over to the catalog store.

### Requirement: Overlay foods are searchable as the `USER` ingredient source

**Reason**: The `USER` source is removed. Overlay entries become ordinary catalog entries returned as `source: 'CATALOG'` — and, unlike today, they are reachable from the frontend search panel, which never requested the `USER` source at all.

**Migration**: **BREAKING** — remove `'USER'` from `IngredientSource` / `IngredientResultSource`, drop the `user` value from the `sources` query parameter, and delete the dedicated overlay search service. Callers that requested `user` request `catalog` instead.

### Requirement: Learned synonyms extend the curated index at runtime and at startup

**Reason**: A learned synonym is now simply a synonym on a catalog entry, persisted with the entry itself. There is no second layer to re-apply against a read-only index at startup, and no orphan class to guard against at boot.

**Migration**: Existing `{ foodId, synonym }` pairs are merged into their target entries by the one-time migration; pairs whose `foodId` no longer exists are skipped with a logged warning. Confirming a `synonym-of` resolution updates the target catalog entry's `synonyms` directly (see `unmatched-ingredient-resolution`).

### Requirement: Atomic export-and-clear endpoint drains the overlay

**Reason**: Draining exists to prevent re-promotion of already-promoted entries. With no promotion pipeline, draining only risks data loss — the downloaded file was the sole copy of the user's confirmations until it reached the laptop.

**Migration**: **BREAKING** — `POST /export-user-foods` is removed. It is replaced by a catalog snapshot export that returns the full catalog and leaves it untouched (see `food-catalog` → "Catalog snapshot export downloads without mutating the catalog"). Any saved workflow that relied on export-then-augment is retired.

### Requirement: Settings panel exposes the overlay export

**Reason**: The panel described a pending-entry buffer and a drain action, neither of which exists. It is replaced by a snapshot panel describing the catalog itself.

**Migration**: `UserFoodsPanel` is replaced by a catalog panel showing the total catalog entry count, a link into the catalog manager, and a snapshot download. The copy warning that exporting drains the store is removed, because it no longer does.

### Requirement: `USER` results are visually attributed in search lists

**Reason**: There is no `USER` source to attribute.

**Migration**: The `USER` badge variant is removed; former overlay entries render with the `CATALOG` badge. The `${source}:${id}` list key is unchanged.
