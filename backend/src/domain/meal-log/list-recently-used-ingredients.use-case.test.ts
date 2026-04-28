import { describe, it, expect, vi } from 'vitest';
import { listRecentlyUsedIngredients } from './list-recently-used-ingredients.use-case.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry, MacrosPer100, MeasurementUnit } from './types.ts';

function makeFullEntry(
  name: string,
  unit: MeasurementUnit,
  loggedAt: string,
  macrosPerUnit: MacrosPer100 = { calories: 1, protein: 0.1, carbs: 0.1, fat: 0.05 },
  amount = 100,
): LogEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    date: loggedAt.slice(0, 10),
    slot: 'lunch',
    loggedAt,
    ingredient: { type: 'full', name, unit, macrosPerUnit, amount },
  };
}

function makeQuickEntry(loggedAt: string): LogEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    date: loggedAt.slice(0, 10),
    slot: 'snack',
    loggedAt,
    ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
  };
}

function makeRepo(entries: LogEntry[]): LogEntryRepository {
  return {
    save: vi.fn<(entry: LogEntry) => Promise<void>>(),
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue(entries),
    findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>().mockResolvedValue([]),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(null),
    update: vi.fn<(entry: LogEntry) => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe('listRecentlyUsedIngredients', () => {
  it('returns an empty list when there is no log history', async () => {
    const result = await listRecentlyUsedIngredients(makeRepo([]));
    expect(result).toEqual([]);
  });

  it('returns an empty list when only quick entries exist', async () => {
    const result = await listRecentlyUsedIngredients(
      makeRepo([makeQuickEntry('2026-04-20T08:00:00.000Z'), makeQuickEntry('2026-04-21T08:00:00.000Z')]),
    );
    expect(result).toEqual([]);
  });

  it('returns a single result for a single full entry', async () => {
    const macros: MacrosPer100 = { calories: 1.5, protein: 0.13, carbs: 0.66, fat: 0.07 };
    const result = await listRecentlyUsedIngredients(
      makeRepo([makeFullEntry('Oats', 'g', '2026-04-20T08:00:00.000Z', macros)]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Oats',
      unit: 'g',
      macrosPerUnit: macros,
      lastUsedAt: '2026-04-20T08:00:00.000Z',
    });
  });

  it('collapses duplicate (name, unit) entries — latest wins for macros and lastUsedAt', async () => {
    const oldMacros: MacrosPer100 = { calories: 1.5, protein: 0.1, carbs: 0.6, fat: 0.05 };
    const newMacros: MacrosPer100 = { calories: 1.55, protein: 0.13, carbs: 0.66, fat: 0.07 };

    const result = await listRecentlyUsedIngredients(
      makeRepo([
        makeFullEntry('Oats', 'g', '2026-04-15T08:00:00.000Z', oldMacros),
        makeFullEntry('Oats', 'g', '2026-04-22T08:00:00.000Z', newMacros),
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result[0].macrosPerUnit).toEqual(newMacros);
    expect(result[0].lastUsedAt).toBe('2026-04-22T08:00:00.000Z');
  });

  it('treats the same name with different units as distinct ingredients', async () => {
    const result = await listRecentlyUsedIngredients(
      makeRepo([
        makeFullEntry('Milk', 'ml', '2026-04-20T08:00:00.000Z'),
        makeFullEntry('Milk', 'cup', '2026-04-21T08:00:00.000Z'),
      ]),
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.unit).sort()).toEqual(['cup', 'ml']);
  });

  it('collapses entries with the same name in different cases', async () => {
    const result = await listRecentlyUsedIngredients(
      makeRepo([
        makeFullEntry('Skyr', 'g', '2026-04-20T08:00:00.000Z'),
        makeFullEntry('skyr', 'g', '2026-04-22T08:00:00.000Z'),
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].lastUsedAt).toBe('2026-04-22T08:00:00.000Z');
  });

  it('sorts results by lastUsedAt descending', async () => {
    const result = await listRecentlyUsedIngredients(
      makeRepo([
        makeFullEntry('A', 'g', '2026-04-20T08:00:00.000Z'),
        makeFullEntry('B', 'g', '2026-04-22T08:00:00.000Z'),
        makeFullEntry('C', 'g', '2026-04-15T08:00:00.000Z'),
      ]),
    );
    expect(result.map((r) => r.name)).toEqual(['B', 'A', 'C']);
  });

  it('ignores quick entries when computing the list (mixed history)', async () => {
    const result = await listRecentlyUsedIngredients(
      makeRepo([makeQuickEntry('2026-04-23T08:00:00.000Z'), makeFullEntry('Oats', 'g', '2026-04-20T08:00:00.000Z')]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Oats');
  });
});
