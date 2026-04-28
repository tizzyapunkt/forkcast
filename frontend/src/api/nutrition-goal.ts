import { fetchJson, ApiError } from './client';
import type { DailyGoal } from '../domain/nutrition';

export async function getNutritionGoal(): Promise<DailyGoal | null> {
  try {
    return await fetchJson<DailyGoal>('/api/nutrition-goal');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function setNutritionGoal(goal: DailyGoal): Promise<DailyGoal> {
  return fetchJson<DailyGoal>('/api/nutrition-goal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(goal),
  });
}
