import type { FoodEntry } from '../src/domain/foods/types.ts';
import { validateFoodEntry } from '../src/domain/foods/validate-food-entry.ts';
import { fold } from '../src/domain/ingredient-search/fold.ts';

function sanitizeEntry(entry: FoodEntry): FoodEntry {
  if (!entry || typeof entry.name !== 'string' || !Array.isArray(entry.synonyms)) return entry;
  const folded = fold(entry.name);
  const synonyms = entry.synonyms.filter((s) => typeof s === 'string' && fold(s) !== folded);
  return synonyms.length === entry.synonyms.length ? entry : { ...entry, synonyms };
}

export function chunkKeys(keys: ReadonlyArray<string>, batchSize: number): string[][] {
  if (batchSize <= 0) throw new Error('batchSize must be > 0');
  const out: string[][] = [];
  for (let i = 0; i < keys.length; i += batchSize) {
    out.push(keys.slice(i, i + batchSize));
  }
  return out;
}

export interface CollectResult {
  entries: FoodEntry[];
  errors: string[];
}

export interface CollectOptions {
  /** Keys that the seed list marked as untracked. The AI output must echo `untracked: true` for these. */
  untrackedKeys?: ReadonlySet<string>;
}

export function collectEntries(
  requestedIds: ReadonlyArray<string>,
  candidate: ReadonlyArray<FoodEntry>,
  options: CollectOptions = {},
): CollectResult {
  const errors: string[] = [];
  const byId = new Map<string, FoodEntry>();
  for (const e of candidate) {
    if (e && typeof e.id === 'string') byId.set(e.id, e);
  }
  const untrackedKeys = options.untrackedKeys ?? new Set<string>();
  const collected: FoodEntry[] = [];
  for (const id of requestedIds) {
    const raw = byId.get(id);
    if (!raw) {
      errors.push(`missing entry for id "${id}"`);
      continue;
    }
    const entry = sanitizeEntry(raw);
    const isSeedUntracked = untrackedKeys.has(id);

    if (isSeedUntracked && entry.untracked !== true) {
      errors.push(`entry ${id}: seed marks key as untracked but AI output did not set untracked: true`);
      continue;
    }
    if (!isSeedUntracked && entry.untracked === true) {
      errors.push(`entry ${id}: AI output set untracked: true but seed key is tracked`);
      continue;
    }

    const result = validateFoodEntry(entry);
    if (!result.ok) {
      errors.push(result.reason);
      continue;
    }
    collected.push(result.entry);
  }
  return { entries: collected, errors };
}

export function sortEntriesById(entries: ReadonlyArray<FoodEntry>): FoodEntry[] {
  return [...entries].sort((a, b) => a.id.localeCompare(b.id));
}

export function formatFoodsJson(entries: ReadonlyArray<FoodEntry>): string {
  return JSON.stringify(entries, null, 2) + '\n';
}
