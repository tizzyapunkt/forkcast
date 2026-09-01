import type { MacrosPerUnit } from './meal-log';

/** Favorites only ever come from pickable foods, which are mass or volume based. */
export type FavoriteUnit = 'g' | 'ml';

/**
 * A user-curated bookmark on an ingredient. Stored server-side as a snapshot, so
 * a later catalog edit or deletion leaves it intact. `lastAmount` / `lastUsedAt`
 * are derived by the backend from log history and are absent together when the
 * ingredient has never been logged.
 */
export interface FavoriteIngredient {
  name: string;
  unit: FavoriteUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
  favoritedAt: string;
  lastAmount?: number;
  lastUsedAt?: string;
}

/** Favorites share the recently-used identity rule: case-insensitive name plus unit. */
export function favoriteIdentityKey(name: string, unit: string): string {
  return `${name.toLowerCase()}|${unit}`;
}
