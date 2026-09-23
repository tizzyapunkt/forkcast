import { describe, it, expect } from 'vitest';
import { deriveUncertaintyMarker, formatRawIngredient } from './ingredient-provenance';
import type { IngredientMatchProvenance, RawIngredientProvenance } from '../../domain/recipes';

describe('formatRawIngredient', () => {
  it('shows the verbatim source line over any interpreted amount', () => {
    expect(
      formatRawIngredient({
        sourceText: '1 mittelgroße Zwiebel, gewürfelt',
        name: 'Zwiebel',
        amount: 150,
        unit: 'g',
        pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
        note: 'gewürfelt',
      }),
    ).toBe('1 mittelgroße Zwiebel, gewürfelt');
  });

  it('shows a spoon measure as written rather than its conversion', () => {
    const line = formatRawIngredient({ sourceText: '2 EL Olivenöl', name: 'Olivenöl', amount: 30, unit: 'ml' });
    expect(line).toBe('2 EL Olivenöl');
  });

  describe('without a source line', () => {
    it('shows the piece count instead of the estimated gram total, without repeating the name', () => {
      const line = formatRawIngredient({
        name: 'Zwiebel',
        amount: 150,
        unit: 'g',
        pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
      });
      expect(line).toBe('1 Zwiebel');
      expect(line).not.toMatch(/150/);
    });

    it('treats a piece label that differs only in case as the name', () => {
      const line = formatRawIngredient({
        name: 'zucchini',
        amount: 100,
        unit: 'g',
        pieceQuantity: { amount: 0.5, unitLabel: 'Zucchini', gramsPerPiece: 200 },
      });
      expect(line).toBe('0.5 Zucchini');
    });

    it('keeps the name after a piece label that is a unit of count', () => {
      const line = formatRawIngredient({
        name: 'Knoblauch',
        amount: 10,
        unit: 'g',
        pieceQuantity: { amount: 2, unitLabel: 'Zehe', gramsPerPiece: 5 },
      });
      expect(line).toBe('2 Zehe Knoblauch');
    });

    it('prefers the literal display quantity over a canonical conversion', () => {
      const line = formatRawIngredient({
        name: 'Olivenöl',
        amount: 30,
        unit: 'ml',
        rawDisplayAmount: 2,
        rawDisplayUnitLabel: 'EL',
      });
      expect(line).toBe('2 EL Olivenöl');
    });

    it('shows a qualitative display label without an amount', () => {
      expect(formatRawIngredient({ name: 'Salz', rawDisplayUnitLabel: 'n. Geschmack' })).toBe('n. Geschmack Salz');
    });

    it('uses the canonical amount for an ingredient stated by mass', () => {
      expect(formatRawIngredient({ name: 'Mehl', amount: 200, unit: 'g' })).toBe('200 g Mehl');
    });

    it('shows just the name when nothing was quantified', () => {
      expect(formatRawIngredient({ name: 'Kirschtomaten' })).toBe('Kirschtomaten');
    });
  });
});

describe('deriveUncertaintyMarker — spoon estimates', () => {
  const entry = (
    raw: RawIngredientProvenance,
    flags: Partial<IngredientMatchProvenance['flags']> = {},
  ): IngredientMatchProvenance => {
    const chosen = { name: raw.name, source: 'CATALOG' as const, unit: 'g' as const, untracked: false };
    return {
      raw,
      candidates: [chosen],
      chosen,
      flags: {
        unitOverridden: false,
        pieceQuantityDropped: false,
        untrackedInherited: false,
        missingAmount: false,
        ...flags,
      },
    };
  };

  it('names the spoon measure an estimated amount came from', () => {
    const e = entry(
      { name: 'Haferflocken', rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL', gramsPerSpoon: 8 },
      { spoonEstimated: true },
    );
    expect(deriveUncertaintyMarker(e, 'g')).toBe('Menge aus 2 EL geschätzt');
  });

  it('renders a fractional spoon count like other counts', () => {
    const e = entry(
      { name: 'Zimt', rawDisplayAmount: 0.5, rawDisplayUnitLabel: 'TL', gramsPerSpoon: 2.5 },
      { spoonEstimated: true },
    );
    expect(deriveUncertaintyMarker(e, 'g')).toBe('Menge aus 0.5 TL geschätzt');
  });

  it('shows no spoon marker when the flag is false or missing (older backend)', () => {
    const raw = { name: 'Olivenöl', rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL' };
    expect(deriveUncertaintyMarker(entry(raw, { spoonEstimated: false }), 'ml')).toBeNull();
    expect(deriveUncertaintyMarker(entry(raw), 'ml')).toBeNull();
  });
});

describe('formatRawIngredient — normalized spoon rows', () => {
  it('rebuilds a normalized spoon row in the recipe framing when no source line exists', () => {
    expect(
      formatRawIngredient({ name: 'Olivenöl', rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL', gramsPerSpoon: 13 }),
    ).toBe('2 EL Olivenöl');
  });

  it('still returns the verbatim line when one exists', () => {
    expect(
      formatRawIngredient({
        sourceText: '2 Esslöffel gutes Olivenöl',
        name: 'Olivenöl',
        rawDisplayAmount: 2,
        rawDisplayUnitLabel: 'EL',
        gramsPerSpoon: 13,
      }),
    ).toBe('2 Esslöffel gutes Olivenöl');
  });
});
