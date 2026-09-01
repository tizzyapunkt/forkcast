import type { FavoriteIngredientRepository } from './favorite-ingredient.repository.ts';
import { favoriteIdentityKey } from './types.ts';
import type { ListedFavoriteIngredient } from './types.ts';
import { latestFullEntryByIdentity } from '../meal-log/ingredient-identity.ts';
import type { LogEntryRepository } from '../meal-log/log-entry.repository.ts';

/**
 * Lists favorites enriched with their last use. `lastAmount` is derived here on
 * every read rather than stored on the favorite: the log is the source of truth
 * for "last used", and a copied value would drift the moment one of the five
 * log-mutating paths forgot to write through.
 */
export async function listFavoriteIngredients(
  favorites: FavoriteIngredientRepository,
  logs: LogEntryRepository,
): Promise<ListedFavoriteIngredient[]> {
  const [stored, entries] = await Promise.all([favorites.findAll(), logs.findAll()]);
  const latest = latestFullEntryByIdentity(entries);

  const listed = stored.map<ListedFavoriteIngredient>((favorite) => {
    const lastUse = latest.get(favoriteIdentityKey(favorite.name, favorite.unit));
    return lastUse
      ? { ...favorite, lastAmount: lastUse.ingredient.amount, lastUsedAt: lastUse.loggedAt }
      : { ...favorite };
  });

  // Used favorites first, newest use on top; never-used favorites keep a
  // deterministic slot below them, newest bookmark on top.
  listed.sort((a, b) => {
    if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (a.lastUsedAt) return -1;
    if (b.lastUsedAt) return 1;
    return b.favoritedAt.localeCompare(a.favoritedAt);
  });

  return listed;
}
