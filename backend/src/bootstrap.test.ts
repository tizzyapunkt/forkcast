import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrap } from './bootstrap.ts';
import { JsonLogEntryRepository } from './infrastructure/meal-log/json-log-entry.repository.ts';
import { JsonNutritionGoalRepository } from './infrastructure/nutrition/json-nutrition-goal.repository.ts';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function freshDataDir(): string {
  const parent = mkdtempSync(join(tmpdir(), 'forkcast-bootstrap-'));
  tmpDirs.push(parent);
  return join(parent, 'data');
}

describe('bootstrap', () => {
  it('creates the data directory and unblocks writes for all persistence adapters', async () => {
    const dataDir = freshDataDir();
    const logRepo = new JsonLogEntryRepository(join(dataDir, 'log-entries.json'));
    const goalRepo = new JsonNutritionGoalRepository(join(dataDir, 'nutrition-goal.json'));

    expect(existsSync(dataDir)).toBe(false);

    await bootstrap([logRepo, goalRepo]);

    expect(existsSync(dataDir)).toBe(true);

    await logRepo.save({
      id: 'entry-1',
      date: '2026-04-23',
      slot: 'breakfast',
      ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
      loggedAt: '2026-04-23T07:00:00.000Z',
    });
    await goalRepo.save({ calories: 2200, protein: 160, carbs: 220, fat: 70 });

    expect(await logRepo.findByDate('2026-04-23')).toHaveLength(1);
    expect(await goalRepo.get()).toEqual({ calories: 2200, protein: 160, carbs: 220, fat: 70 });
  });

  it('is idempotent — running it twice on the same paths is a no-op', async () => {
    const dataDir = freshDataDir();
    const logRepo = new JsonLogEntryRepository(join(dataDir, 'log-entries.json'));

    await bootstrap([logRepo]);
    await logRepo.save({
      id: 'entry-1',
      date: '2026-04-23',
      slot: 'breakfast',
      ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
      loggedAt: '2026-04-23T07:00:00.000Z',
    });

    await bootstrap([logRepo]);

    expect(await logRepo.findByDate('2026-04-23')).toHaveLength(1);
  });
});
