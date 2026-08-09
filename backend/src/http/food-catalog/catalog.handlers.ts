import type { Context } from 'hono';
import type { CatalogStore, CatalogWriteResult } from '../../domain/food-catalog/types.ts';
import { CatalogDraftError, type CatalogEntryDrafter } from '../../domain/food-catalog/catalog-entry-drafter.ts';
import { slugifyName } from '../../domain/food-catalog/slugify-name.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';
import { fold } from '../../domain/ingredient-search/fold.ts';

/** Stable error code the manager keys on to offer "open the existing entry instead". */
const ENTRY_EXISTS = 'catalog-entry-exists';

function parseEntry(raw: unknown): FoodEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as FoodEntry;
  if (typeof entry.name !== 'string') return null;
  // A hand-created entry carries no id: derive it from the canonical name, per
  // the catalog's id rule. An id supplied by a client (the resolve flow) wins.
  const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : slugifyName(entry.name);
  return { ...entry, id };
}

/** The entry a rejected write collided with, so the client can offer to open it. */
function findColliding(store: CatalogStore, entry: FoodEntry): FoodEntry | null {
  const folded = fold(entry.name);
  return store.list().find((e) => e.id === entry.id || fold(e.name) === folded) ?? null;
}

function respondToWrite(c: Context, store: CatalogStore, entry: FoodEntry, result: CatalogWriteResult) {
  if (result.ok) return c.json({ entry: result.entry });
  if (result.kind === 'not-found') return c.json({ error: result.reason }, 404);
  if (result.kind === 'conflict') {
    const existing = findColliding(store, entry);
    return c.json({ error: result.reason, code: ENTRY_EXISTS, existingId: existing?.id }, 400);
  }
  return c.json({ error: result.reason }, 400);
}

async function readJson(c: Context): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/** The whole catalog, unranked — the manager needs every entry, not a search result page. */
export function makeGetCatalogHandler(store: CatalogStore) {
  return (c: Context) => c.json({ entries: store.list() });
}

/** Snapshot download. Returns the catalog verbatim and never mutates it. */
export function makeExportCatalogHandler(store: CatalogStore) {
  return (c: Context) => c.json(store.list());
}

export function makeAddCatalogEntryHandler(store: CatalogStore) {
  return async (c: Context) => {
    const body = await readJson(c);
    const entry = parseEntry((body as { entry?: unknown })?.entry);
    if (entry === null) return c.json({ error: 'Body must be { entry: { name, unit, macrosPer100, … } }' }, 400);
    return respondToWrite(c, store, entry, await store.add(entry));
  };
}

export function makeUpdateCatalogEntryHandler(store: CatalogStore) {
  return async (c: Context) => {
    const body = await readJson(c);
    const o = body as { id?: unknown; entry?: unknown } | undefined;
    const entry = parseEntry(o?.entry);
    if (typeof o?.id !== 'string' || entry === null) {
      return c.json({ error: 'Body must be { id, entry: { name, unit, macrosPer100, … } }' }, 400);
    }
    return respondToWrite(c, store, entry, await store.update(o.id, entry));
  };
}

export function makeRemoveCatalogEntryHandler(store: CatalogStore) {
  return async (c: Context) => {
    const body = await readJson(c);
    const id = (body as { id?: unknown } | undefined)?.id;
    if (typeof id !== 'string') return c.json({ error: 'Body must be { id }' }, 400);
    const result = await store.remove(id);
    if (!result.ok) return c.json({ error: result.reason }, 404);
    return c.json({ entry: result.entry });
  };
}

export function makeUnconfiguredDraftCatalogEntryHandler() {
  return (c: Context) => c.json({ error: 'ai-import-not-configured' }, 503);
}

/** The optional AI fill: one candidate entry for a name, persisted only if the user saves it. */
export function makeDraftCatalogEntryHandler(drafter: CatalogEntryDrafter) {
  return async (c: Context) => {
    const body = await readJson(c);
    const name = (body as { name?: unknown } | undefined)?.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ error: 'Body must be { name }' }, 400);
    }
    try {
      return c.json({ entry: await drafter.draft(name.trim()) });
    } catch (err) {
      if (err instanceof CatalogDraftError) {
        return c.json({ error: 'ai-resolution-failed', detail: err.message }, 502);
      }
      return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 400);
    }
  };
}
