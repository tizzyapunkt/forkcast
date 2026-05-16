import type { RecipeIngredient } from './types.ts';

const VALID_UNITS: readonly RecipeIngredient['unit'][] = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece'];
export const DISPLAY_QUANTITY_UNIT_LABEL_MAX = 24;
export const NOTE_MAX_LENGTH = 80;

export function validateIngredientShape(ingredient: RecipeIngredient): void {
  const label = ingredient?.name ? `"${ingredient.name}"` : '(unnamed)';
  const untracked = ingredient.untracked === true;

  if (typeof ingredient.name !== 'string' || ingredient.name.trim().length === 0) {
    throw new Error(`Ingredient ${label}: name must be a non-empty string`);
  }
  if (!Number.isFinite(ingredient.amount)) {
    throw new Error(`Ingredient ${label}: amount must be a finite number`);
  }
  if (untracked) {
    if (ingredient.amount < 0) {
      throw new Error(`Ingredient ${label}: amount must be >= 0 on untracked rows`);
    }
  } else if (ingredient.amount <= 0) {
    throw new Error(`Ingredient ${label}: amount must be a positive number`);
  }
  if (typeof ingredient.unit !== 'string' || !VALID_UNITS.includes(ingredient.unit)) {
    throw new Error(`Ingredient ${label}: unit must be one of ${VALID_UNITS.join(', ')}`);
  }

  if (ingredient.displayQuantity !== undefined) {
    if (!untracked) {
      throw new Error(`Ingredient ${label}: displayQuantity is only allowed on untracked rows`);
    }
    const dq = ingredient.displayQuantity;
    if (!Number.isFinite(dq.amount) || dq.amount < 0) {
      throw new Error(`Ingredient ${label}: displayQuantity.amount must be a finite number >= 0`);
    }
    if (typeof dq.unitLabel !== 'string') {
      throw new Error(`Ingredient ${label}: displayQuantity.unitLabel must be a string`);
    }
    const trimmed = dq.unitLabel.trim();
    if (trimmed.length === 0) {
      throw new Error(`Ingredient ${label}: displayQuantity.unitLabel must be a non-empty string`);
    }
    if (trimmed.length > DISPLAY_QUANTITY_UNIT_LABEL_MAX) {
      throw new Error(
        `Ingredient ${label}: displayQuantity.unitLabel must be at most ${DISPLAY_QUANTITY_UNIT_LABEL_MAX} characters`,
      );
    }
  }

  if (ingredient.note !== undefined) {
    if (typeof ingredient.note !== 'string') {
      throw new Error(`Ingredient ${label}: note must be a string`);
    }
    const trimmed = ingredient.note.trim();
    if (trimmed.length === 0) {
      throw new Error(`Ingredient ${label}: note must be a non-empty string when present`);
    }
    if (trimmed.length > NOTE_MAX_LENGTH) {
      throw new Error(`Ingredient ${label}: note must be at most ${NOTE_MAX_LENGTH} characters`);
    }
  }
}
