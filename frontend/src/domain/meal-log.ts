export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MeasurementUnit = 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece';

export interface MacrosPer100 {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface QuickIngredientEntry {
  type: 'quick';
  label: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

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
  date: string;
  slot: MealSlot;
  ingredient: IngredientEntry;
  loggedAt: string;
}

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  macrosPartial: boolean;
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
  lastUsedAt: string;
}
