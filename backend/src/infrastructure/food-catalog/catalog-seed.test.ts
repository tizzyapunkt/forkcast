import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonCatalogStore } from './json-catalog.store.ts';
import { FileJsonDocument } from '../json-document/file-json-document.ts';
import { InMemoryJsonDocument } from '../json-document/in-memory-json-document.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';

const moehre: FoodEntry = {
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
};

const salz: FoodEntry = {
  id: 'salz',
  name: 'Salz',
  synonyms: [],
  unit: 'g',
  untracked: true,
  macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
};

/**
 * Seeding is the one behaviour whose failure destroys data, so it is covered
 * here rather than in a shell entrypoint: an existing catalog must survive a
 * deploy whose bundled starting point differs from it.
 */
describe('catalog seeding at boot', () => {
  let dir: string;
  let path: string;
  let seedPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'forkcast-seed-'));
    path = join(dir, 'catalog.json');
    seedPath = join(dir, 'catalog.seed.json');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('installs the bundled starting point when no catalog exists', async () => {
    writeFileSync(seedPath, JSON.stringify([moehre, salz], null, 2) + '\n', 'utf-8');

    const store = new JsonCatalogStore({ document: new FileJsonDocument(path), seed: new FileJsonDocument(seedPath) });
    await store.init();

    expect(store.list().map((e) => e.id)).toEqual(['moehre', 'salz']);
    expect(readFileSync(path, 'utf-8')).toBe(readFileSync(seedPath, 'utf-8'));
  });

  it('leaves an existing catalog byte-identical when the seed differs', async () => {
    const edited =
      JSON.stringify([{ ...moehre, macrosPer100: { ...moehre.macrosPer100, calories: 25 } }], null, 2) + '\n';
    writeFileSync(path, edited, 'utf-8');
    writeFileSync(seedPath, JSON.stringify([moehre, salz], null, 2) + '\n', 'utf-8');

    const store = new JsonCatalogStore({ document: new FileJsonDocument(path), seed: new FileJsonDocument(seedPath) });
    await store.init();

    expect(readFileSync(path, 'utf-8')).toBe(edited);
    expect(store.list().map((e) => e.id)).toEqual(['moehre']);
    expect(store.findById('moehre')?.macrosPer100.calories).toBe(25);
  });

  it('does not resurrect an entry the user deleted, across restarts', async () => {
    writeFileSync(seedPath, JSON.stringify([moehre, salz], null, 2) + '\n', 'utf-8');

    const first = new JsonCatalogStore({ document: new FileJsonDocument(path), seed: new FileJsonDocument(seedPath) });
    await first.init();
    await first.remove('salz');

    const second = new JsonCatalogStore({ document: new FileJsonDocument(path), seed: new FileJsonDocument(seedPath) });
    await second.init();

    expect(second.list().map((e) => e.id)).toEqual(['moehre']);
  });

  it('leaves a deliberately empty catalog alone rather than re-seeding it', async () => {
    writeFileSync(path, '[]\n', 'utf-8');
    writeFileSync(seedPath, JSON.stringify([moehre, salz], null, 2) + '\n', 'utf-8');

    const store = new JsonCatalogStore({ document: new FileJsonDocument(path), seed: new FileJsonDocument(seedPath) });
    await store.init();

    expect(store.list()).toEqual([]);
    expect(readFileSync(path, 'utf-8')).toBe('[]\n');
  });

  it('fails loudly, naming the expected seed path, when the seed is missing and no catalog exists', async () => {
    const store = new JsonCatalogStore({ document: new FileJsonDocument(path), seed: new FileJsonDocument(seedPath) });
    await expect(store.init()).rejects.toThrow(seedPath);
  });
});

describe('catalog seeding over in-memory documents', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs the seed into an empty document and keeps the seed untouched by later writes', async () => {
    const seedText = JSON.stringify([moehre], null, 2) + '\n';
    const seed = new InMemoryJsonDocument(seedText, 'seed');
    const document = new InMemoryJsonDocument(null, 'catalog');

    const store = new JsonCatalogStore({ document, seed });
    await store.init();
    expect(await document.read()).toBe(seedText);

    const added = await store.add(salz);
    expect(added.ok).toBe(true);

    expect(store.list().map((e) => e.id)).toEqual(['moehre', 'salz']);
    expect(await seed.read()).toBe(seedText);
  });
});
