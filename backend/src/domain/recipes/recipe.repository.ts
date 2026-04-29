import type { Recipe } from './types.ts';

export interface RecipeRepository {
  save(recipe: Recipe): Promise<void>;
  findAll(): Promise<Recipe[]>;
  findById(id: string): Promise<Recipe | null>;
  update(recipe: Recipe): Promise<void>;
  remove(id: string): Promise<void>;
}
