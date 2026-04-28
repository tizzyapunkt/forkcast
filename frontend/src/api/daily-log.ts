import { fetchJson } from './client';
import type { DailyLog } from '../domain/meal-log';

export function getDailyLog(date: string): Promise<DailyLog> {
  return fetchJson<DailyLog>(`/api/daily-log/${date}`);
}
