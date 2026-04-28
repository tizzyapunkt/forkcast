import { describe, it, expect, vi } from 'vitest';
import { logIngredient } from './log-ingredient.use-case.ts';
import type { LogEntryRepository } from './log-entry.repository.ts';
import type { LogEntry } from './types.ts';

const makeRepo = (): LogEntryRepository => ({
  save: vi.fn<(entry: LogEntry) => Promise<void>>().mockResolvedValue(undefined),
  findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue([]),
  findByDate: vi.fn<(date: string) => Promise<LogEntry[]>>().mockResolvedValue([]),
  findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(null),
  update: vi.fn<(entry: LogEntry) => Promise<void>>().mockResolvedValue(undefined),
  remove: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
});

describe('logIngredient', () => {
  it('creates and saves a quick log entry', async () => {
    const repo = makeRepo();

    const entry = await logIngredient(repo, {
      date: '2026-04-19',
      slot: 'breakfast',
      ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
    });

    expect(entry.date).toBe('2026-04-19');
    expect(entry.slot).toBe('breakfast');
    expect(entry.ingredient).toMatchObject({ type: 'quick', label: 'Coffee', calories: 5 });
    expect(repo.save).toHaveBeenCalledWith(entry);
  });

  it('creates and saves a quick log entry with macros', async () => {
    const repo = makeRepo();

    const entry = await logIngredient(repo, {
      date: '2026-04-19',
      slot: 'snack',
      ingredient: { type: 'quick', label: 'Protein bar', calories: 200, protein: 20, carbs: 15, fat: 7 },
    });

    expect(entry.ingredient).toMatchObject({ protein: 20, carbs: 15, fat: 7 });
    expect(repo.save).toHaveBeenCalledWith(entry);
  });

  it('creates and saves a full log entry', async () => {
    const repo = makeRepo();

    const entry = await logIngredient(repo, {
      date: '2026-04-19',
      slot: 'lunch',
      ingredient: {
        type: 'full',
        name: 'Chicken Breast',
        unit: 'g',
        macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
        amount: 200,
      },
    });

    expect(entry.slot).toBe('lunch');
    expect(entry.ingredient).toMatchObject({ type: 'full', name: 'Chicken Breast', amount: 200, unit: 'g' });
    expect(repo.save).toHaveBeenCalledWith(entry);
  });

  it('assigns a unique id and loggedAt to every entry', async () => {
    const repo = makeRepo();

    const [a, b] = await Promise.all([
      logIngredient(repo, {
        date: '2026-04-19',
        slot: 'breakfast',
        ingredient: { type: 'quick', label: 'A', calories: 1 },
      }),
      logIngredient(repo, {
        date: '2026-04-19',
        slot: 'breakfast',
        ingredient: { type: 'quick', label: 'B', calories: 2 },
      }),
    ]);

    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect(a.loggedAt).toBeTruthy();
    expect(b.loggedAt).toBeTruthy();
  });
});
