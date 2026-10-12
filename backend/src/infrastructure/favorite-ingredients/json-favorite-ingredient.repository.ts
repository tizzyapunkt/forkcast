import type { FavoriteIngredientRepository } from '../../domain/favorite-ingredients/favorite-ingredient.repository.ts';
import { favoriteIdentityKey } from '../../domain/favorite-ingredients/types.ts';
import type { FavoriteIngredient } from '../../domain/favorite-ingredients/types.ts';
import type { JsonDocument } from '../json-document/json-document.ts';

export class JsonFavoriteIngredientRepository implements FavoriteIngredientRepository {
  constructor(private readonly document: JsonDocument) {}

  async findAll(): Promise<FavoriteIngredient[]> {
    return this.readAll();
  }

  async upsert(favorite: FavoriteIngredient): Promise<void> {
    const all = await this.readAll();
    const key = favoriteIdentityKey(favorite.name, favorite.unit);
    const index = all.findIndex((f) => favoriteIdentityKey(f.name, f.unit) === key);
    if (index === -1) {
      all.push(favorite);
    } else {
      all[index] = favorite;
    }
    await this.write(all);
  }

  async remove(name: string, unit: string): Promise<void> {
    const all = await this.readAll();
    const key = favoriteIdentityKey(name, unit);
    await this.write(all.filter((f) => favoriteIdentityKey(f.name, f.unit) !== key));
  }

  private async readAll(): Promise<FavoriteIngredient[]> {
    const raw = await this.document.read();
    if (raw === null) return [];
    return JSON.parse(raw) as FavoriteIngredient[];
  }

  private async write(favorites: FavoriteIngredient[]): Promise<void> {
    await this.document.write(JSON.stringify(favorites, null, 2));
  }
}
