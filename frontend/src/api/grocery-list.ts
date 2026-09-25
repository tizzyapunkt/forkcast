import { fetchJson } from './client';
import type { GroceryList } from '../domain/grocery-list';

export function getGroceryList(startDate: string): Promise<GroceryList> {
  return fetchJson<GroceryList>(`/api/grocery-list/${startDate}`);
}
