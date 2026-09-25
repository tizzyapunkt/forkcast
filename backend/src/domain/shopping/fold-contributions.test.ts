import { describe, it, expect } from 'vitest';
import { foldContributions } from './fold-contributions.ts';
import type { Contribution } from './types.ts';

function c(name: string, amount: number, date: string, over: Partial<Contribution> = {}): Contribution {
  return { name, unit: 'g', amount, date, untracked: false, ...over };
}

const noPieces = () => null;

describe('foldContributions', () => {
  it('sums one food across days into one item with its dates', () => {
    const items = foldContributions(
      [c('Haferflocken', 60, '2026-09-29'), c('Haferflocken', 60, '2026-09-28'), c('Haferflocken', 60, '2026-09-29')],
      noPieces,
    );

    expect(items).toEqual([
      { name: 'Haferflocken', unit: 'g', amount: 180, untracked: false, dates: ['2026-09-28', '2026-09-29'] },
    ]);
  });

  it('merges names case-insensitively, keeping the most recent spelling', () => {
    const items = foldContributions([c('Zwiebel', 80, '2026-09-28'), c('zwiebel', 120, '2026-10-01')], noPieces);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'zwiebel', amount: 200 });
  });

  it('keeps the same food in different units apart', () => {
    const items = foldContributions(
      [c('Milch', 200, '2026-09-28', { unit: 'ml' }), c('Milch', 100, '2026-09-28')],
      noPieces,
    );

    expect(items.map((i) => `${i.name} ${i.amount} ${i.unit}`)).toEqual(['Milch 100 g', 'Milch 200 ml']);
  });

  it('rounds totals up to whole numbers without inflating exact values', () => {
    const items = foldContributions(
      [
        c('Reis', 133.4, '2026-09-28'),
        c('Hack', 250 * (3 / 3), '2026-09-28'),
        c('Linsen', (0.1 + 0.2) * 1000, '2026-09-28'),
      ],
      noPieces,
    );

    expect(Object.fromEntries(items.map((i) => [i.name, i.amount]))).toEqual({ Hack: 250, Linsen: 300, Reis: 134 });
  });

  it('marks an item untracked only when every contribution is untracked', () => {
    const items = foldContributions(
      [
        c('Salz', 5, '2026-09-28', { untracked: true }),
        c('Olivenöl', 10, '2026-09-28', { untracked: true, unit: 'ml' }),
        c('Olivenöl', 15, '2026-09-29', { unit: 'ml' }),
      ],
      noPieces,
    );

    expect(Object.fromEntries(items.map((i) => [i.name, i.untracked]))).toEqual({ Olivenöl: false, Salz: true });
  });

  it('orders tracked items first, then untracked, each alphabetically', () => {
    const items = foldContributions(
      [
        c('Zucchini', 1, '2026-09-28'),
        c('Pfeffer', 1, '2026-09-28', { untracked: true }),
        c('Äpfel', 1, '2026-09-28'),
        c('Hähnchenbrust', 1, '2026-09-28'),
        c('Kreuzkümmel', 1, '2026-09-28', { untracked: true }),
      ],
      noPieces,
    );

    expect(items.map((i) => i.name)).toEqual(['Äpfel', 'Hähnchenbrust', 'Zucchini', 'Kreuzkümmel', 'Pfeffer']);
  });

  it('adds a piece hint from the lookup, rounding the count up', () => {
    const items = foldContributions([c('Zwiebel', 380, '2026-09-28')], (name, unit) =>
      name === 'Zwiebel' && unit === 'g' ? { label: 'mittel', grams: 180 } : null,
    );

    expect(items[0]!.pieceHint).toEqual({ count: 3, label: 'mittel' });
  });

  it('returns no items for no contributions', () => {
    expect(foldContributions([], noPieces)).toEqual([]);
  });
});
