import { ingredientIdentityKey } from '../meal-log/ingredient-identity.ts';
import type { MacrosPerUnit } from '../meal-log/types.ts';

/** Favorites only ever come from pickable foods, which are mass or volume based. */
export type FavoriteUnit = 'g' | 'ml';

/**
 * A user-curated bookmark on an ingredient, stored as a snapshot rather than a
 * reference: editing or deleting the catalog entry it came from leaves it intact,
 * exactly as it leaves recipes and logged days intact.
 */
export interface FavoriteIngredient {
  name: string;
  unit: FavoriteUnit;
  macrosPerUnit: MacrosPerUnit;
  /** Omitted entirely when the ingredient is tracked. */
  untracked?: boolean;
  favoritedAt: string; // ISO datetime
}

/**
 * A favorite as the list query returns it, enriched from log history. Both extra
 * fields are absent together when the ingredient has never been logged.
 */
export interface ListedFavoriteIngredient extends FavoriteIngredient {
  lastAmount?: number;
  lastUsedAt?: string; // ISO datetime
}

/** Favorites share the recently-used identity rule: case-insensitive name plus unit. */
export function favoriteIdentityKey(name: string, unit: string): string {
  return ingredientIdentityKey(name, unit);
}
