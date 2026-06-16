import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { RecipeIngredientEditor } from './recipe-ingredient-editor';
import type { RecipeIngredient } from '../../domain/recipes';

function Harness({ initial, estimateIndices }: { initial: RecipeIngredient[]; estimateIndices?: Set<number> }) {
  const [ingredients, setIngredients] = useState(initial);
  return (
    <RecipeIngredientEditor ingredients={ingredients} onChange={setIngredients} estimateIndices={estimateIndices} />
  );
}

function Capture({ initial }: { initial: RecipeIngredient[] }) {
  const [ingredients, setIngredients] = useState(initial);
  return (
    <>
      <RecipeIngredientEditor ingredients={ingredients} onChange={setIngredients} />
      <pre data-testid="captured-state">{JSON.stringify(ingredients)}</pre>
    </>
  );
}

function readState(): RecipeIngredient[] {
  const el = screen.getByTestId('captured-state');
  return JSON.parse(el.textContent ?? '[]') as RecipeIngredient[];
}

const massOnly: RecipeIngredient = {
  name: 'Mehl',
  unit: 'g',
  macrosPerUnit: { calories: 3.4, protein: 0.1, carbs: 0.7, fat: 0.01 },
  amount: 200,
};

const pieceTracked: RecipeIngredient = {
  name: 'Zwiebel',
  unit: 'g',
  macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
  amount: 150,
  pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
};

const freeSalt: RecipeIngredient = {
  name: 'Salz',
  unit: 'g',
  macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  amount: 5,
  untracked: true,
};

function segment(rowName: string, label: string): HTMLElement {
  const group = screen.getByRole('group', { name: new RegExp(`Maß-Steuerung für ${rowName}`, 'i') });
  return within(group).getByRole('radio', { name: label });
}

describe('RecipeIngredientEditor — measurement-mode control', () => {
  it('derives the active segment from each row’s data', () => {
    render(<Harness initial={[massOnly, freeSalt, pieceTracked]} />);
    expect(segment('Mehl', 'Gewicht')).toHaveAttribute('aria-checked', 'true');
    expect(segment('Salz', 'Frei')).toHaveAttribute('aria-checked', 'true');
    expect(segment('Zwiebel', 'Stück')).toHaveAttribute('aria-checked', 'true');
  });

  it('switching to Stück seeds piece tracking and recomputes the mass from the current amount', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[{ ...massOnly, name: 'Ei', amount: 60 }]} />);
    await user.click(segment('Ei', 'Stück'));
    const state = readState();
    expect(state[0]?.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Stück', gramsPerPiece: 60 });
    expect(state[0]?.amount).toBe(60);
    expect(screen.getByLabelText(/stückzahl für ei/i)).toBeInTheDocument();
  });

  it('switching to Stück on an amount-zero row uses the fallback grams-per-piece of 50', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[{ ...massOnly, name: 'Ei', amount: 0 }]} />);
    await user.click(segment('Ei', 'Stück'));
    const state = readState();
    expect(state[0]?.pieceQuantity?.gramsPerPiece).toBe(50);
    expect(state[0]?.amount).toBe(50);
  });

  it('switching to Frei marks the row untracked, clears the piece, and shows the caption', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[pieceTracked]} />);
    await user.click(segment('Zwiebel', 'Frei'));
    const state = readState();
    expect(state[0]?.untracked).toBe(true);
    expect(state[0]?.pieceQuantity).toBeUndefined();
    expect(screen.getByText(/zählt nicht in die nährwerte/i)).toBeInTheDocument();
  });

  it('switching back to Gewicht clears piece and untracked, keeping the current amount', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[pieceTracked]} />);
    await user.click(segment('Zwiebel', 'Gewicht'));
    const state = readState();
    expect(state[0]?.pieceQuantity).toBeUndefined();
    expect(state[0]?.untracked).toBeUndefined();
    expect(state[0]?.amount).toBe(150);
  });

  it('disables the Stück segment on a non-mass unit', () => {
    render(<Harness initial={[{ ...massOnly, name: 'Tomatenmark', unit: 'tbsp' }]} />);
    expect(segment('Tomatenmark', 'Stück')).toBeDisabled();
    expect(segment('Tomatenmark', 'Gewicht')).not.toBeDisabled();
  });

  it('renders only the active mode’s inputs', () => {
    render(<Harness initial={[massOnly]} />);
    expect(screen.getByLabelText(/menge für mehl/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/stückzahl/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/anzeige-einheit/i)).not.toBeInTheDocument();
  });
});

describe('RecipeIngredientEditor — per-row calories and macros', () => {
  const tracked200: RecipeIngredient = {
    name: 'Hähnchen',
    unit: 'g',
    macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
    amount: 200,
  };

  it('renders kcal + macros for a tracked row (200g × macrosPerUnit → 500/52/0/30)', () => {
    render(<Harness initial={[tracked200]} />);
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/500 kcal · 52 P · 0 KH · 30 F/);
  });

  it('hides the macro sub-line entirely for a Frei row', () => {
    render(<Harness initial={[{ ...tracked200, untracked: true }]} />);
    expect(screen.queryByTestId('row-macros-0')).not.toBeInTheDocument();
  });

  it('updates the macro sub-line live as the weight amount changes (100 → 250)', () => {
    const row: RecipeIngredient = {
      name: 'Lachs',
      unit: 'g',
      macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
      amount: 100,
    };
    render(<Harness initial={[row]} />);
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/165 kcal · 31 P · 0 KH · 4 F/);
    fireEvent.change(screen.getByLabelText(/menge für lachs/i), { target: { value: '250' } });
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/413 kcal · 78 P · 0 KH · 9 F/);
  });

  it('updates the macro sub-line live as the piece count changes', () => {
    render(<Harness initial={[pieceTracked]} />);
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/60 kcal · 2 P · 14 KH · 0 F/);
    fireEvent.change(screen.getByLabelText(/stückzahl für zwiebel/i), { target: { value: '2' } });
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/120 kcal · 3 P · 28 KH · 0 F/);
  });

  it('updates the macro sub-line live as grams-per-piece changes', () => {
    render(<Harness initial={[pieceTracked]} />);
    fireEvent.change(screen.getByLabelText(/gewicht pro stück.*zwiebel/i), { target: { value: '200' } });
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/80 kcal · 2 P · 19 KH · 0 F/);
  });

  it('switching a tracked row to Frei removes the macro sub-line; switching back restores it', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[tracked200]} />);
    expect(screen.getByTestId('row-macros-0')).toBeInTheDocument();
    await user.click(segment('Hähnchen', 'Frei'));
    expect(screen.queryByTestId('row-macros-0')).not.toBeInTheDocument();
    await user.click(segment('Hähnchen', 'Gewicht'));
    expect(screen.getByTestId('row-macros-0')).toBeInTheDocument();
  });
});

describe('RecipeIngredientEditor — Stück mode', () => {
  it('renders a piece-tracked row with both count and grams-per-piece editable', () => {
    render(<Harness initial={[pieceTracked]} />);
    expect(screen.getByLabelText(/stückzahl für zwiebel/i)).toHaveValue(1);
    expect(screen.getByLabelText(/gewicht pro stück.*zwiebel/i)).toHaveValue(150);
  });

  it('editing the piece count recomputes the mass amount in state', () => {
    render(<Capture initial={[pieceTracked]} />);
    fireEvent.change(screen.getByLabelText(/stückzahl für zwiebel/i), { target: { value: '2' } });
    expect(readState()[0]?.amount).toBe(300);
  });

  it('editing grams-per-piece recomputes the mass amount in state', () => {
    render(<Capture initial={[pieceTracked]} />);
    fireEvent.change(screen.getByLabelText(/gewicht pro stück.*zwiebel/i), { target: { value: '200' } });
    expect(readState()[0]?.amount).toBe(200);
  });

  it('renders the estimate badge for an AI-estimated piece row', () => {
    render(<Harness initial={[pieceTracked]} estimateIndices={new Set([0])} />);
    expect(screen.getByTestId('piece-estimate-0')).toBeInTheDocument();
  });
});

describe('RecipeIngredientEditor — Frei mode', () => {
  const untrackedNoDQ: RecipeIngredient = {
    name: 'Salz',
    unit: 'g',
    macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    amount: 0,
    untracked: true,
  };
  const untrackedWithDQ: RecipeIngredient = { ...untrackedNoDQ, displayQuantity: { amount: 1, unitLabel: 'TL' } };

  it('shows the free amount + unit inputs and the caption', () => {
    render(<Harness initial={[untrackedNoDQ]} />);
    expect(screen.getByLabelText(/anzeige-menge für salz/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/anzeige-einheit für salz/i)).toBeInTheDocument();
    expect(screen.getByText(/zählt nicht in die nährwerte/i)).toBeInTheDocument();
  });

  it('entering an amount and a unit writes displayQuantity to state', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[untrackedNoDQ]} />);
    fireEvent.change(screen.getByLabelText(/anzeige-menge für salz/i), { target: { value: '1' } });
    await user.type(screen.getByLabelText(/anzeige-einheit für salz/i), 'TL');
    expect(readState()[0]?.displayQuantity).toEqual({ amount: 1, unitLabel: 'TL' });
  });

  it('a free row with an empty unit writes no displayQuantity', () => {
    render(<Capture initial={[untrackedNoDQ]} />);
    fireEvent.change(screen.getByLabelText(/anzeige-menge für salz/i), { target: { value: '2' } });
    expect(readState()[0]?.displayQuantity).toBeUndefined();
  });

  it('a free row with displayQuantity prefills the inputs', () => {
    render(<Harness initial={[untrackedWithDQ]} />);
    expect(screen.getByLabelText(/anzeige-menge für salz/i)).toHaveValue(1);
    expect(screen.getByLabelText(/anzeige-einheit für salz/i)).toHaveValue('TL');
  });

  it('clearing the unit on a row with displayQuantity removes it from state', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[untrackedWithDQ]} />);
    await user.clear(screen.getByLabelText(/anzeige-einheit für salz/i));
    expect(readState()[0]?.displayQuantity).toBeUndefined();
  });
});

describe('RecipeIngredientEditor — replace ingredient via picker', () => {
  const oilRow: RecipeIngredient = {
    name: 'Olivenöl',
    unit: 'ml',
    macrosPerUnit: { calories: 8.84, protein: 0, carbs: 0, fat: 1 },
    amount: 30,
  };

  const saltRow: RecipeIngredient = {
    name: 'Salz',
    unit: 'g',
    macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    amount: 5,
    untracked: true,
  };

  const onionRowWithPiece: RecipeIngredient = {
    name: 'Zwiebel',
    unit: 'g',
    macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
    amount: 150,
    pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
  };

  it('opens the picker with the replace title when the row name is tapped', async () => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[oilRow]} />);
    await user.click(screen.getByTestId('replace-row-0'));
    expect(screen.getByRole('heading', { name: /zutat ersetzen/i })).toBeInTheDocument();
  });

  it('clears the note when an ingredient is replaced via the picker', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'sonnenblumenoel',
            source: 'FOODS',
            name: 'Sonnenblumenöl',
            unit: 'ml',
            macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    const rowWithNote: RecipeIngredient = { ...oilRow, note: 'fein angeschwitzt' };
    renderWithProviders(<Capture initial={[rowWithNote]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    await user.type(screen.getByRole('searchbox'), 'sonne');
    const result = await screen.findByRole('button', { name: /sonnenblumenöl/i });
    await user.click(result);

    const state = readState();
    expect(state).toHaveLength(1);
    expect(state[0]?.name).toBe('Sonnenblumenöl');
    expect(state[0]).not.toHaveProperty('note');
  });

  it('replaces a tracked row, keeping the amount and replacing name/unit/macros', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'sonnenblumenoel',
            source: 'FOODS',
            name: 'Sonnenblumenöl',
            unit: 'ml',
            macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[oilRow]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    await user.type(screen.getByRole('searchbox'), 'sonne');
    const result = await screen.findByRole('button', { name: /sonnenblumenöl/i });
    await user.click(result);

    const state = readState();
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({
      name: 'Sonnenblumenöl',
      unit: 'ml',
      amount: 30,
      macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
    });
    expect(state[0]?.untracked).toBeUndefined();
  });

  it('inherits untracked when the replacement is a FOODS-untracked entry', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'salz',
            source: 'FOODS',
            name: 'Salz',
            unit: 'g',
            macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            untracked: true,
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[oilRow]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    await user.type(screen.getByRole('searchbox'), 'salz');
    const result = await screen.findByRole('button', { name: /^salz/i });
    await user.click(result);

    const state = readState();
    expect(state[0]).toMatchObject({ name: 'Salz', unit: 'g', amount: 30, untracked: true });
  });

  it('clears inherited untracked when replacing an untracked row with a tracked entry', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'zucker',
            source: 'FOODS',
            name: 'Zucker',
            unit: 'g',
            macrosPerUnit: { calories: 4, protein: 0, carbs: 1, fat: 0 },
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[saltRow]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    await user.type(screen.getByRole('searchbox'), 'zucker');
    const result = await screen.findByRole('button', { name: /^zucker/i });
    await user.click(result);

    const state = readState();
    expect(state[0]).toMatchObject({ name: 'Zucker', amount: 5 });
    expect(state[0]?.untracked).toBeUndefined();
  });

  it('preserves pieceQuantity when the new pick is mass-tracked (g/ml)', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'schalotte',
            source: 'FOODS',
            name: 'Schalotte',
            unit: 'g',
            macrosPerUnit: { calories: 0.7, protein: 0.025, carbs: 0.16, fat: 0.001 },
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[onionRowWithPiece]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    await user.type(screen.getByRole('searchbox'), 'schal');
    const result = await screen.findByRole('button', { name: /schalotte/i });
    await user.click(result);

    const state = readState();
    expect(state[0]?.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 });
    expect(state[0]?.amount).toBe(150);
  });

  it('drops pieceQuantity when the new pick has a non-mass unit', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'tomatenmark',
            source: 'FOODS',
            name: 'Tomatenmark',
            unit: 'tbsp',
            macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[onionRowWithPiece]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    await user.type(screen.getByRole('searchbox'), 'tomate');
    const result = await screen.findByRole('button', { name: /tomatenmark/i });
    await user.click(result);

    const state = readState();
    expect(state[0]?.unit).toBe('tbsp');
    expect(state[0]?.pieceQuantity).toBeUndefined();
    expect(state[0]?.amount).toBe(150);
  });

  it('cancelling the picker leaves the row unchanged', async () => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[oilRow]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    expect(screen.getByRole('heading', { name: /zutat ersetzen/i })).toBeInTheDocument();
    const cancelButtons = screen.getAllByRole('button', { name: /^abbrechen$/i });
    await user.click(cancelButtons[0]!);

    const state = readState();
    expect(state).toEqual([oilRow]);
  });

  it('replacing one row does not affect any other row', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'sonnenblumenoel',
            source: 'FOODS',
            name: 'Sonnenblumenöl',
            unit: 'ml',
            macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[oilRow, saltRow]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    await user.type(screen.getByRole('searchbox'), 'sonne');
    const result = await screen.findByRole('button', { name: /sonnenblumenöl/i });
    await user.click(result);

    const state = readState();
    expect(state[0]?.name).toBe('Sonnenblumenöl');
    expect(state[1]).toEqual(saltRow);
  });

  it('skips the amount step in replace mode (no amount input shown after picking)', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'sonnenblumenoel',
            source: 'FOODS',
            name: 'Sonnenblumenöl',
            unit: 'ml',
            macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Capture initial={[oilRow]} />);

    await user.click(screen.getByTestId('replace-row-0'));
    await user.type(screen.getByRole('searchbox'), 'sonne');
    const result = await screen.findByRole('button', { name: /sonnenblumenöl/i });
    await user.click(result);

    expect(screen.queryByLabelText(/menge pro rezept/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /zutat ersetzen/i })).not.toBeInTheDocument();
  });
});

describe('RecipeIngredientEditor — ingredient note', () => {
  const ginger: RecipeIngredient = {
    name: 'Ingwer',
    unit: 'g',
    macrosPerUnit: { calories: 0.8, protein: 0.018, carbs: 0.178, fat: 0.008 },
    amount: 5,
  };

  it('keeps the note collapsed behind a "+ Notiz" button when the row has no note', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[ginger]} />);
    expect(screen.queryByTestId('ingredient-note-0')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notiz für Ingwer hinzufügen' }));
    const input = screen.getByTestId('ingredient-note-0') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('typing into the opened note input writes a `note` onto the row', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[ginger]} />);
    await user.click(screen.getByRole('button', { name: 'Notiz für Ingwer hinzufügen' }));
    await user.type(screen.getByTestId('ingredient-note-0'), 'fein gehackt');
    expect(readState()[0]?.note).toBe('fein gehackt');
  });

  it('the remove-note button clears the note and collapses the editor', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[{ ...ginger, note: 'fein gehackt' }]} />);
    await user.click(screen.getByRole('button', { name: 'Notiz für Ingwer entfernen' }));
    expect(readState()[0]).not.toHaveProperty('note');
    expect(screen.queryByTestId('ingredient-note-0')).not.toBeInTheDocument();
  });

  it('clearing the note input removes the `note` field from the row', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[{ ...ginger, note: 'fein gehackt' }]} />);
    await user.clear(screen.getByTestId('ingredient-note-0'));
    expect(readState()[0]).not.toHaveProperty('note');
  });

  it('renders the existing note on initial mount', () => {
    render(<Capture initial={[{ ...ginger, note: 'gerieben' }]} />);
    expect((screen.getByTestId('ingredient-note-0') as HTMLInputElement).value).toBe('gerieben');
  });

  it('trims surrounding whitespace on blur', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[ginger]} />);
    await user.click(screen.getByRole('button', { name: 'Notiz für Ingwer hinzufügen' }));
    await user.type(screen.getByTestId('ingredient-note-0'), '  in Scheiben  ');
    await user.tab();
    expect(readState()[0]?.note).toBe('in Scheiben');
  });
});
