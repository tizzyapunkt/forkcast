import { fetchJson } from './client';
import type { LogEntry } from '../domain/meal-log';

export interface SetCookedPortionsInput {
  recipeBatchId: string;
  date: string;
  cookedPortions: number;
}

/** Records how many portions of a logged recipe batch are cooked — grocery list only, never nutrition. */
export function setCookedPortions(input: SetCookedPortionsInput): Promise<LogEntry[]> {
  return fetchJson<LogEntry[]>('/api/set-cooked-portions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
