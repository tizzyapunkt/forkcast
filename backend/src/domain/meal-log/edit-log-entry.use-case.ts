import type { LogEntryRepository } from './log-entry.repository.js';
import type { LogEntry } from './types.js';

export type EditLogEntryCommand =
  | { entryId: string; type: 'full'; amount: number }
  | { entryId: string; type: 'quick'; calories: number; protein?: number; carbs?: number; fat?: number };

export async function editLogEntry(repo: LogEntryRepository, command: EditLogEntryCommand): Promise<LogEntry> {
  const entry = await repo.findById(command.entryId);
  if (!entry) throw new Error(`Log entry not found: ${command.entryId}`);

  if (entry.ingredient.type !== command.type) {
    throw new Error(`Cannot apply a '${command.type}' edit to a '${entry.ingredient.type}' entry`);
  }

  let updated: LogEntry;

  if (command.type === 'full' && entry.ingredient.type === 'full') {
    updated = { ...entry, ingredient: { ...entry.ingredient, amount: command.amount } };
  } else if (command.type === 'quick' && entry.ingredient.type === 'quick') {
    updated = {
      ...entry,
      ingredient: {
        ...entry.ingredient,
        calories: command.calories,
        protein: command.protein,
        carbs: command.carbs,
        fat: command.fat,
      },
    };
  } else {
    throw new Error('Unhandled edit command');
  }

  await repo.update(updated);
  return updated;
}
