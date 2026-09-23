import { describe, it, expect } from 'vitest';
import { EXTRACT_RECIPE_INSTRUCTIONS, EXTRACT_RECIPE_TOOL, parseToolInput } from './extract-recipe-tool.ts';

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

  it('turns spoon-labelled piece fields into a spoon measure instead of a piece', () => {
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
    expect(ing.pieceQuantity).toBeUndefined();
    expect(ing.amount).toBeUndefined();
    expect(ing.unit).toBeUndefined();
    expect(ing.rawDisplayAmount).toBe(2);
    expect(ing.rawDisplayUnitLabel).toBe('tbsp');
    expect(ing.gramsPerSpoon).toBe(14);
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
  it('offers only grams and millilitres as canonical units (counts and spoons have their own fields)', () => {
    const unitEnum = EXTRACT_RECIPE_TOOL.input_schema.properties.ingredients.items.properties.unit.enum;
    expect(unitEnum).not.toContain('piece');
    expect(unitEnum).toEqual(['g', 'ml']);
  });

  it('offers an optional per-spoon gram estimate', () => {
    const items = EXTRACT_RECIPE_TOOL.input_schema.properties.ingredients.items;
    expect(items.properties.gramsPerSpoon.type).toBe('number');
    expect(items.required).not.toContain('gramsPerSpoon');
  });

  it('no longer asks the model to convert spoon measures itself', () => {
    expect(EXTRACT_RECIPE_INSTRUCTIONS).not.toMatch(/canonical conversion/i);
    expect(EXTRACT_RECIPE_INSTRUCTIONS).toMatch(/gramsPerSpoon/);
  });

  it('still asks for the verbatim line first and keeps the transcription rule', () => {
    const items = EXTRACT_RECIPE_TOOL.input_schema.properties.ingredients.items;
    expect(Object.keys(items.properties)[0]).toBe('sourceText');
    expect(EXTRACT_RECIPE_INSTRUCTIONS).toMatch(/Transcription rule/);
  });

  it('asks for the verbatim ingredient line first, as an optional string', () => {
    const items = EXTRACT_RECIPE_TOOL.input_schema.properties.ingredients.items;
    expect(Object.keys(items.properties)[0]).toBe('sourceText');
    expect(items.properties.sourceText.type).toBe('string');
    expect(items.required).not.toContain('sourceText');
  });

  it('instructs the model to transcribe each ingredient line verbatim', () => {
    expect(EXTRACT_RECIPE_INSTRUCTIONS).toMatch(/sourceText/);
    expect(EXTRACT_RECIPE_INSTRUCTIONS).toMatch(/verbatim/i);
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

describe('parseToolInput — verbatim source text', () => {
  it('keeps the ingredient line as printed on the raw ingredient', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Olivenöl', sourceText: '2 EL Olivenöl', amount: 30, unit: 'ml' }],
      steps: [],
    });
    expect(draft.ingredients[0]!.sourceText).toBe('2 EL Olivenöl');
  });

  it('trims surrounding whitespace', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Kreuzkümmel', sourceText: '  ½ TL Kreuzkümmel \n' }],
      steps: [],
    });
    expect(draft.ingredients[0]!.sourceText).toBe('½ TL Kreuzkümmel');
  });

  it('drops an empty or whitespace-only source text', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [
        { name: 'Salz', sourceText: '' },
        { name: 'Pfeffer', sourceText: '   ' },
      ],
      steps: [],
    });
    expect(draft.ingredients[0]!).not.toHaveProperty('sourceText');
    expect(draft.ingredients[1]!).not.toHaveProperty('sourceText');
  });

  it('drops an overlong source text and keeps the rest of the ingredient', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [
        {
          name: 'Zwiebel',
          sourceText: 'a'.repeat(201),
          amount: 150,
          unit: 'g',
          pieceAmount: 1,
          pieceUnitLabel: 'Zwiebel',
          gramsPerPiece: 150,
          note: 'gewürfelt',
        },
      ],
      steps: [],
    });
    const ing = draft.ingredients[0]!;
    expect(ing).not.toHaveProperty('sourceText');
    expect(ing).toEqual({
      name: 'Zwiebel',
      amount: 150,
      unit: 'g',
      pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
      note: 'gewürfelt',
    });
  });

  it('accepts a source text exactly 200 chars long', () => {
    const exact = 'a'.repeat(200);
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [{ name: 'Mehl', sourceText: exact }],
      steps: [],
    });
    expect(draft.ingredients[0]!.sourceText).toBe(exact);
  });

  it('omits source text when the model did not return it', () => {
    const draft = parseToolInput({
      name: 'Cake',
      ingredients: [{ name: 'flour', amount: 200, unit: 'g' }],
      steps: [],
    });
    expect(draft.ingredients[0]!).not.toHaveProperty('sourceText');
  });

  it('does not change how a counted food resolves its amount', () => {
    const draft = parseToolInput({
      name: 'Soup',
      ingredients: [
        {
          name: 'Zwiebel',
          sourceText: '1 mittelgroße Zwiebel, gewürfelt',
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
    expect(ing.sourceText).toBe('1 mittelgroße Zwiebel, gewürfelt');
    expect(ing.amount).toBe(150);
    expect(ing.unit).toBe('g');
    expect(ing.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
  });
});

describe('parseToolInput — spoon normalization', () => {
  const parseOne = (ingredient: Record<string, unknown>) =>
    parseToolInput({ name: 'R', ingredients: [ingredient], steps: [] }).ingredients[0]!;

  it('moves a spoon unit off the canonical fields onto the German spoon label', () => {
    for (const [unit, label] of [
      ['tbsp', 'EL'],
      ['tsp', 'TL'],
      ['cup', 'Tasse'],
    ] as const) {
      const ing = parseOne({ name: 'Olivenöl', amount: 2, unit });
      expect(ing.amount).toBeUndefined();
      expect(ing.unit).toBeUndefined();
      expect(ing.rawDisplayAmount).toBe(2);
      expect(ing.rawDisplayUnitLabel).toBe(label);
    }
  });

  it('keeps the label alone when a spoon unit comes without a count', () => {
    const ing = parseOne({ name: 'Olivenöl', unit: 'tbsp' });
    expect(ing.rawDisplayAmount).toBeUndefined();
    expect(ing.rawDisplayUnitLabel).toBe('EL');
  });

  it('keeps the literal raw-display reading over a spoon unit', () => {
    const ing = parseOne({
      name: 'Olivenöl',
      amount: 2,
      unit: 'tbsp',
      rawDisplayAmount: 2,
      rawDisplayUnitLabel: 'Esslöffel',
    });
    expect(ing.amount).toBeUndefined();
    expect(ing.unit).toBeUndefined();
    expect(ing.rawDisplayAmount).toBe(2);
    expect(ing.rawDisplayUnitLabel).toBe('Esslöffel');
  });

  it('turns a spoon reported as a piece into a spoon measure with the piece weight as estimate', () => {
    const ing = parseOne({
      name: 'Erdnussmus',
      amount: 28,
      unit: 'g',
      pieceAmount: 2,
      pieceUnitLabel: 'EL',
      gramsPerPiece: 14,
    });
    expect(ing.pieceQuantity).toBeUndefined();
    expect(ing.amount).toBeUndefined();
    expect(ing.unit).toBeUndefined();
    expect(ing.rawDisplayAmount).toBe(2);
    expect(ing.rawDisplayUnitLabel).toBe('EL');
    expect(ing.gramsPerSpoon).toBe(14);
  });

  it('prefers literal raw-display fields and an explicit estimate over spoon-labelled piece fields', () => {
    const ing = parseOne({
      name: 'Erdnussmus',
      pieceAmount: 2,
      pieceUnitLabel: 'EL',
      gramsPerPiece: 14,
      rawDisplayAmount: 2,
      rawDisplayUnitLabel: 'Esslöffel',
      gramsPerSpoon: 16,
    });
    expect(ing.pieceQuantity).toBeUndefined();
    expect(ing.rawDisplayUnitLabel).toBe('Esslöffel');
    expect(ing.gramsPerSpoon).toBe(16);
  });

  it('drops a model-made millilitre amount next to a spoon measure', () => {
    const ing = parseOne({
      name: 'Zimt',
      amount: 2.5,
      unit: 'ml',
      rawDisplayAmount: 0.5,
      rawDisplayUnitLabel: 'TL',
      gramsPerSpoon: 2.5,
    });
    expect(ing.amount).toBeUndefined();
    expect(ing.unit).toBeUndefined();
    expect(ing.rawDisplayAmount).toBe(0.5);
    expect(ing.rawDisplayUnitLabel).toBe('TL');
    expect(ing.gramsPerSpoon).toBe(2.5);
  });

  it('keeps a printed gram amount next to a spoon measure', () => {
    const ing = parseOne({
      name: 'Speisestärke',
      amount: 12,
      unit: 'g',
      rawDisplayAmount: 2,
      rawDisplayUnitLabel: 'EL',
    });
    expect(ing.amount).toBe(12);
    expect(ing.unit).toBe('g');
    expect(ing.rawDisplayUnitLabel).toBe('EL');
  });

  it('keeps a millilitre amount next to a non-spoon label', () => {
    const ing = parseOne({
      name: 'Zitronensaft',
      amount: 10,
      unit: 'ml',
      rawDisplayAmount: 1,
      rawDisplayUnitLabel: 'Schuss',
    });
    expect(ing.amount).toBe(10);
    expect(ing.unit).toBe('ml');
  });

  it('converts ounces to grams', () => {
    const ing = parseOne({ name: 'Butter', amount: 2, unit: 'oz' });
    expect(ing.amount).toBe(56.7);
    expect(ing.unit).toBe('g');
  });

  it('keeps a positive per-spoon estimate next to a spoon label only', () => {
    expect(
      parseOne({ name: 'Haferflocken', rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL', gramsPerSpoon: 8 })
        .gramsPerSpoon,
    ).toBe(8);
    expect(
      parseOne({ name: 'Pfeffer', rawDisplayAmount: 1, rawDisplayUnitLabel: 'Prise', gramsPerSpoon: 0.3 })
        .gramsPerSpoon,
    ).toBeUndefined();
    expect(parseOne({ name: 'Haferflocken', amount: 40, unit: 'g', gramsPerSpoon: 8 }).gramsPerSpoon).toBeUndefined();
    expect(
      parseOne({ name: 'Haferflocken', rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL', gramsPerSpoon: 0 })
        .gramsPerSpoon,
    ).toBeUndefined();
    expect(
      parseOne({ name: 'Haferflocken', rawDisplayAmount: 2, rawDisplayUnitLabel: 'EL', gramsPerSpoon: '8' })
        .gramsPerSpoon,
    ).toBeUndefined();
  });

  it('leaves the verbatim source text untouched in every normalization case', () => {
    const cases: Record<string, unknown>[] = [
      { name: 'Olivenöl', amount: 2, unit: 'tbsp', sourceText: '2 EL Olivenöl' },
      {
        name: 'Erdnussmus',
        amount: 28,
        unit: 'g',
        pieceAmount: 2,
        pieceUnitLabel: 'EL',
        gramsPerPiece: 14,
        sourceText: '2 EL Erdnussmus',
      },
      {
        name: 'Zimt',
        amount: 2.5,
        unit: 'ml',
        rawDisplayAmount: 0.5,
        rawDisplayUnitLabel: 'TL',
        sourceText: '½ TL Zimt',
      },
      { name: 'Butter', amount: 2, unit: 'oz', sourceText: '2 oz butter, softened' },
    ];
    for (const input of cases) {
      expect(parseOne(input).sourceText).toBe(input.sourceText);
    }
  });
});
