/**
 * The user's single persistent daily nutrition goal.
 * All targets are per-day.
 */
export interface DailyGoal {
  calories: number; // kcal
  protein: number; // g
  carbs: number; // g
  fat: number; // g
}
