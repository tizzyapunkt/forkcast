import type { LogEntry, MealSlot, IngredientEntry } from './types.js';
import type { LogEntryRepository } from './log-entry.repository.js';

export interface LogIngredientCommand {
  date: string;
  slot: MealSlot;
  ingredient: IngredientEntry;
}

export async function logIngredient(repo: LogEntryRepository, command: LogIngredientCommand): Promise<LogEntry> {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    date: command.date,
    slot: command.slot,
    ingredient: command.ingredient,
    loggedAt: new Date().toISOString(),
  };

  await repo.save(entry);

  return entry;
}
