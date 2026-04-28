import { useMutation, useQueryClient } from '@tanstack/react-query';
import { editLogEntry, type EditLogEntryPatch } from '../api/edit-log-entry';
import { queryKeys } from './keys';
import type { DailyLog, DayTotals, LogEntry, SlotSummary } from '../domain/meal-log';

interface EditLogEntryInput {
  id: string;
  date: string;
  patch: EditLogEntryPatch;
}

interface MutationContext {
  previous: DailyLog | undefined;
}

function entryTotals(entry: LogEntry): DayTotals {
  const ing = entry.ingredient;
  if (ing.type === 'quick') {
    const partial = ing.protein === undefined || ing.carbs === undefined || ing.fat === undefined;
    return {
      calories: ing.calories,
      protein: ing.protein ?? 0,
      carbs: ing.carbs ?? 0,
      fat: ing.fat ?? 0,
      macrosPartial: partial,
    };
  }
  return {
    calories: ing.macrosPerUnit.calories * ing.amount,
    protein: ing.macrosPerUnit.protein * ing.amount,
    carbs: ing.macrosPerUnit.carbs * ing.amount,
    fat: ing.macrosPerUnit.fat * ing.amount,
    macrosPartial: false,
  };
}

function sumTotals(entries: LogEntry[]): DayTotals {
  const sum = { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false };
  for (const entry of entries) {
    const t = entryTotals(entry);
    sum.calories += t.calories;
    sum.protein += t.protein;
    sum.carbs += t.carbs;
    sum.fat += t.fat;
    sum.macrosPartial = sum.macrosPartial || t.macrosPartial;
  }
  return sum;
}

function applyPatch(log: DailyLog, id: string, patch: EditLogEntryPatch): DailyLog {
  let touchedSlotIdx = -1;
  const slots: SlotSummary[] = log.slots.map((slot, idx) => {
    const entryIdx = slot.entries.findIndex((e) => e.id === id);
    if (entryIdx === -1) return slot;
    const entry = slot.entries[entryIdx];
    const nextEntry = patchEntry(entry, patch);
    if (nextEntry === entry) return slot;
    touchedSlotIdx = idx;
    const entries = [...slot.entries];
    entries[entryIdx] = nextEntry;
    return { ...slot, entries, totals: sumTotals(entries) };
  });
  if (touchedSlotIdx === -1) return log;
  const allEntries = slots.flatMap((s) => s.entries);
  return { ...log, slots, totals: sumTotals(allEntries) };
}

function patchEntry(entry: LogEntry, patch: EditLogEntryPatch): LogEntry {
  if (patch.type === 'full' && entry.ingredient.type === 'full') {
    return { ...entry, ingredient: { ...entry.ingredient, amount: patch.amount } };
  }
  if (patch.type === 'quick' && entry.ingredient.type === 'quick') {
    return {
      ...entry,
      ingredient: {
        ...entry.ingredient,
        calories: patch.calories,
        protein: patch.protein,
        carbs: patch.carbs,
        fat: patch.fat,
      },
    };
  }
  return entry;
}

export function useEditLogEntry() {
  const queryClient = useQueryClient();
  return useMutation<LogEntry, Error, EditLogEntryInput, MutationContext>({
    mutationFn: ({ id, patch }) => editLogEntry(id, patch),
    onMutate: async ({ id, date, patch }) => {
      const key = queryKeys.dailyLog(date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DailyLog>(key);
      if (previous) {
        queryClient.setQueryData<DailyLog>(key, applyPatch(previous, id, patch));
      }
      return { previous };
    },
    onError: (_err, { date }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.dailyLog(date), context.previous);
      }
    },
    onSettled: (_data, _err, { date }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(date) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentlyUsedIngredients() });
    },
  });
}
