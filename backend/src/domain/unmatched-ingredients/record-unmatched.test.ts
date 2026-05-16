import { describe, it, expect } from 'vitest';
import { recordUnmatched } from './record-unmatched.ts';
import type { UnmatchedIngredientStore } from './types.ts';
import type { RawIngredient } from '../ai-recipe-import/types.ts';

const emptyStore = (): UnmatchedIngredientStore => ({ entries: [] });

describe('recordUnmatched', () => {
  it('creates a new entry on first occurrence with count=1, equal firstSeenAt/lastSeenAt, and one sample', () => {
    const now = new Date('2026-05-16T10:00:00.000Z');
    const raw: RawIngredient = { name: 'Buchweizenmehl', unit: 'g' };

    const next = recordUnmatched(emptyStore(), raw, now);

    expect(next.entries).toHaveLength(1);
    const entry = next.entries[0]!;
    expect(entry.name).toBe('Buchweizenmehl');
    expect(entry.foldedName).toBe('buchweizenmehl');
    expect(entry.count).toBe(1);
    expect(entry.firstSeenAt).toBe('2026-05-16T10:00:00.000Z');
    expect(entry.lastSeenAt).toBe('2026-05-16T10:00:00.000Z');
    expect(entry.samples).toEqual([{ rawName: 'Buchweizenmehl', rawUnit: 'g' }]);
  });

  it('increments count and appends sample when folded name already exists', () => {
    const first = new Date('2026-05-16T10:00:00.000Z');
    const second = new Date('2026-05-16T11:30:00.000Z');
    const third = new Date('2026-05-16T12:00:00.000Z');

    let store = recordUnmatched(emptyStore(), { name: 'Buchweizenmehl', unit: 'g' }, first);
    store = recordUnmatched(store, { name: 'Buchweizenmehl', unit: 'g' }, second);
    store = recordUnmatched(store, { name: 'buchweizenmehl', rawDisplayUnitLabel: 'EL' }, third);

    expect(store.entries).toHaveLength(1);
    const entry = store.entries[0]!;
    expect(entry.count).toBe(3);
    expect(entry.firstSeenAt).toBe('2026-05-16T10:00:00.000Z');
    expect(entry.lastSeenAt).toBe('2026-05-16T12:00:00.000Z');
    expect(entry.samples).toEqual([
      { rawName: 'Buchweizenmehl', rawUnit: 'g' },
      { rawName: 'Buchweizenmehl', rawUnit: 'g' },
      { rawName: 'buchweizenmehl', rawDisplayUnitLabel: 'EL' },
    ]);
  });

  it('caps samples at 5 by dropping the oldest', () => {
    let store: UnmatchedIngredientStore = emptyStore();
    for (let i = 0; i < 6; i++) {
      store = recordUnmatched(
        store,
        { name: 'Buchweizenmehl', unit: 'g', rawDisplayUnitLabel: `sample-${i}` },
        new Date(`2026-05-16T1${i}:00:00.000Z`),
      );
    }

    const entry = store.entries[0]!;
    expect(entry.samples).toHaveLength(5);
    expect(entry.samples[0]?.rawDisplayUnitLabel).toBe('sample-1');
    expect(entry.samples[4]?.rawDisplayUnitLabel).toBe('sample-5');
    expect(entry.count).toBe(6);
  });

  it('folds case and diacritics so variants converge into one entry', () => {
    const t1 = new Date('2026-05-16T10:00:00.000Z');
    const t2 = new Date('2026-05-16T11:00:00.000Z');
    const t3 = new Date('2026-05-16T12:00:00.000Z');

    let store = recordUnmatched(emptyStore(), { name: 'Möhre' }, t1);
    store = recordUnmatched(store, { name: 'möhre' }, t2);
    store = recordUnmatched(store, { name: 'MOHRE' }, t3);

    expect(store.entries).toHaveLength(1);
    const entry = store.entries[0]!;
    expect(entry.foldedName).toBe('mohre');
    expect(entry.count).toBe(3);
  });
});
