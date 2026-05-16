import { fetchJson } from './client';

export interface UnmatchedIngredientSample {
  rawName: string;
  rawUnit?: 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece';
  rawDisplayUnitLabel?: string;
}

export interface UnmatchedIngredientEntry {
  name: string;
  foldedName: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  samples: UnmatchedIngredientSample[];
}

export async function fetchUnmatchedIngredients(): Promise<UnmatchedIngredientEntry[]> {
  const body = await fetchJson<{ entries: UnmatchedIngredientEntry[] }>('/api/unmatched-ingredients/export');
  return body.entries;
}

export async function clearUnmatchedIngredients(): Promise<void> {
  const res = await fetch('/api/unmatched-ingredients/clear', { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to clear unmatched ingredients: ${res.status}`);
  }
}
