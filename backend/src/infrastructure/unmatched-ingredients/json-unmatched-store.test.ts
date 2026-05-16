import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonUnmatchedIngredientStore } from './json-unmatched-store.ts';

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'unmatched-store-'));
  filePath = join(dir, 'unmatched-ingredients.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('JsonUnmatchedIngredientStore', () => {
  it('round-trips a non-empty store with sorted entries and trailing newline', async () => {
    const store = new JsonUnmatchedIngredientStore(filePath);
    await store.init();

    await store.record({ name: 'Zucker' });
    await store.record({ name: 'Apfel' });

    const text = readFileSync(filePath, 'utf-8');
    expect(text.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(text) as { entries: Array<{ foldedName: string }> };
    expect(parsed.entries.map((e) => e.foldedName)).toEqual(['apfel', 'zucker']);

    const reloaded = await store.load();
    expect(reloaded.entries.map((e) => e.foldedName)).toEqual(['apfel', 'zucker']);
  });

  it('serializes concurrent record() calls and arrives at the correct final count', async () => {
    const store = new JsonUnmatchedIngredientStore(filePath);
    await store.init();

    await Promise.all(Array.from({ length: 10 }, () => store.record({ name: 'Buchweizenmehl', unit: 'g' })));

    const result = await store.load();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.count).toBe(10);
    expect(result.entries[0]?.samples).toHaveLength(5);
  });

  it('returns empty store when the file does not exist and creates the file on first write', async () => {
    const store = new JsonUnmatchedIngredientStore(filePath);
    await store.init();

    expect(existsSync(filePath)).toBe(false);
    const initial = await store.load();
    expect(initial).toEqual({ entries: [] });

    await store.record({ name: 'Apfel' });
    expect(existsSync(filePath)).toBe(true);
  });

  it('drops entries with non-string name or non-finite count on load with a warning, keeping valid ones', async () => {
    const malformed = {
      entries: [
        { name: 123, foldedName: 'bad', count: 1, firstSeenAt: 't', lastSeenAt: 't', samples: [] },
        { name: 'good', foldedName: 'good', count: Number.NaN, firstSeenAt: 't', lastSeenAt: 't', samples: [] },
        { name: 'Apfel', foldedName: 'apfel', count: 2, firstSeenAt: 't', lastSeenAt: 't', samples: [] },
      ],
    };
    writeFileSync(filePath, JSON.stringify(malformed), 'utf-8');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const store = new JsonUnmatchedIngredientStore(filePath);
    await store.init();
    const loaded = await store.load();

    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0]?.name).toBe('Apfel');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('clear() empties the store atomically', async () => {
    const store = new JsonUnmatchedIngredientStore(filePath);
    await store.init();
    await store.record({ name: 'Apfel' });
    await store.record({ name: 'Birne' });

    await store.clear();

    const result = await store.load();
    expect(result).toEqual({ entries: [] });
  });
});
