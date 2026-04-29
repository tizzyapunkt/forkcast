export const queryKeys = {
  dailyLog: (date: string) => ['daily-log', date] as const,
  nutritionGoal: () => ['nutrition-goal'] as const,
  ingredientSearch: (q: string) => ['ingredient-search', q] as const,
  recentlyUsedIngredients: () => ['recently-used-ingredients'] as const,
  recipes: () => ['recipes'] as const,
  recipe: (id: string) => ['recipe', id] as const,
};
