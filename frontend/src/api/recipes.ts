import { fetchJson } from './client';
import type { Recipe, RecipeIngredient } from '../domain/recipes';
import type { LogEntry, MealSlot } from '../domain/meal-log';

export interface AddRecipeInput {
  name: string;
  yield: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface UpdateRecipeInput {
  name?: string;
  yield?: number;
  ingredients?: RecipeIngredient[];
  steps?: string[];
}

export interface LogRecipeInput {
  recipeId: string;
  portions: number;
  date: string;
  slot: MealSlot;
}

export function addRecipe(input: AddRecipeInput): Promise<Recipe> {
  return fetchJson<Recipe>('/api/add-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function listRecipes(): Promise<Recipe[]> {
  return fetchJson<Recipe[]>('/api/recipes');
}

export function getRecipe(id: string): Promise<Recipe> {
  return fetchJson<Recipe>(`/api/recipes/${id}`);
}

export function updateRecipe(id: string, patch: UpdateRecipeInput): Promise<Recipe> {
  return fetchJson<Recipe>(`/api/recipe/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`/api/recipe/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep statusText */
    }
    throw new Error(message);
  }
}

export function logRecipe(input: LogRecipeInput): Promise<LogEntry[]> {
  return fetchJson<LogEntry[]>('/api/log-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
