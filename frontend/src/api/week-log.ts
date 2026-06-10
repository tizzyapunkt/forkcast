import { fetchJson } from './client';
import type { WeekLog } from '../domain/meal-log';

export function getWeekLog(startDate: string): Promise<WeekLog> {
  return fetchJson<WeekLog>(`/api/week-log/${startDate}`);
}

export interface CopyLogDayInput {
  fromDate: string;
  toDate: string;
}

export function copyLogDay(input: CopyLogDayInput): Promise<unknown> {
  return fetchJson('/api/copy-log-day', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
