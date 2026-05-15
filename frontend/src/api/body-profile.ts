import { fetchJson, ApiError } from './client';
import type { BodyProfile, BodyProfileWithComputed } from '../domain/body-profile';
import type { DailyGoal } from '../domain/nutrition';

export async function getBodyProfile(): Promise<BodyProfileWithComputed | null> {
  try {
    return await fetchJson<BodyProfileWithComputed>('/api/body-profile');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function saveBodyProfile(profile: BodyProfile): Promise<BodyProfileWithComputed> {
  return fetchJson<BodyProfileWithComputed>('/api/body-profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
}

export function applyBodyProfileAsGoals(): Promise<DailyGoal> {
  return fetchJson<DailyGoal>('/api/body-profile/apply-as-goals', { method: 'POST' });
}
