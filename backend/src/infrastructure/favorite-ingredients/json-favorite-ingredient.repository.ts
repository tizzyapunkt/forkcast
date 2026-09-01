import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FavoriteIngredientRepository } from '../../domain/favorite-ingredients/favorite-ingredient.repository.ts';
import { favoriteIdentityKey } from '../../domain/favorite-ingredients/types.ts';
import type { FavoriteIngredient } from '../../domain/favorite-ingredients/types.ts';

export class JsonFavoriteIngredientRepository implements FavoriteIngredientRepository {
  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

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
    if (!existsSync(this.filePath)) return [];
    const raw = await readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as FavoriteIngredient[];
  }

  private async write(favorites: FavoriteIngredient[]): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(favorites, null, 2), 'utf-8');
  }
}
