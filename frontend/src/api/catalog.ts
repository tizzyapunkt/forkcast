import { fetchJson } from './client';
import type { CatalogEntry, CatalogEntryDraft } from '../domain/food-catalog';

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** The whole catalog, unranked — the manager filters client-side. */
export async function fetchCatalog(): Promise<CatalogEntry[]> {
  const body = await fetchJson<{ entries: CatalogEntry[] }>('/api/catalog');
  return body.entries;
}

export async function addCatalogEntry(entry: CatalogEntryDraft): Promise<CatalogEntry> {
  const body = await fetchJson<{ entry: CatalogEntry }>('/api/add-catalog-entry', jsonPost({ entry }));
  return body.entry;
}

export async function updateCatalogEntry(id: string, entry: CatalogEntryDraft): Promise<CatalogEntry> {
  const body = await fetchJson<{ entry: CatalogEntry }>('/api/update-catalog-entry', jsonPost({ id, entry }));
  return body.entry;
}

export async function removeCatalogEntry(id: string): Promise<void> {
  await fetchJson<{ entry: CatalogEntry }>('/api/remove-catalog-entry', jsonPost({ id }));
}

/** Snapshot for backup / a fresh install. Leaves the catalog untouched. */
export async function exportCatalog(): Promise<CatalogEntry[]> {
  return fetchJson<CatalogEntry[]>('/api/export-catalog');
}

/** Optional AI fill: one suggested entry for a name. Persists nothing. */
export async function draftCatalogEntry(name: string): Promise<CatalogEntry> {
  const body = await fetchJson<{ entry: CatalogEntry }>('/api/draft-catalog-entry', jsonPost({ name }));
  return body.entry;
}
