import { describe, it, expect, afterEach } from 'vite-plus/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonLogEntryRepository } from './json-log-entry.repository.ts';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function freshFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'forkcast-repo-'));
  tmpDirs.push(dir);
  return join(dir, 'log-entries.json');
}

describe('JsonLogEntryRepository — recipeId compatibility', () => {
  it('loads pre-existing entries without recipeId', async () => {
    const path = freshFile();
    writeFileSync(
      path,
      JSON.stringify([
        {
          id: 'old-1',
          date: '2026-04-01',
          slot: 'breakfast',
          loggedAt: '2026-04-01T07:00:00.000Z',
          ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
        },
      ]),
    );

    const repo = new JsonLogEntryRepository(path);
    const entries = await repo.findAll();

    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe('old-1');
    expect(entries[0]?.recipeId).toBeUndefined();
  });

  it('roundtrips recipeId on save and findAll', async () => {
    const path = freshFile();
    const repo = new JsonLogEntryRepository(path);
    await repo.init();

    await repo.save({
      id: 'r-1',
      date: '2026-04-28',
      slot: 'lunch',
      loggedAt: '2026-04-28T12:00:00.000Z',
      recipeId: 'rec-42',
      ingredient: {
        type: 'full',
        name: 'Rice',
        unit: 'g',
        macrosPerUnit: { calories: 1.3, protein: 0.027, carbs: 0.28, fat: 0.003 },
        amount: 100,
      },
    });

    const loaded = await repo.findAll();
    expect(loaded[0]?.recipeId).toBe('rec-42');
  });

  it('roundtrips entries without recipeId unchanged', async () => {
    const path = freshFile();
    const repo = new JsonLogEntryRepository(path);
    await repo.init();

    await repo.save({
      id: 'p-1',
      date: '2026-04-28',
      slot: 'snack',
      loggedAt: '2026-04-28T15:00:00.000Z',
      ingredient: { type: 'quick', label: 'Apple', calories: 80 },
    });

    const loaded = await repo.findAll();
    expect(loaded[0]?.recipeId).toBeUndefined();
  });
});

describe('JsonLogEntryRepository — recipe batch metadata', () => {
  const fullIngredient = {
    type: 'full',
    name: 'Rice',
    unit: 'g',
    macrosPerUnit: { calories: 1.3, protein: 0.027, carbs: 0.28, fat: 0.003 },
    amount: 100,
  } as const;

  it('roundtrips recipeBatchId and recipePortions on save and findAll', async () => {
    const path = freshFile();
    const repo = new JsonLogEntryRepository(path);
    await repo.init();

    await repo.save({
      id: 'b-1',
      date: '2026-06-11',
      slot: 'lunch',
      loggedAt: '2026-06-11T12:00:00.000Z',
      recipeId: 'rec-42',
      recipeBatchId: 'batch-7',
      recipePortions: 2,
      ingredient: fullIngredient,
    });

    const loaded = await repo.findAll();
    expect(loaded[0]?.recipeBatchId).toBe('batch-7');
    expect(loaded[0]?.recipePortions).toBe(2);
  });

  it('loads legacy entries (recipeId without batch metadata) with undefined batch fields', async () => {
    const path = freshFile();
    writeFileSync(
      path,
      JSON.stringify([
        {
          id: 'legacy-1',
          date: '2026-06-01',
          slot: 'lunch',
          loggedAt: '2026-06-01T12:00:00.000Z',
          recipeId: 'rec-42',
          ingredient: fullIngredient,
        },
      ]),
    );

    const repo = new JsonLogEntryRepository(path);
    const entries = await repo.findAll();

    expect(entries[0]?.recipeId).toBe('rec-42');
    expect(entries[0]?.recipeBatchId).toBeUndefined();
    expect(entries[0]?.recipePortions).toBeUndefined();
  });

  it('removeMany deletes exactly the given ids in one write and leaves the rest', async () => {
    const path = freshFile();
    const repo = new JsonLogEntryRepository(path);
    await repo.init();

    const mk = (id: string) => ({
      id,
      date: '2026-06-11',
      slot: 'lunch' as const,
      loggedAt: '2026-06-11T12:00:00.000Z',
      ingredient: fullIngredient,
    });
    await repo.saveMany([mk('a'), mk('b'), mk('c')]);

    await repo.removeMany(['a', 'c']);

    const remaining = await repo.findAll();
    expect(remaining.map((e) => e.id)).toEqual(['b']);
  });
});

describe('JsonLogEntryRepository — replaceMany', () => {
  const entry = (id: string, amount: number) => ({
    id,
    date: '2026-10-12',
    slot: 'dinner' as const,
    loggedAt: '2026-10-09T10:00:00.000Z',
    recipeBatchId: 'b1',
    ingredient: {
      type: 'full' as const,
      name: id,
      unit: 'g' as const,
      macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
      amount,
    },
  });

  it('removes, replaces in place and appends in one write', async () => {
    const path = freshFile();
    const repo = new JsonLogEntryRepository(path);
    await repo.saveMany([entry('a', 1), entry('b', 2), entry('c', 3)]);

    await repo.replaceMany(['a', 'b'], [entry('b', 20), entry('d', 4)]);

    const stored = await repo.findAll();
    expect(stored.map((e) => [e.id, e.ingredient.type === 'full' ? e.ingredient.amount : 0])).toEqual([
      ['b', 20],
      ['c', 3],
      ['d', 4],
    ]);
  });

  it('writes nothing when there is nothing to change', async () => {
    const path = freshFile();
    const repo = new JsonLogEntryRepository(path);

    await repo.replaceMany([], []);

    expect(await repo.findAll()).toEqual([]);
  });
});
