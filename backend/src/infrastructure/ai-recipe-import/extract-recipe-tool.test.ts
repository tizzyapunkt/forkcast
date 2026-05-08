import { describe, it, expect } from 'vitest';
import { parseToolInput } from './extract-recipe-tool.ts';

describe('parseToolInput — piece quantities', () => {
  it('passes complete piece info through verbatim when amount is consistent', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [
        {
          name: 'Zwiebel',
          amount: 150,
          unit: 'g',
          pieceAmount: 1,
          pieceUnitLabel: 'Zwiebel',
          gramsPerPiece: 150,
        },
      ],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.amount).toBe(150);
    expect(ing.unit).toBe('g');
    expect(ing.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });

  it('drops all piece fields when one of the three is missing', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Zwiebel', amount: 150, unit: 'g', pieceAmount: 1 }],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.amount).toBe(150);
    expect(ing.pieceQuantity).toBeUndefined();
  });

  it('drops piece fields when gramsPerPiece is present without pieceAmount', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Zwiebel', amount: 150, unit: 'g', gramsPerPiece: 150, pieceUnitLabel: 'Zwiebel' }],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.pieceQuantity).toBeUndefined();
  });

  it('recomputes amount when pieceAmount * gramsPerPiece diverges from amount beyond 5%', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [
        {
          name: 'Zwiebel',
          amount: 200,
          unit: 'g',
          pieceAmount: 1,
          pieceUnitLabel: 'Zwiebel',
          gramsPerPiece: 150,
        },
      ],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.amount).toBe(150);
    expect(ing.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });

  it('keeps the model amount when within 5% tolerance of the resolved mass', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [
        {
          name: 'Zwiebel',
          amount: 154,
          unit: 'g',
          pieceAmount: 1,
          pieceUnitLabel: 'Zwiebel',
          gramsPerPiece: 150,
        },
      ],
      steps: [],
    });
    expect(draft.ingredients[0]!.amount).toBe(154);
  });

  it('drops piece fields when unit is non-mass', () => {
    const draft = parseToolInput({
      name: 'Pasta',
      ingredients: [
        {
          name: 'olive oil',
          amount: 2,
          unit: 'tbsp',
          pieceAmount: 2,
          pieceUnitLabel: 'tbsp',
          gramsPerPiece: 14,
        },
      ],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.amount).toBe(2);
    expect(ing.unit).toBe('tbsp');
    expect(ing.pieceQuantity).toBeUndefined();
  });

  it('preserves piece quantity for liquid pieces (ml)', () => {
    const draft = parseToolInput({
      name: 'Drink',
      ingredients: [
        {
          name: 'Lemon juice',
          amount: 30,
          unit: 'ml',
          pieceAmount: 1,
          pieceUnitLabel: 'lemon',
          gramsPerPiece: 30,
        },
      ],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.unit).toBe('ml');
    expect(ing.pieceQuantity).toEqual({ amount: 1, unitLabel: 'lemon', gramsPerPiece: 30 });
  });

  it('leaves mass-only ingredients untouched (no piece fields, no pieceQuantity)', () => {
    const draft = parseToolInput({
      name: 'Cake',
      ingredients: [{ name: 'flour', amount: 200, unit: 'g' }],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.amount).toBe(200);
    expect(ing.unit).toBe('g');
    expect(ing.pieceQuantity).toBeUndefined();
  });
});
