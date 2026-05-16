import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonRecipeRepository } from './json-recipe.repository.ts';
import type { Recipe } from '../../domain/recipes/types.ts';

let dir: string;
let repo: JsonRecipeRepository;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'forkcast-recipe-repo-'));
  repo = new JsonRecipeRepository(join(dir, 'recipes.json'));
  await repo.init();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const baseIngredient = {
  name: 'Mehl',
  unit: 'g' as const,
  macrosPerUnit: { calories: 3.6, protein: 0.1, carbs: 0.76, fat: 0.01 },
  amount: 200,
};

const recipeWithNote: Recipe = {
  id: 'rec-1',
  name: 'Dough',
  yield: 1,
  ingredients: [
    { ...baseIngredient, note: 'gesiebt' },
    {
      name: 'Knoblauch',
      unit: 'g',
      macrosPerUnit: { calories: 1.49, protein: 0.064, carbs: 0.331, fat: 0.005 },
      amount: 6,
      note: 'fein gehackt',
    },
    baseIngredient, // no note on this row
  ],
  steps: ['mix'],
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
};

describe('JsonRecipeRepository', () => {
  it('round-trips ingredient `note` on save/findById', async () => {
    await repo.save(recipeWithNote);

    const loaded = await repo.findById('rec-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.ingredients[0]?.note).toBe('gesiebt');
    expect(loaded?.ingredients[1]?.note).toBe('fein gehackt');
    expect(loaded?.ingredients[2]).not.toHaveProperty('note');
  });

  it('loads a legacy recipe whose ingredients have no `note` field', async () => {
    const legacyJson = JSON.stringify(
      [
        {
          id: 'legacy-1',
          name: 'Old Recipe',
          yield: 1,
          ingredients: [
            {
              name: 'Mehl',
              unit: 'g',
              macrosPerUnit: { calories: 3.6, protein: 0.1, carbs: 0.76, fat: 0.01 },
              amount: 200,
            },
          ],
          steps: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      null,
      2,
    );
    await writeFile(join(dir, 'recipes.json'), legacyJson, 'utf-8');

    const loaded = await repo.findById('legacy-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.ingredients[0]).not.toHaveProperty('note');
  });

  it('does not emit `note` on rows that lack one', async () => {
    await repo.save({
      ...recipeWithNote,
      id: 'rec-2',
      ingredients: [baseIngredient],
    });
    const raw = await import('node:fs/promises').then((fs) => fs.readFile(join(dir, 'recipes.json'), 'utf-8'));
    expect(raw).not.toContain('"note"');
  });
});
