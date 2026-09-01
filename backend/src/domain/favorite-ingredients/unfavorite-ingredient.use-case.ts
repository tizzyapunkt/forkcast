import type { FavoriteIngredientRepository } from './favorite-ingredient.repository.ts';
import type { FavoriteUnit } from './types.ts';

export interface UnfavoriteIngredientCommand {
  name: string;
  unit: FavoriteUnit;
}

const UNITS: readonly FavoriteUnit[] = ['g', 'ml'];

/**
 * Unfavoriting is idempotent: an identity that is not favorited is not an error,
 * so a stale client (or a double tap on the star) cannot fail the user.
 */
export async function unfavoriteIngredient(
  repo: FavoriteIngredientRepository,
  command: UnfavoriteIngredientCommand,
): Promise<void> {
  const name = typeof command.name === 'string' ? command.name.trim() : '';
  if (name === '') throw new Error('invalid unfavorite: name is required');
  if (!UNITS.includes(command.unit)) throw new Error("invalid unfavorite: unit must be 'g' or 'ml'");

  await repo.remove(name, command.unit);
}
