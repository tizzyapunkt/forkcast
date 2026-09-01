import type { IngredientSearchSource } from '../domain/ingredient-search';

export const queryKeys = {
  dailyLog: (date: string) => ['daily-log', date] as const,
  weekLog: (startDate: string) => ['week-log', startDate] as const,
  /** Prefix key for invalidating every mounted week-log query (any startDate). */
  weekLogAll: () => ['week-log'] as const,
  nutritionGoal: () => ['nutrition-goal'] as const,
  bodyProfile: () => ['body-profile'] as const,
  ingredientSearch: (q: string, sources?: IngredientSearchSource[]) =>
    ['ingredient-search', q, sources ?? ['CATALOG']] as const,
  recentlyUsedIngredients: () => ['recently-used-ingredients'] as const,
  favoriteIngredients: () => ['favorite-ingredients'] as const,
  recipes: () => ['recipes'] as const,
  recipe: (id: string) => ['recipe', id] as const,
  weightLog: () => ['weight-log'] as const,
  weightTrend: () => ['weight-trend'] as const,
  catalog: () => ['catalog'] as const,
  debugLogs: () => ['debug-logs'] as const,
};
