import { latestFullEntryByIdentity } from './ingredient-identity.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { RecentlyUsedIngredient } from './types.ts';

export async function listRecentlyUsedIngredients(repo: LogEntryRepository): Promise<RecentlyUsedIngredient[]> {
  const all = await repo.findAll();

  const recents: RecentlyUsedIngredient[] = [];
  for (const entry of latestFullEntryByIdentity(all).values()) {
    recents.push({
      name: entry.ingredient.name,
      unit: entry.ingredient.unit,
      macrosPerUnit: entry.ingredient.macrosPerUnit,
      lastUsedAt: entry.loggedAt,
      lastAmount: entry.ingredient.amount,
    });
  }

  recents.sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : a.lastUsedAt > b.lastUsedAt ? -1 : 0));
  return recents;
}
