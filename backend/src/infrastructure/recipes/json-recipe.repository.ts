import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Recipe } from '../../domain/recipes/types.ts';
import type { RecipeRepository } from '../../domain/recipes/recipe.repository.ts';

export class JsonRecipeRepository implements RecipeRepository {
  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async save(recipe: Recipe): Promise<void> {
    const all = await this.readAll();
    all.push(recipe);
    await this.writeAll(all);
  }

  async findAll(): Promise<Recipe[]> {
    return this.readAll();
  }

  async findById(id: string): Promise<Recipe | null> {
    const all = await this.readAll();
    return all.find((r) => r.id === id) ?? null;
  }

  async update(recipe: Recipe): Promise<void> {
    const all = await this.readAll();
    const index = all.findIndex((r) => r.id === recipe.id);
    if (index === -1) throw new Error(`Recipe not found: ${recipe.id}`);
    all[index] = recipe;
    await this.writeAll(all);
  }

  async remove(id: string): Promise<void> {
    const all = await this.readAll();
    const filtered = all.filter((r) => r.id !== id);
    await this.writeAll(filtered);
  }

  private async readAll(): Promise<Recipe[]> {
    if (!existsSync(this.filePath)) return [];
    const raw = await readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as Recipe[];
  }

  private async writeAll(recipes: Recipe[]): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(recipes, null, 2), 'utf-8');
  }
}
