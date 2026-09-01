import type { FavoriteIngredient } from './types.ts';

export interface FavoriteIngredientRepository {
  findAll(): Promise<FavoriteIngredient[]>;
  /** Replaces any favorite sharing the identity, otherwise appends. */
  upsert(favorite: FavoriteIngredient): Promise<void>;
  /** No-op when the identity is not favorited. */
  remove(name: string, unit: string): Promise<void>;
}
