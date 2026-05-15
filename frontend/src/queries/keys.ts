export const queryKeys = {
  dailyLog: (date: string) => ['daily-log', date] as const,
  nutritionGoal: () => ['nutrition-goal'] as const,
  bodyProfile: () => ['body-profile'] as const,
  ingredientSearch: (q: string, sources?: Array<'FOODS' | 'OFF'>) =>
    ['ingredient-search', q, sources ?? ['OFF']] as const,
  recentlyUsedIngredients: () => ['recently-used-ingredients'] as const,
  recipes: () => ['recipes'] as const,
  recipe: (id: string) => ['recipe', id] as const,
  weightLog: () => ['weight-log'] as const,
  weightTrend: () => ['weight-trend'] as const,
};
