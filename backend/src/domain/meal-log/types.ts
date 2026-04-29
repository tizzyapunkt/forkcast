export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MeasurementUnit = 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece';

export interface MacrosPer100 {
  calories: number; // kcal
  protein: number; // g
  carbs: number; // g
  fat: number; // g
}

/**
 * A quick log entry — calories only, or calories + macros.
 * When macros are omitted, the day is flagged as macros_partial.
 */
export interface QuickIngredientEntry {
  type: 'quick';
  label: string;
  calories: number; // kcal
  protein?: number; // g
  carbs?: number; // g
  fat?: number; // g
}

/**
 * A full log entry referencing a real ingredient.
 * Stores macros per unit + measured amount; totals are calculated on read.
 */
export interface FullIngredientEntry {
  type: 'full';
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
  amount: number;
}

export type IngredientEntry = QuickIngredientEntry | FullIngredientEntry;

export interface LogEntry {
  id: string;
  date: string; // ISO date string: YYYY-MM-DD
  slot: MealSlot;
  ingredient: IngredientEntry;
  loggedAt: string; // ISO datetime string
  recipeId?: string; // present when this entry was produced by logging a recipe
}

/**
 * Resolved totals for a day — computed from log entries, not stored.
 */
export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  macrosPartial: boolean; // true if any quick entry has no macro breakdown
}

export interface SlotSummary {
  slot: MealSlot;
  entries: LogEntry[];
  totals: DayTotals;
}

export interface DailyLog {
  date: string;
  slots: SlotSummary[];
  totals: DayTotals;
}

export interface RecentlyUsedIngredient {
  name: string;
  unit: MeasurementUnit;
  macrosPerUnit: MacrosPer100;
  lastUsedAt: string; // ISO datetime, max(loggedAt) across collapsed entries
}
