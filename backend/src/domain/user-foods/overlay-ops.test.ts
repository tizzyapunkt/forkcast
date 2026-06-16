import { describe, it, expect } from 'vitest';
import { emptyOverlay, addFoodToOverlay, addSynonymToOverlay } from './overlay-ops.ts';
import type { FoodEntry } from '../foods/types.ts';

const food = (over: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'kirschtomaten',
  name: 'Kirschtomaten',
  synonyms: ['Cocktailtomaten'],
  unit: 'g',
  macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
  ...over,
});

describe('emptyOverlay', () => {
  it('returns a fresh empty overlay each call (no shared mutable state)', () => {
    const a = emptyOverlay();
    const b = emptyOverlay();
    expect(a).toEqual({ foods: [], synonyms: [] });
    expect(a).not.toBe(b);
    expect(a.foods).not.toBe(b.foods);
  });
});

describe('addFoodToOverlay', () => {
  it('appends a valid entry', () => {
    const r = addFoodToOverlay(emptyOverlay(), food());
    expect(r.ok).toBe(true);
    expect(r.ok && r.overlay.foods).toEqual([food()]);
  });

  it('rejects an entry that fails curated validation (untracked with non-zero macros)', () => {
    const r = addFoodToOverlay(emptyOverlay(), food({ untracked: true }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/untracked/);
  });

  it('rejects an overlay-internal id collision', () => {
    const start = addFoodToOverlay(emptyOverlay(), food());
    if (!start.ok) throw new Error('setup');
    const r = addFoodToOverlay(start.overlay, food({ name: 'Andere Tomate', synonyms: [] }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/already/i);
  });

  it('rejects an overlay-internal folded-name collision', () => {
    const start = addFoodToOverlay(emptyOverlay(), food());
    if (!start.ok) throw new Error('setup');
    const r = addFoodToOverlay(start.overlay, food({ id: 'kirschtomate-2', name: 'kirschtomaten', synonyms: [] }));
    expect(r.ok).toBe(false);
  });

  it('does not mutate the input overlay', () => {
    const input = emptyOverlay();
    addFoodToOverlay(input, food());
    expect(input.foods).toHaveLength(0);
  });
});

describe('addSynonymToOverlay', () => {
  it('appends a new synonym', () => {
    const next = addSynonymToOverlay(emptyOverlay(), { foodId: 'oliven', synonym: 'grüne Oliven' });
    expect(next.synonyms).toEqual([{ foodId: 'oliven', synonym: 'grüne Oliven' }]);
  });

  it('is a no-op for a duplicate foodId+folded synonym', () => {
    const once = addSynonymToOverlay(emptyOverlay(), { foodId: 'oliven', synonym: 'grüne Oliven' });
    const twice = addSynonymToOverlay(once, { foodId: 'oliven', synonym: 'Grüne Oliven' });
    expect(twice.synonyms).toHaveLength(1);
  });

  it('allows the same synonym text under a different foodId', () => {
    const once = addSynonymToOverlay(emptyOverlay(), { foodId: 'oliven', synonym: 'grün' });
    const twice = addSynonymToOverlay(once, { foodId: 'paprika', synonym: 'grün' });
    expect(twice.synonyms).toHaveLength(2);
  });

  it('does not mutate the input overlay', () => {
    const input = emptyOverlay();
    addSynonymToOverlay(input, { foodId: 'oliven', synonym: 'grüne Oliven' });
    expect(input.synonyms).toHaveLength(0);
  });
});
