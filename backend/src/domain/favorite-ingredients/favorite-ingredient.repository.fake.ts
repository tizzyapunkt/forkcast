import type { FavoriteIngredientRepository } from './favorite-ingredient.repository.ts';
import { favoriteIdentityKey } from './types.ts';
import type { FavoriteIngredient } from './types.ts';

/**
 * Test-only in-memory `FavoriteIngredientRepository`. Applies the same identity
 * rule as the JSON adapter without touching disk, so use-case tests assert
 * behaviour rather than persistence (which the adapter's own tests cover).
 */
export class FakeFavoriteIngredientRepository implements FavoriteIngredientRepository {
  private favorites: FavoriteIngredient[];

  constructor(initial: FavoriteIngredient[] = []) {
    this.favorites = [...initial];
  }

  findAll(): Promise<FavoriteIngredient[]> {
    return Promise.resolve([...this.favorites]);
  }

  upsert(favorite: FavoriteIngredient): Promise<void> {
    const key = favoriteIdentityKey(favorite.name, favorite.unit);
    const index = this.favorites.findIndex((f) => favoriteIdentityKey(f.name, f.unit) === key);
    if (index === -1) {
      this.favorites.push(favorite);
    } else {
      this.favorites[index] = favorite;
    }
    return Promise.resolve();
  }

  remove(name: string, unit: string): Promise<void> {
    const key = favoriteIdentityKey(name, unit);
    this.favorites = this.favorites.filter((f) => favoriteIdentityKey(f.name, f.unit) !== key);
    return Promise.resolve();
  }
}
