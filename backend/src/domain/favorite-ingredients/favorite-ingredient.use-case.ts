import type { FavoriteIngredientRepository } from './favorite-ingredient.repository.ts';
import { favoriteIdentityKey } from './types.ts';
import type { FavoriteIngredient, FavoriteUnit } from './types.ts';
import type { MacrosPerUnit } from '../meal-log/types.ts';

export interface FavoriteIngredientCommand {
  name: string;
  unit: FavoriteUnit;
  macrosPerUnit: MacrosPerUnit;
  untracked?: boolean;
}

const UNITS: readonly FavoriteUnit[] = ['g', 'ml'];
const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat'] as const;

function assertValid(command: FavoriteIngredientCommand): string {
  const name = typeof command.name === 'string' ? command.name.trim() : '';
  if (name === '') throw new Error('invalid favorite: name is required');
  if (!UNITS.includes(command.unit)) throw new Error("invalid favorite: unit must be 'g' or 'ml'");

  const macros = command.macrosPerUnit as Partial<MacrosPerUnit> | undefined;
  if (!macros || typeof macros !== 'object') throw new Error('invalid favorite: macrosPerUnit is required');
  for (const key of MACRO_KEYS) {
    const value = macros[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`invalid favorite: macrosPerUnit.${key} must be a finite, non-negative number`);
    }
  }

  return name;
}

/**
 * Favoriting is an idempotent upsert: re-favoriting an identity refreshes the
 * snapshot (name casing, macros, untracked) but keeps the original `favoritedAt`,
 * so the sort position of a long-standing favorite does not jump when the user
 * re-stars it to pick up corrected macros.
 */
export async function favoriteIngredient(
  repo: FavoriteIngredientRepository,
  command: FavoriteIngredientCommand,
): Promise<FavoriteIngredient> {
  const name = assertValid(command);

  const key = favoriteIdentityKey(name, command.unit);
  const existing = (await repo.findAll()).find((f) => favoriteIdentityKey(f.name, f.unit) === key);

  const favorite: FavoriteIngredient = {
    name,
    unit: command.unit,
    macrosPerUnit: { ...command.macrosPerUnit },
    ...(command.untracked ? { untracked: true } : {}),
    favoritedAt: existing?.favoritedAt ?? new Date().toISOString(),
  };

  await repo.upsert(favorite);

  return favorite;
}
