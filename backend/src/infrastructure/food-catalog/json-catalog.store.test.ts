import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonCatalogStore } from './json-catalog.store.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const entry = (overrides: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  ...overrides,
});

const salz = entry({
  id: 'salz',
  name: 'Salz',
  synonyms: [],
  untracked: true,
  macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

describe('JsonCatalogStore', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'forkcast-catalog-'));
    path = join(dir, 'catalog.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const write = (entries: unknown[]) => writeFileSync(path, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
  const readBack = (): FoodEntry[] => JSON.parse(readFileSync(path, 'utf-8')) as FoodEntry[];

  describe('loading', () => {
    it('loads well-formed entries into a searchable index', async () => {
      write([entry(), salz]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      expect(store.list()).toHaveLength(2);
      expect(store.findById('moehre')?.name).toBe('Möhre');
      expect(store.indexed().find((e) => e.id === 'moehre')?.nameFolded).toBe('mohre');
    });

    it('treats a missing file as an empty catalog when no seed is configured', async () => {
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();
      expect(store.list()).toEqual([]);
    });

    it('skips an invalid entry with a single warning naming its id and still starts', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      write([entry(), { ...entry({ id: 'kaputt', name: 'Kaputt' }), macrosPer100: { calories: null } }]);

      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      expect(store.list().map((e) => e.id)).toEqual(['moehre']);
      const naming = warn.mock.calls.filter((c) => String(c[0]).includes('kaputt'));
      expect(naming).toHaveLength(1);
    });

    it('repairs a non-conforming id from the entry name rather than dropping the entry', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // The shape a pre-rename catalog can hold: a hand-written id with an umlaut.
      write([{ ...entry({ id: 'speisestärke', name: 'Speisestärke', synonyms: ['cornstarch'] }), density: 0.55 }]);

      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      expect(store.list().map((e) => e.id)).toEqual(['speisestaerke']);
      expect(store.findById('speisestaerke')?.name).toBe('Speisestärke');
      expect(store.findById('speisestaerke')?.density).toBe(0.55);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('speisestärke'));
    });

    it('still drops an entry whose name yields no usable id', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      write([entry({ id: '!!!', name: '!!!' })]);

      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      expect(store.list()).toEqual([]);
    });

    it('treats an unparseable file as empty rather than crashing', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      writeFileSync(path, '{ not json', 'utf-8');
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();
      expect(store.list()).toEqual([]);
    });
  });

  describe('add', () => {
    it('persists a new entry atomically and reads it back', async () => {
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      const result = await store.add(entry());
      expect(result.ok).toBe(true);
      expect(readBack().map((e) => e.id)).toEqual(['moehre']);
      expect(existsSync(`${path}.tmp`)).toBe(false);

      const reloaded = new JsonCatalogStore({ filePath: path });
      await reloaded.init();
      expect(reloaded.findById('moehre')?.name).toBe('Möhre');
    });

    it('rejects a duplicate id and leaves the catalog unchanged', async () => {
      write([entry()]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      const result = await store.add(entry({ name: 'Karotte gelb' }));
      expect(result).toEqual({ ok: false, kind: 'conflict', reason: expect.stringContaining('moehre') });
      expect(readBack()).toHaveLength(1);
      expect(store.list()).toHaveLength(1);
    });

    it('rejects an invalid entry without touching the file', async () => {
      write([entry()]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      const result = await store.add(entry({ id: 'Ungültig', name: 'Neu' }));
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.kind).toBe('invalid');
      expect(readBack()).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('replaces an entry, revalidates, and persists', async () => {
      write([entry()]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      const corrected = entry({ macrosPer100: { calories: 25, protein: 0.9, carbs: 9.6, fat: 0.2 } });
      const result = await store.update('moehre', corrected);

      expect(result.ok).toBe(true);
      expect(store.findById('moehre')?.macrosPer100.calories).toBe(25);
      expect(readBack()[0]!.macrosPer100.calories).toBe(25);
    });

    it('reports not-found for an unknown id', async () => {
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();
      const result = await store.update('gibtsnicht', entry({ id: 'gibtsnicht' }));
      expect(result).toEqual({ ok: false, kind: 'not-found', reason: expect.stringContaining('gibtsnicht') });
    });

    it('rejects an update that breaks validation and leaves the stored entry intact', async () => {
      write([entry()]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      const result = await store.update('moehre', entry({ untracked: true }));
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.kind).toBe('invalid');
      expect(store.findById('moehre')?.untracked).toBeUndefined();
      expect(readBack()[0]!.macrosPer100.calories).toBe(41);
    });

    it('allows renaming an entry to a name only it holds', async () => {
      write([entry(), salz]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      expect((await store.update('moehre', entry({ name: 'Möhre gelb' }))).ok).toBe(true);
      expect(store.findById('moehre')?.name).toBe('Möhre gelb');
    });

    it('rejects a rename onto another entry name', async () => {
      write([entry(), salz]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      const result = await store.update('moehre', entry({ name: 'Salz' }));
      expect(result.ok === false && result.kind).toBe('conflict');
    });
  });

  describe('remove', () => {
    it('deletes an entry from memory and from the file', async () => {
      write([entry(), salz]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      const result = await store.remove('moehre');
      expect(result.ok).toBe(true);
      expect(store.list().map((e) => e.id)).toEqual(['salz']);
      expect(readBack().map((e) => e.id)).toEqual(['salz']);
    });

    it('reports not-found for an unknown id', async () => {
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();
      expect(await store.remove('gibtsnicht')).toEqual({
        ok: false,
        kind: 'not-found',
        reason: expect.stringContaining('gibtsnicht'),
      });
    });
  });

  describe('addSynonym', () => {
    it('appends a synonym and persists it', async () => {
      write([entry()]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      const result = await store.addSynonym('moehre', 'Rübli');
      expect(result.ok).toBe(true);
      expect(store.findById('moehre')?.synonyms).toEqual(['Karotte', 'Rübli']);
      expect(readBack()[0]!.synonyms).toContain('Rübli');
    });

    it('deduplicates case- and diacritic-insensitively', async () => {
      write([entry()]);
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();

      await store.addSynonym('moehre', 'karotte');
      expect(store.findById('moehre')?.synonyms).toEqual(['Karotte']);
    });

    it('reports not-found for an unknown id', async () => {
      const store = new JsonCatalogStore({ filePath: path });
      await store.init();
      expect((await store.addSynonym('gibtsnicht', 'egal')).ok).toBe(false);
    });
  });

  it('keeps the persisted file ordered by id so writes stay diffable', async () => {
    const store = new JsonCatalogStore({ filePath: path });
    await store.init();
    await store.add(salz);
    await store.add(entry());
    expect(readBack().map((e) => e.id)).toEqual(['moehre', 'salz']);
  });
});
