import { describe, it, expect, vi } from 'vitest';
import { editLogEntry } from './edit-log-entry.use-case.ts';
import { removeLogEntry } from './remove-log-entry.use-case.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry } from './types.ts';

function makeFullEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'entry-1',
    date: '2026-04-20',
    slot: 'lunch',
    loggedAt: new Date().toISOString(),
    ingredient: {
      type: 'full',
      name: 'Chicken Breast',
      unit: 'g',
      macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
      amount: 200,
    },
    ...overrides,
  };
}

function makeQuickEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'entry-2',
    date: '2026-04-20',
    slot: 'snack',
    loggedAt: new Date().toISOString(),
    ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
    ...overrides,
  };
}

function makeRepo(entry: LogEntry): LogEntryRepository {
  return {
    save: vi.fn<(e: LogEntry) => Promise<void>>(),
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue([entry]),
    findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>(),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(entry),
    update: vi.fn<(e: LogEntry) => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

function makeEmptyRepo(): LogEntryRepository {
  return {
    save: vi.fn<(e: LogEntry) => Promise<void>>(),
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue([]),
    findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>(),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(null),
    update: vi.fn<(e: LogEntry) => Promise<void>>(),
    remove: vi.fn<(id: string) => Promise<void>>(),
  };
}

describe('editLogEntry', () => {
  it('updates the amount on a full entry', async () => {
    const repo = makeRepo(makeFullEntry());

    const updated = await editLogEntry(repo, { entryId: 'entry-1', type: 'full', amount: 350 });

    expect(updated.ingredient).toMatchObject({ type: 'full', amount: 350 });
    expect(repo.update).toHaveBeenCalledWith(updated);
  });

  it('preserves all other full entry fields when editing amount', async () => {
    const original = makeFullEntry();
    const repo = makeRepo(original);

    const updated = await editLogEntry(repo, { entryId: 'entry-1', type: 'full', amount: 100 });

    if (updated.ingredient.type !== 'full') throw new Error('expected full');
    expect(updated.ingredient.name).toBe('Chicken Breast');
    expect(updated.ingredient.unit).toBe('g');
    expect(updated.ingredient.macrosPerUnit).toEqual(
      original.ingredient.type === 'full' ? original.ingredient.macrosPerUnit : null,
    );
  });

  it('updates calories and macros on a quick entry', async () => {
    const repo = makeRepo(makeQuickEntry());

    const updated = await editLogEntry(repo, {
      entryId: 'entry-2',
      type: 'quick',
      calories: 200,
      protein: 20,
      carbs: 15,
      fat: 7,
    });

    expect(updated.ingredient).toMatchObject({ type: 'quick', calories: 200, protein: 20, carbs: 15, fat: 7 });
    expect(repo.update).toHaveBeenCalledWith(updated);
  });

  it('throws when the entry type does not match the edit command', async () => {
    const repo = makeRepo(makeFullEntry());

    await expect(editLogEntry(repo, { entryId: 'entry-1', type: 'quick', calories: 100 })).rejects.toThrow(
      "Cannot apply a 'quick' edit to a 'full' entry",
    );
  });

  it('throws when the entry does not exist', async () => {
    await expect(editLogEntry(makeEmptyRepo(), { entryId: 'missing', type: 'full', amount: 100 })).rejects.toThrow(
      'Log entry not found: missing',
    );
  });
});

describe('removeLogEntry', () => {
  it('removes the entry by id', async () => {
    const repo = makeRepo(makeFullEntry());

    await removeLogEntry(repo, 'entry-1');

    expect(repo.remove).toHaveBeenCalledWith('entry-1');
  });

  it('throws when the entry does not exist', async () => {
    await expect(removeLogEntry(makeEmptyRepo(), 'missing')).rejects.toThrow('Log entry not found: missing');
  });
});
