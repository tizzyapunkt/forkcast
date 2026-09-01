import { describe, it, expect, vi } from 'vitest';
import { listFavoriteIngredients } from './list-favorite-ingredients.use-case.ts';
import { FakeFavoriteIngredientRepository } from './favorite-ingredient.repository.fake.ts';
import type { FavoriteIngredient } from './types.ts';
import type { LogEntryRepository } from '../meal-log/log-entry.repository.ts';
import type { LogEntry, MeasurementUnit } from '../meal-log/types.ts';

const macros = { calories: 0.63, protein: 0.11, carbs: 0.04, fat: 0.002 };

function favorite(name: string, favoritedAt: string, unit: FavoriteIngredient['unit'] = 'g'): FavoriteIngredient {
  return { name, unit, macrosPerUnit: macros, favoritedAt };
}

function fullEntry(name: string, amount: number, loggedAt: string, unit: MeasurementUnit = 'g'): LogEntry {
  return {
    id: `entry-${name}-${loggedAt}`,
    date: loggedAt.slice(0, 10),
    slot: 'breakfast',
    loggedAt,
    ingredient: { type: 'full', name, unit, macrosPerUnit: macros, amount },
  };
}

function quickEntry(label: string, loggedAt: string): LogEntry {
  return {
    id: `quick-${loggedAt}`,
    date: loggedAt.slice(0, 10),
    slot: 'snack',
    loggedAt,
    ingredient: { type: 'quick', label, calories: 120 },
  };
}

function makeLogRepo(entries: LogEntry[]): LogEntryRepository {
  return {
    save: vi.fn<(entry: LogEntry) => Promise<void>>(),
    saveMany: vi.fn<(entries: LogEntry[]) => Promise<void>>(),
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue(entries),
    findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>().mockResolvedValue([]),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(null),
    update: vi.fn<(entry: LogEntry) => Promise<void>>(),
    remove: vi.fn<(id: string) => Promise<void>>(),
    removeMany: vi.fn<(ids: string[]) => Promise<void>>(),
  };
}

describe('listFavoriteIngredients', () => {
  it('returns an empty list when nothing is favorited', async () => {
    const listed = await listFavoriteIngredients(new FakeFavoriteIngredientRepository(), makeLogRepo([]));

    expect(listed).toEqual([]);
  });

  it('takes the last amount from the most recent full entry', async () => {
    const favorites = new FakeFavoriteIngredientRepository([favorite('Haferflocken', '2026-01-01T08:00:00.000Z')]);
    const logs = makeLogRepo([
      fullEntry('Haferflocken', 60, '2026-02-01T07:00:00.000Z'),
      fullEntry('Haferflocken', 80, '2026-02-08T07:00:00.000Z'),
    ]);

    const [listed] = await listFavoriteIngredients(favorites, logs);

    expect(listed?.lastAmount).toBe(80);
    expect(listed?.lastUsedAt).toBe('2026-02-08T07:00:00.000Z');
  });

  it('matches log history case-insensitively', async () => {
    const favorites = new FakeFavoriteIngredientRepository([favorite('Skyr', '2026-01-01T08:00:00.000Z')]);
    const logs = makeLogRepo([fullEntry('skyr', 180, '2026-02-01T07:00:00.000Z')]);

    const [listed] = await listFavoriteIngredients(favorites, logs);

    expect(listed?.lastAmount).toBe(180);
  });

  it('does not match an entry with the same name under another unit', async () => {
    const favorites = new FakeFavoriteIngredientRepository([favorite('Milch', '2026-01-01T08:00:00.000Z', 'ml')]);
    const logs = makeLogRepo([fullEntry('Milch', 200, '2026-02-01T07:00:00.000Z', 'g')]);

    const [listed] = await listFavoriteIngredients(favorites, logs);

    expect(listed?.lastAmount).toBeUndefined();
  });

  it('ignores quick entries', async () => {
    const favorites = new FakeFavoriteIngredientRepository([favorite('Kaffee', '2026-01-01T08:00:00.000Z')]);
    const logs = makeLogRepo([quickEntry('Kaffee', '2026-02-01T07:00:00.000Z')]);

    const [listed] = await listFavoriteIngredients(favorites, logs);

    expect(listed?.lastAmount).toBeUndefined();
    expect(listed?.lastUsedAt).toBeUndefined();
  });

  it('omits both fields for a never-logged favorite', async () => {
    const favorites = new FakeFavoriteIngredientRepository([favorite('Erdnussbutter', '2026-01-01T08:00:00.000Z')]);

    const [listed] = await listFavoriteIngredients(favorites, makeLogRepo([]));

    expect(listed && 'lastAmount' in listed).toBe(false);
    expect(listed && 'lastUsedAt' in listed).toBe(false);
  });

  it('keeps the stored snapshot rather than the logged macros', async () => {
    const favorites = new FakeFavoriteIngredientRepository([favorite('Skyr', '2026-01-01T08:00:00.000Z')]);
    const logs = makeLogRepo([fullEntry('Skyr', 180, '2026-02-01T07:00:00.000Z')]);

    const [listed] = await listFavoriteIngredients(favorites, logs);

    expect(listed).toMatchObject({
      name: 'Skyr',
      unit: 'g',
      macrosPerUnit: macros,
      favoritedAt: '2026-01-01T08:00:00.000Z',
    });
  });

  it('sorts used favorites by last use, then never-used by favoritedAt, both descending', async () => {
    const favorites = new FakeFavoriteIngredientRepository([
      favorite('NeverOld', '2026-01-01T08:00:00.000Z'),
      favorite('UsedLastWeek', '2026-01-02T08:00:00.000Z'),
      favorite('NeverNew', '2026-01-03T08:00:00.000Z'),
      favorite('UsedToday', '2026-01-04T08:00:00.000Z'),
    ]);
    const logs = makeLogRepo([
      fullEntry('UsedLastWeek', 50, '2026-02-01T07:00:00.000Z'),
      fullEntry('UsedToday', 90, '2026-02-08T07:00:00.000Z'),
    ]);

    const listed = await listFavoriteIngredients(favorites, logs);

    expect(listed.map((f) => f.name)).toEqual(['UsedToday', 'UsedLastWeek', 'NeverNew', 'NeverOld']);
  });
});
