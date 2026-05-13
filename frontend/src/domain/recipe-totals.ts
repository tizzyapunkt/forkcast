import type { MacrosPer100 } from './meal-log';
import type { RecipeIngredient } from './recipes';

export interface RecipeTotals {
  total: MacrosPer100;
  perServing: MacrosPer100;
}

const zero = (): MacrosPer100 => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

export function computeRecipeTotals(ingredients: RecipeIngredient[], yieldValue: number): RecipeTotals {
  const total = zero();
  for (const ing of ingredients) {
    if (ing.untracked === true) continue;
    total.calories += ing.macrosPerUnit.calories * ing.amount;
    total.protein += ing.macrosPerUnit.protein * ing.amount;
    total.carbs += ing.macrosPerUnit.carbs * ing.amount;
    total.fat += ing.macrosPerUnit.fat * ing.amount;
  }
  const divisor = Number.isFinite(yieldValue) && yieldValue > 0 ? yieldValue : 1;
  const perServing: MacrosPer100 = {
    calories: total.calories / divisor,
    protein: total.protein / divisor,
    carbs: total.carbs / divisor,
    fat: total.fat / divisor,
  };
  return { total, perServing };
}
