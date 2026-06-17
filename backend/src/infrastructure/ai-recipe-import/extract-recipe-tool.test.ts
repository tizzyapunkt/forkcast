import { describe, it, expect } from 'vitest';
import { EXTRACT_RECIPE_TOOL, parseToolInput } from './extract-recipe-tool.ts';

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

  it('resolves piece fields to grams when the model omits the unit', () => {
    // "½ mittelgroße Zucchini": the model gave a piece estimate but no canonical unit.
    const draft = parseToolInput({
      name: 'Pfanne',
      ingredients: [{ name: 'Zucchini', pieceAmount: 0.5, pieceUnitLabel: 'mittelgroße Zucchini', gramsPerPiece: 200 }],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.unit).toBe('g');
    expect(ing.amount).toBe(100);
    expect(ing.pieceQuantity).toEqual({ amount: 0.5, unitLabel: 'mittelgroße Zucchini', gramsPerPiece: 200 });
  });

  it('resolves piece fields to grams when the model labels the unit "piece"', () => {
    // 'piece' is not a canonical extraction unit; validation drops it, then the piece
    // estimate becomes the source of truth (the bogus count-as-amount is discarded).
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [
        { name: 'Zwiebel', amount: 1, unit: 'piece', pieceAmount: 1, pieceUnitLabel: 'Zwiebel', gramsPerPiece: 150 },
      ],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.unit).toBe('g');
    expect(ing.amount).toBe(150);
    expect(ing.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });
});

describe('EXTRACT_RECIPE_TOOL schema', () => {
  it('does not offer "piece" as a canonical unit (counts go through the piece fields)', () => {
    const unitEnum = EXTRACT_RECIPE_TOOL.input_schema.properties.ingredients.items.properties.unit.enum;
    expect(unitEnum).not.toContain('piece');
    expect(unitEnum).toEqual(['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp']);
  });
});

describe('parseToolInput — note field', () => {
  it('preserves a non-empty note on the raw ingredient', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Ingwer', amount: 5, unit: 'g', note: 'fein gehackt' }],
      steps: [],
    });
    expect(draft.ingredients[0]!.note).toBe('fein gehackt');
  });

  it('trims surrounding whitespace on the note', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Knoblauch', amount: 6, unit: 'g', note: '  in Scheiben  ' }],
      steps: [],
    });
    expect(draft.ingredients[0]!.note).toBe('in Scheiben');
  });

  it('drops an empty-string note', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Salz', amount: 5, unit: 'g', note: '' }],
      steps: [],
    });
    expect(draft.ingredients[0]!.note).toBeUndefined();
  });

  it('drops a whitespace-only note', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Salz', amount: 5, unit: 'g', note: '   ' }],
      steps: [],
    });
    expect(draft.ingredients[0]!.note).toBeUndefined();
  });

  it('drops a note whose trimmed length exceeds 80 chars, leaves the rest of the ingredient intact', () => {
    const overlong = 'a'.repeat(81);
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Mehl', amount: 200, unit: 'g', note: overlong }],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing.note).toBeUndefined();
    expect(ing.name).toBe('Mehl');
    expect(ing.amount).toBe(200);
    expect(ing.unit).toBe('g');
  });

  it('accepts a note exactly 80 chars long', () => {
    const exact = 'a'.repeat(80);
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Mehl', amount: 200, unit: 'g', note: exact }],
      steps: [],
    });
    expect(draft.ingredients[0]!.note).toBe(exact);
  });

  it('omits note from the raw ingredient when the input does not carry it', () => {
    const draft = parseToolInput({
      name: 'Cake',
      ingredients: [{ name: 'flour', amount: 200, unit: 'g' }],
      steps: [],
    });
    expect(draft.ingredients[0]!).not.toHaveProperty('note');
  });

  it('ignores a non-string note', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Salz', amount: 5, unit: 'g', note: 42 }],
      steps: [],
    });
    expect(draft.ingredients[0]!.note).toBeUndefined();
  });
});
