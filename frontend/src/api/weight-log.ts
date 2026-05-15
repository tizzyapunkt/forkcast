import { fetchJson } from './client';
import type { LogWeightResult, TrendSnapshot, WeightEntry } from '../domain/weight-log';

export interface LogWeightInput {
  date: string;
  weightKg: number;
}

export function logWeight(input: LogWeightInput): Promise<LogWeightResult> {
  return fetchJson<LogWeightResult>('/api/weight-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function listWeightEntries(): Promise<WeightEntry[]> {
  const body = await fetchJson<{ entries: WeightEntry[] }>('/api/weight-log');
  return body.entries;
}

export function getWeightTrend(asOf?: string): Promise<TrendSnapshot> {
  const path = asOf ? `/api/weight-log/trend?asOf=${encodeURIComponent(asOf)}` : '/api/weight-log/trend';
  return fetchJson<TrendSnapshot>(path);
}

export async function removeWeight(date: string): Promise<void> {
  const res = await fetch(`/api/weight-log/${encodeURIComponent(date)}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to remove weight entry: ${res.status}`);
  }
}
