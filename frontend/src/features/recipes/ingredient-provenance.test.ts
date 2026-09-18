import { describe, it, expect } from 'vitest';
import { formatRawIngredient } from './ingredient-provenance';

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
