import type { LogEntryRepository } from './log-entry.repository.js';
import type {
  DailyLog,
  DayTotals,
  FullIngredientEntry,
  LogEntry,
  MealSlot,
  QuickIngredientEntry,
  SlotSummary,
} from './types.js';

const ALL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function totalsFromFull(ingredient: FullIngredientEntry): Omit<DayTotals, 'macrosPartial'> {
  const { macrosPerUnit: m, amount } = ingredient;
  return {
    calories: m.calories * amount,
    protein: m.protein * amount,
    carbs: m.carbs * amount,
    fat: m.fat * amount,
  };
}

function totalsFromQuick(ingredient: QuickIngredientEntry): Omit<DayTotals, 'macrosPartial'> {
  return {
    calories: ingredient.calories,
    protein: ingredient.protein ?? 0,
    carbs: ingredient.carbs ?? 0,
    fat: ingredient.fat ?? 0,
  };
}

function isPartial(ingredient: QuickIngredientEntry): boolean {
  return ingredient.protein === undefined;
}

function sumTotals(entries: LogEntry[]): DayTotals {
  let calories = 0,
    protein = 0,
    carbs = 0,
    fat = 0,
    macrosPartial = false;

  for (const entry of entries) {
    const t = entry.ingredient.type === 'full' ? totalsFromFull(entry.ingredient) : totalsFromQuick(entry.ingredient);

    calories += t.calories;
    protein += t.protein;
    carbs += t.carbs;
    fat += t.fat;

    if (entry.ingredient.type === 'quick' && isPartial(entry.ingredient)) {
      macrosPartial = true;
    }
  }

  return { calories, protein, carbs, fat, macrosPartial };
}

export async function getDailyLog(repo: LogEntryRepository, date: string): Promise<DailyLog> {
  const entries = await repo.findByDate(date);

  const slots: SlotSummary[] = ALL_SLOTS.map((slot) => {
    const slotEntries = entries.filter((e) => e.slot === slot);
    return { slot, entries: slotEntries, totals: sumTotals(slotEntries) };
  });

  return { date, slots, totals: sumTotals(entries) };
}
