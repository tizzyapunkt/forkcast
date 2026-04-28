import { fetchJson } from './client';
import type { LogEntry } from '../domain/meal-log';

export type EditLogEntryPatch =
  | { type: 'full'; amount: number }
  | { type: 'quick'; calories: number; protein?: number; carbs?: number; fat?: number };

export function editLogEntry(id: string, patch: EditLogEntryPatch): Promise<LogEntry> {
  return fetchJson<LogEntry>(`/api/log-entry/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}
