import { describe, it, expect } from 'vitest';
import { confirmResolution } from './confirm-resolution.use-case.ts';
import { FakeCatalogStore } from '../food-catalog/catalog-store.fake.ts';
import type { FoodEntry } from '../foods/types.ts';

const kirsch: FoodEntry = {
  id: 'kirschtomaten',
  name: 'Kirschtomaten',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
};

const oliven: FoodEntry = {
  id: 'oliven',
  name: 'Oliven',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 145, protein: 1, carbs: 6, fat: 15 },
};

describe('confirmResolution — new-food', () => {
  it('appends the entry to the catalog and returns a CATALOG-sourced row with the original amount', async () => {
    const catalog = new FakeCatalogStore();

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'new-food',
        entry: kirsch,
        original: { amount: 50, unit: 'g' },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(catalog.findById('kirschtomaten')).toEqual(kirsch);
    expect(result.ingredient).toMatchObject({
      matched: true,
      name: 'Kirschtomaten',
      unit: 'g',
      amount: 50,
      source: 'CATALOG',
    });
    expect(result.ingredient.macrosPerUnit.calories).toBeCloseTo(0.2);
    expect(result.ingredient.macrosPerUnit.protein).toBeCloseTo(0.009);
  });

  it('preserves the note', async () => {
    const result = await confirmResolution(
      { catalog: new FakeCatalogStore() },
      { kind: 'new-food', entry: kirsch, original: { amount: 50, unit: 'g', note: 'halbiert' } },
    );
    expect(result.ok && result.ingredient.note).toBe('halbiert');
  });

  it('populates displayQuantity for an untracked entry with no amount', async () => {
    const untracked: FoodEntry = {
      id: 'sumach',
      name: 'Sumach',
      synonyms: [],
      unit: 'g',
      macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      untracked: true,
    };

    const result = await confirmResolution(
      { catalog: new FakeCatalogStore() },
      { kind: 'new-food', entry: untracked, original: { amount: null, rawDisplayUnitLabel: 'Prise' } },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ingredient.untracked).toBe(true);
    expect(result.ingredient.amount).toBe(0);
    expect(result.ingredient.displayQuantity).toEqual({ unitLabel: 'Prise' });
  });

  it('rejects an invalid entry with 422 and persists nothing', async () => {
    const catalog = new FakeCatalogStore();

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'new-food',
        entry: { ...kirsch, untracked: true },
        original: { amount: 50, unit: 'g' },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(catalog.list()).toEqual([]);
  });

  it('rejects an id already in the catalog with 409 and leaves the existing entry intact', async () => {
    const catalog = new FakeCatalogStore([kirsch]);

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'new-food',
        entry: { ...kirsch, macrosPer100: { calories: 999, protein: 0, carbs: 0, fat: 0 } },
        original: { amount: 50 },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(catalog.list()).toEqual([kirsch]);
  });

  it('persists a renamed entry under an id derived from its canonical name', async () => {
    const catalog = new FakeCatalogStore();

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'new-food',
        entry: {
          id: 'duenne-reisnudeln',
          name: 'Reisnudeln',
          synonyms: ['dünne Reisnudeln'],
          unit: 'g',
          macrosPer100: { calories: 360, protein: 6, carbs: 82, fat: 0.5 },
        },
        original: { amount: 200, unit: 'g' },
      },
    );

    expect(result.ok).toBe(true);
    expect(catalog.findById('duenne-reisnudeln')).toBeNull();
    expect(catalog.findById('reisnudeln')).toMatchObject({
      id: 'reisnudeln',
      name: 'Reisnudeln',
      synonyms: ['dünne Reisnudeln'],
    });
  });

  it('keeps the proposed id when the name was not edited', async () => {
    const catalog = new FakeCatalogStore();

    await confirmResolution({ catalog }, { kind: 'new-food', entry: kirsch, original: { amount: 50 } });

    expect(catalog.findById('kirschtomaten')).toEqual(kirsch);
  });

  it('drops a submitted synonym that folds to the canonical name', async () => {
    const catalog = new FakeCatalogStore();

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'new-food',
        entry: { ...kirsch, synonyms: ['KIRSCHTOMATEN', 'Cocktailtomaten'] },
        original: { amount: 50 },
      },
    );

    expect(result.ok).toBe(true);
    expect(catalog.findById('kirschtomaten')?.synonyms).toEqual(['Cocktailtomaten']);
  });

  it('deduplicates submitted synonyms case- and diacritic-insensitively, keeping the first spelling', async () => {
    const catalog = new FakeCatalogStore();

    await confirmResolution(
      { catalog },
      {
        kind: 'new-food',
        entry: { ...kirsch, synonyms: ['Cocktailtomaten', 'cocktailtomaten', 'Kirschtomätchen', 'Kirschtomatchen'] },
        original: { amount: 50 },
      },
    );

    expect(catalog.findById('kirschtomaten')?.synonyms).toEqual(['Cocktailtomaten', 'Kirschtomätchen']);
  });

  it('rejects a name that yields no id with 422 and persists nothing', async () => {
    const catalog = new FakeCatalogStore();

    const result = await confirmResolution(
      { catalog },
      { kind: 'new-food', entry: { ...kirsch, name: '???' }, original: { amount: 50 } },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(catalog.list()).toEqual([]);
  });

  it('rejects a derived id that collides with an existing entry with 409', async () => {
    const catalog = new FakeCatalogStore([{ ...kirsch, id: 'reisnudeln', name: 'Reisnudeln' }]);

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'new-food',
        entry: { ...kirsch, id: 'duenne-reisnudeln', name: 'Reisnudeln' },
        original: { amount: 200 },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(catalog.list()).toHaveLength(1);
  });

  it('rejects a folded-name collision with 409', async () => {
    const catalog = new FakeCatalogStore([{ ...kirsch, id: 'andere', name: 'kirschtomaten' }]);

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'new-food',
        entry: kirsch,
        original: { amount: 50 },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(catalog.list()).toHaveLength(1);
  });
});

describe('confirmResolution — synonym', () => {
  it('adds the synonym to the target entry and returns that entry as a CATALOG row', async () => {
    const catalog = new FakeCatalogStore([oliven]);

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'synonym',
        foodId: 'oliven',
        synonym: 'grüne Oliven',
        original: { amount: 25, unit: 'g', note: 'große' },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(catalog.findById('oliven')?.synonyms).toEqual(['grüne Oliven']);
    expect(result.ingredient).toMatchObject({
      name: 'Oliven',
      unit: 'g',
      amount: 25,
      note: 'große',
      source: 'CATALOG',
    });
  });

  it('makes the synonym searchable immediately', async () => {
    const catalog = new FakeCatalogStore([oliven]);
    await confirmResolution(
      { catalog },
      {
        kind: 'synonym',
        foodId: 'oliven',
        synonym: 'grüne Oliven',
        original: {},
      },
    );

    expect(catalog.indexed()[0]!.synonymsFolded).toContain('grune oliven');
  });

  it('returns 404 for an unknown foodId and persists nothing', async () => {
    const catalog = new FakeCatalogStore([oliven]);

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'synonym',
        foodId: 'nicht-vorhanden',
        synonym: 'egal',
        original: { amount: 1 },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(catalog.list()).toEqual([oliven]);
  });

  it('is idempotent for a synonym the entry already carries', async () => {
    const catalog = new FakeCatalogStore([{ ...oliven, synonyms: ['grüne Oliven'] }]);

    const result = await confirmResolution(
      { catalog },
      {
        kind: 'synonym',
        foodId: 'oliven',
        synonym: 'GRÜNE OLIVEN',
        original: {},
      },
    );

    expect(result.ok).toBe(true);
    expect(catalog.findById('oliven')?.synonyms).toEqual(['grüne Oliven']);
  });
});
