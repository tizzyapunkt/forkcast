import type { Recipe } from '../../domain/recipes/types.ts';
import type { RecipeRepository } from '../../domain/recipes/recipe.repository.ts';
import type { JsonDocument } from '../json-document/json-document.ts';

export class JsonRecipeRepository implements RecipeRepository {
  constructor(private readonly document: JsonDocument) {}

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
    const raw = await this.document.read();
    if (raw === null) return [];
    return JSON.parse(raw) as Recipe[];
  }

  private async writeAll(recipes: Recipe[]): Promise<void> {
    await this.document.write(JSON.stringify(recipes, null, 2));
  }
}
