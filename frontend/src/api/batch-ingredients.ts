import { fetchJson } from './client';
import type { FullIngredientEntry, LogEntry } from '../domain/meal-log';
import type { BatchIngredientChange } from '../domain/cooking-session';

export interface ReplaceBatchIngredientInput {
  entryId: string;
  ingredient: FullIngredientEntry;
}

/** Swaps the food of one entry inside a logged recipe batch; the entry stays in the batch. */
export function replaceBatchIngredient(input: ReplaceBatchIngredientInput): Promise<LogEntry> {
  return fetchJson<LogEntry>('/api/replace-batch-ingredient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export interface AddToRecipeBatchInput {
  recipeBatchId: string;
  date: string;
  ingredient: FullIngredientEntry;
}

/** Adds one ingredient to a logged recipe batch on `date`; the new entry joins the batch. */
export function addToRecipeBatch(input: AddToRecipeBatchInput): Promise<LogEntry> {
  return fetchJson<LogEntry>('/api/add-to-recipe-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** Writes the cooking view's edits into several recipe batches at once, with absolute amounts per batch. */
export function setBatchIngredients(changes: BatchIngredientChange[]): Promise<LogEntry[]> {
  return fetchJson<LogEntry[]>('/api/set-batch-ingredients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes }),
  });
}
