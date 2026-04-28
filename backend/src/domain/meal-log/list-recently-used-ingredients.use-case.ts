import type { LogEntryRepository } from './log-entry.repository.ts';
import type { FullIngredientEntry, LogEntry, RecentlyUsedIngredient } from './types.ts';

function isFullEntry(entry: LogEntry): entry is LogEntry & { ingredient: FullIngredientEntry } {
  return entry.ingredient.type === 'full';
}

function identityKey(name: string, unit: string): string {
  return `${name.toLowerCase()}|${unit}`;
}

export async function listRecentlyUsedIngredients(repo: LogEntryRepository): Promise<RecentlyUsedIngredient[]> {
  const all = await repo.findAll();

  const latestByIdentity = new Map<string, LogEntry & { ingredient: FullIngredientEntry }>();
  for (const entry of all) {
    if (!isFullEntry(entry)) continue;
    const key = identityKey(entry.ingredient.name, entry.ingredient.unit);
    const existing = latestByIdentity.get(key);
    if (!existing || entry.loggedAt > existing.loggedAt) {
      latestByIdentity.set(key, entry);
    }
  }

  const recents: RecentlyUsedIngredient[] = [];
  for (const entry of latestByIdentity.values()) {
    recents.push({
      name: entry.ingredient.name,
      unit: entry.ingredient.unit,
      macrosPerUnit: entry.ingredient.macrosPerUnit,
      lastUsedAt: entry.loggedAt,
    });
  }

  recents.sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : a.lastUsedAt > b.lastUsedAt ? -1 : 0));
  return recents;
}
