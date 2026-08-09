import { describe, it, expect } from 'vitest';
import { mergeOverlayIntoCatalog } from './merge-overlay.ts';
import type { FoodEntry } from '../foods/types.ts';

const cherrytomate: FoodEntry = {
  id: 'cherrytomate',
  name: 'Cherrytomate',
  synonyms: ['cherry tomato'],
  unit: 'g',
  macrosPer100: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
};

const balsamicoessig: FoodEntry = {
  id: 'balsamicoessig',
  name: 'Balsamicoessig',
  synonyms: ['Balsamico-Essig'],
  unit: 'ml',
  macrosPer100: { calories: 88, protein: 0, carbs: 17, fat: 0 },
};

describe('mergeOverlayIntoCatalog', () => {
  it('appends overlay foods and folds learned synonyms into their target entry', () => {
    const result = mergeOverlayIntoCatalog([cherrytomate], {
      foods: [balsamicoessig],
      synonyms: [{ foodId: 'cherrytomate', synonym: 'Kirschtomaten' }],
    });

    expect(result.entries.map((e) => e.id)).toEqual(['cherrytomate', 'balsamicoessig']);
    expect(result.entries[0]!.synonyms).toEqual(['cherry tomato', 'Kirschtomaten']);
    expect(result.warnings).toEqual([]);
  });

  it('skips an overlay food whose id already exists, naming it in a warning', () => {
    const result = mergeOverlayIntoCatalog([cherrytomate], {
      foods: [{ ...cherrytomate, name: 'Kirschtomate', macrosPer100: { calories: 99, protein: 0, carbs: 0, fat: 0 } }],
      synonyms: [],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.macrosPer100.calories).toBe(18);
    expect(result.warnings).toEqual([expect.stringContaining('cherrytomate')]);
  });

  it('skips an invalid overlay food with a warning', () => {
    const result = mergeOverlayIntoCatalog([], {
      foods: [{ ...balsamicoessig, macrosPer100: { calories: -1, protein: 0, carbs: 0, fat: 0 } }],
      synonyms: [],
    });

    expect(result.entries).toEqual([]);
    expect(result.warnings).toEqual([expect.stringContaining('balsamicoessig')]);
  });

  it('skips an orphaned synonym with a warning naming the foodId', () => {
    const result = mergeOverlayIntoCatalog([cherrytomate], {
      foods: [],
      synonyms: [{ foodId: 'nicht-vorhanden', synonym: 'egal' }],
    });

    expect(result.entries[0]!.synonyms).toEqual(['cherry tomato']);
    expect(result.warnings).toEqual([expect.stringContaining('nicht-vorhanden')]);
  });

  it('applies a synonym to a food the same overlay just added', () => {
    const result = mergeOverlayIntoCatalog([], {
      foods: [balsamicoessig],
      synonyms: [{ foodId: 'balsamicoessig', synonym: 'Aceto Balsamico' }],
    });

    expect(result.entries[0]!.synonyms).toEqual(['Balsamico-Essig', 'Aceto Balsamico']);
  });

  it('deduplicates synonyms case- and diacritic-insensitively, including against the canonical name', () => {
    const result = mergeOverlayIntoCatalog([cherrytomate], {
      foods: [],
      synonyms: [
        { foodId: 'cherrytomate', synonym: 'CHERRY TOMATO' },
        { foodId: 'cherrytomate', synonym: 'cherrytomate' },
        { foodId: 'cherrytomate', synonym: 'Kirschtomaten' },
        { foodId: 'cherrytomate', synonym: 'kirschtomaten' },
      ],
    });

    expect(result.entries[0]!.synonyms).toEqual(['cherry tomato', 'Kirschtomaten']);
  });

  it('is idempotent — merging already-merged content changes nothing', () => {
    const overlay = {
      foods: [balsamicoessig],
      synonyms: [{ foodId: 'cherrytomate', synonym: 'Kirschtomaten' }],
    };
    const once = mergeOverlayIntoCatalog([cherrytomate], overlay);
    const twice = mergeOverlayIntoCatalog(once.entries, overlay);

    expect(twice.entries).toEqual(once.entries);
    expect(twice.warnings).toEqual([expect.stringContaining('balsamicoessig')]);
  });

  it('leaves the catalog untouched for an empty overlay', () => {
    const result = mergeOverlayIntoCatalog([cherrytomate], { foods: [], synonyms: [] });
    expect(result.entries).toEqual([cherrytomate]);
    expect(result.warnings).toEqual([]);
  });
});
