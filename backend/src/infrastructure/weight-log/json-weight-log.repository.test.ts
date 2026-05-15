import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonWeightLogRepository } from './json-weight-log.repository.ts';
import type { WeightEntry } from '../../domain/weight-log/types.ts';

describe('JsonWeightLogRepository', () => {
  let dir: string;
  let filePath: string;
  let repo: JsonWeightLogRepository;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'weight-log-test-'));
    filePath = join(dir, 'nested', 'weight-log.json');
    repo = new JsonWeightLogRepository(filePath);
    await repo.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns an empty list when the file does not exist', async () => {
    expect(await repo.list()).toEqual([]);
  });

  it('creates the parent directory on init', async () => {
    // init() ran in beforeEach; writing should now succeed without ENOENT.
    await expect(repo.upsert({ date: '2026-05-14', weightKg: 78.4 })).resolves.toBeUndefined();
  });

  it('persists across re-instantiation', async () => {
    await repo.upsert({ date: '2026-05-14', weightKg: 78.4 });
    const fresh = new JsonWeightLogRepository(filePath);
    expect(await fresh.list()).toEqual([{ date: '2026-05-14', weightKg: 78.4 }]);
  });

  it('upserts by date (replaces the prior value)', async () => {
    await repo.upsert({ date: '2026-05-14', weightKg: 78.4 });
    await repo.upsert({ date: '2026-05-14', weightKg: 78.2 });
    expect(await repo.list()).toEqual([{ date: '2026-05-14', weightKg: 78.2 }]);
  });

  it('rounds weightKg to two decimal places on write', async () => {
    await repo.upsert({ date: '2026-05-14', weightKg: 78.4567 });
    const persisted = JSON.parse(await readFile(filePath, 'utf-8')) as WeightEntry[];
    expect(persisted).toEqual([{ date: '2026-05-14', weightKg: 78.46 }]);
  });

  it('keeps multiple distinct dates', async () => {
    await repo.upsert({ date: '2026-05-13', weightKg: 78.5 });
    await repo.upsert({ date: '2026-05-14', weightKg: 78.4 });
    expect((await repo.list()).map((e) => e.date)).toEqual(['2026-05-13', '2026-05-14']);
  });

  it('removes an entry by date', async () => {
    await repo.upsert({ date: '2026-05-14', weightKg: 78.4 });
    await repo.remove('2026-05-14');
    expect(await repo.list()).toEqual([]);
  });

  it('remove() is idempotent when the date is absent', async () => {
    await repo.upsert({ date: '2026-05-14', weightKg: 78.4 });
    await repo.remove('2026-05-10');
    expect(await repo.list()).toEqual([{ date: '2026-05-14', weightKg: 78.4 }]);
  });
});
