import { fetchJson } from './client';
import type { LogEntry, IngredientEntry, MealSlot } from '../domain/meal-log';

export interface LogIngredientInput {
  date: string;
  slot: MealSlot;
  ingredient: IngredientEntry;
}

export function logIngredient(input: LogIngredientInput): Promise<LogEntry> {
  return fetchJson<LogEntry>('/api/log-ingredient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
