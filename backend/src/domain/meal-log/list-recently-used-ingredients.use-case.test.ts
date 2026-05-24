import { describe, it, expect, vi } from 'vitest';
import { listRecentlyUsedIngredients } from './list-recently-used-ingredients.use-case.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry, MacrosPerUnit, MeasurementUnit } from './types.ts';

function makeFullEntry(
  name: string,
  unit: MeasurementUnit,
  loggedAt: string,
  macrosPerUnit: MacrosPerUnit = { calories: 1, protein: 0.1, carbs: 0.1, fat: 0.05 },
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
    saveMany: vi.fn<(entries: LogEntry[]) => Promise<void>>(),
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
    const macros: MacrosPerUnit = { calories: 1.5, protein: 0.13, carbs: 0.66, fat: 0.07 };
    const result = await listRecentlyUsedIngredients(
      makeRepo([makeFullEntry('Oats', 'g', '2026-04-20T08:00:00.000Z', macros, 80)]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Oats',
      unit: 'g',
      macrosPerUnit: macros,
      lastUsedAt: '2026-04-20T08:00:00.000Z',
      lastAmount: 80,
    });
  });

  it('collapses duplicate (name, unit) entries — latest wins for macros, lastUsedAt, and lastAmount', async () => {
    const oldMacros: MacrosPerUnit = { calories: 1.5, protein: 0.1, carbs: 0.6, fat: 0.05 };
    const newMacros: MacrosPerUnit = { calories: 1.55, protein: 0.13, carbs: 0.66, fat: 0.07 };

    const result = await listRecentlyUsedIngredients(
      makeRepo([
        makeFullEntry('Oats', 'g', '2026-04-15T08:00:00.000Z', oldMacros, 60),
        makeFullEntry('Oats', 'g', '2026-04-22T08:00:00.000Z', newMacros, 80),
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result[0].macrosPerUnit).toEqual(newMacros);
    expect(result[0].lastUsedAt).toBe('2026-04-22T08:00:00.000Z');
    expect(result[0].lastAmount).toBe(80);
  });

  it('treats the same name with different units as distinct ingredients, each with its own lastAmount', async () => {
    const result = await listRecentlyUsedIngredients(
      makeRepo([
        makeFullEntry('Milk', 'ml', '2026-04-20T08:00:00.000Z', undefined, 250),
        makeFullEntry('Milk', 'cup', '2026-04-21T08:00:00.000Z', undefined, 1),
      ]),
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.unit).sort()).toEqual(['cup', 'ml']);
    const byUnit = Object.fromEntries(result.map((r) => [r.unit, r.lastAmount]));
    expect(byUnit['ml']).toBe(250);
    expect(byUnit['cup']).toBe(1);
  });

  it('collapses entries with the same name in different cases and keeps the latest amount', async () => {
    const result = await listRecentlyUsedIngredients(
      makeRepo([
        makeFullEntry('Skyr', 'g', '2026-04-20T08:00:00.000Z', undefined, 150),
        makeFullEntry('skyr', 'g', '2026-04-22T08:00:00.000Z', undefined, 200),
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].lastUsedAt).toBe('2026-04-22T08:00:00.000Z');
    expect(result[0].lastAmount).toBe(200);
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
