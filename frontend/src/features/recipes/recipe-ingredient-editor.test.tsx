import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('RecipeIngredientEditor — per-row calories and macros', () => {
  const tracked200: RecipeIngredient = {
    name: 'Hähnchen',
    unit: 'g',
    macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
    amount: 200,
  };

  it('renders kcal + macros for a tracked row (200g × macrosPerUnit → 500/52/0/30)', () => {
    render(<Harness initial={[tracked200]} />);
    const macroLine = screen.getByTestId('row-macros-0');
    expect(macroLine).toHaveTextContent(/500 kcal · 52g P · 0g K · 30g F/);
  });

  it('hides the macro sub-line entirely for an untracked row', () => {
    const untracked: RecipeIngredient = { ...tracked200, untracked: true };
    render(<Harness initial={[untracked]} />);
    expect(screen.queryByTestId('row-macros-0')).not.toBeInTheDocument();
    const row = screen.getByText('Hähnchen').closest('li')!;
    expect(row).not.toHaveTextContent(/kcal/);
    expect(row).not.toHaveTextContent(/g P/);
    expect(row).not.toHaveTextContent(/g K/);
    expect(row).not.toHaveTextContent(/g F/);
  });

  it('updates the macro sub-line live as the amount input changes (100 → 250)', () => {
    const row: RecipeIngredient = {
      name: 'Lachs',
      unit: 'g',
      macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
      amount: 100,
    };
    render(<Harness initial={[row]} />);
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/165 kcal · 31g P · 0g K · 4g F/);
    fireEvent.change(screen.getByLabelText(/menge für lachs/i), { target: { value: '250' } });
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/413 kcal · 78g P · 0g K · 9g F/);
  });

  it('updates the macro sub-line live as the piece count changes', () => {
    const row: RecipeIngredient = {
      name: 'Zwiebel',
      unit: 'g',
      macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
      amount: 150,
      pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };
    render(<Harness initial={[row]} />);
    // 150 × 0.4 = 60 kcal · 150 × 0.011 = 1.65 → 2g P · 150 × 0.093 = 13.95 → 14g K · 150 × 0.001 = 0.15 → 0g F
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/60 kcal · 2g P · 14g K · 0g F/);
    fireEvent.change(screen.getByLabelText(/stückzahl für zwiebel/i), { target: { value: '2' } });
    // amount becomes 300 → 120 kcal · 3.3 → 3g P · 27.9 → 28g K · 0.3 → 0g F
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/120 kcal · 3g P · 28g K · 0g F/);
  });

  it('updates the macro sub-line live as grams-per-piece changes', () => {
    const row: RecipeIngredient = {
      name: 'Zwiebel',
      unit: 'g',
      macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
      amount: 150,
      pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
    };
    render(<Harness initial={[row]} />);
    fireEvent.change(screen.getByLabelText(/gewicht pro stück.*zwiebel/i), { target: { value: '200' } });
    // amount becomes 200 → 80 kcal · 2.2 → 2g P · 18.6 → 19g K · 0.2 → 0g F
    expect(screen.getByTestId('row-macros-0')).toHaveTextContent(/80 kcal · 2g P · 19g K · 0g F/);
  });

  it('toggling a tracked row to untracked removes the macro sub-line; toggling back restores it', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[tracked200]} />);
    expect(screen.getByTestId('row-macros-0')).toBeInTheDocument();
    await user.click(screen.getByTestId('untracked-toggle-0'));
    expect(screen.queryByTestId('row-macros-0')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('untracked-toggle-0'));
    expect(screen.getByTestId('row-macros-0')).toBeInTheDocument();
  });
});

describe('RecipeIngredientEditor — piece quantities', () => {
  it('renders a piece-tracked row with both count and grams-per-piece editable', () => {
    render(<Harness initial={[pieceTracked]} />);
    const countInput = screen.getByLabelText(/stückzahl für zwiebel/i);
    const gramsInput = screen.getByLabelText(/gewicht pro stück.*zwiebel/i);
    expect(countInput).toHaveValue(1);
    expect(gramsInput).toHaveValue(150);
  });

  it('editing the piece count recomputes the mass amount', () => {
    render(<Harness initial={[pieceTracked]} />);
    const countInput = screen.getByLabelText(/stückzahl für zwiebel/i);
    fireEvent.change(countInput, { target: { value: '2' } });
    const massInput = screen.getByLabelText(/menge für zwiebel/i);
    expect(massInput).toHaveValue(300);
  });

  it('editing grams-per-piece recomputes the mass amount', () => {
    render(<Harness initial={[pieceTracked]} estimateIndices={new Set([0])} />);
    expect(screen.getByTestId('piece-estimate-0')).toBeInTheDocument();
    const gramsInput = screen.getByLabelText(/gewicht pro stück.*zwiebel/i);
    fireEvent.change(gramsInput, { target: { value: '200' } });
    const massInput = screen.getByLabelText(/menge für zwiebel/i);
    expect(massInput).toHaveValue(200);
  });

  it('editing the mass amount on a piece-tracked row prompts to detach piece info', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[pieceTracked]} />);
    const massInput = screen.getByLabelText(/menge für zwiebel/i);
    fireEvent.change(massInput, { target: { value: '120' } });
    expect(screen.getByText(/Direktes Bearbeiten/i)).toBeInTheDocument();

    const detachBtns = screen.getAllByRole('button', { name: /Stückzählung entfernen$/ });
    const confirmBtn = detachBtns.find((b) => !b.getAttribute('aria-label')) as HTMLButtonElement;
    await user.click(confirmBtn);
    expect(screen.queryByLabelText(/stückzahl für zwiebel/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/menge für zwiebel/i)).toHaveValue(120);
  });

  it('renders mass-only rows without piece UI', () => {
    render(<Harness initial={[massOnly]} />);
    expect(screen.queryByLabelText(/stückzahl/i)).not.toBeInTheDocument();
    const addPiece = screen.getByRole('button', { name: /Stückgewicht für Mehl hinterlegen/i });
    expect(addPiece).toBeInTheDocument();
  });

  it('attach-piece flow: clicking + pro Stück opens form, submit attaches pieceQuantity', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[{ ...massOnly, name: 'Tomate', amount: 200 }]} />);
    await user.click(screen.getByRole('button', { name: /Stückgewicht für Tomate hinterlegen/i }));
    const labelInput = screen.getByLabelText(/Bezeichnung pro Stück für Tomate/i);
    await user.type(labelInput, 'Tomate');
    await user.click(screen.getByRole('button', { name: /^OK$/ }));
    // After attach: row shows the count input
    expect(screen.getByLabelText(/Stückzahl für Tomate/i)).toBeInTheDocument();
  });
});

describe('RecipeIngredientEditor — untracked toggle', () => {
  const salt: RecipeIngredient = {
    name: 'Salz',
    unit: 'g',
    macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    amount: 5,
    untracked: true,
  };

  it('renders an inherited-untracked row with the toggle pressed and the "Nicht gezählt" label', () => {
    render(<Harness initial={[salt]} />);
    const toggle = screen.getByTestId('untracked-toggle-0');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAccessibleName(/salz nicht in nährwerten zählen/i);
    expect(toggle).toHaveTextContent(/nicht gezählt/i);
  });

  it('renders a tracked row with the toggle unpressed and the "Nicht zählen" label', () => {
    render(<Harness initial={[massOnly]} />);
    const toggle = screen.getByTestId('untracked-toggle-0');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent(/nicht zählen/i);
  });

  it('toggling a tracked row to untracked flips aria-pressed and the label', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[massOnly]} />);
    const toggle = screen.getByTestId('untracked-toggle-0');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent(/nicht gezählt/i);
  });

  it('toggling an inherited-untracked row off flips aria-pressed and the label back', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[salt]} />);
    const toggle = screen.getByTestId('untracked-toggle-0');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent(/nicht zählen/i);
  });

  it('handles mixed tracked and untracked rows independently', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[massOnly, salt]} />);
    const flourToggle = screen.getByTestId('untracked-toggle-0');
    const saltToggle = screen.getByTestId('untracked-toggle-1');
    expect(flourToggle).toHaveAttribute('aria-pressed', 'false');
    expect(saltToggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(flourToggle);
    expect(flourToggle).toHaveAttribute('aria-pressed', 'true');
    expect(saltToggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('RecipeIngredientEditor — replace ingredient via picker', () => {
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
    const result = await screen.findByRole('button', { name: /zucker/i });
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
    // The picker has a top-right "Abbrechen" button
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

    // After picking, the picker dialog should be closed — no amount input visible.
    expect(screen.queryByLabelText(/menge pro rezept/i)).not.toBeInTheDocument();
    // Replace title also gone.
    expect(screen.queryByRole('heading', { name: /zutat ersetzen/i })).not.toBeInTheDocument();
  });
});

describe('RecipeIngredientEditor — displayQuantity', () => {
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

  const tracked: RecipeIngredient = {
    name: 'Mehl',
    unit: 'g',
    macrosPerUnit: { calories: 3.4, protein: 0.1, carbs: 0.7, fat: 0.01 },
    amount: 200,
  };

  const untrackedNoDQ: RecipeIngredient = {
    name: 'Salz',
    unit: 'g',
    macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    amount: 0,
    untracked: true,
  };

  const untrackedWithDQ: RecipeIngredient = {
    ...untrackedNoDQ,
    displayQuantity: { amount: 1, unitLabel: 'TL' },
  };

  it('tracked row does not show the + Menge ergänzen affordance', () => {
    render(<Capture initial={[tracked]} />);
    expect(screen.queryByRole('button', { name: /menge für mehl ergänzen/i })).not.toBeInTheDocument();
  });

  it('untracked row without displayQuantity shows + Menge ergänzen', () => {
    render(<Capture initial={[untrackedNoDQ]} />);
    expect(screen.getByRole('button', { name: /menge für salz ergänzen/i })).toBeInTheDocument();
  });

  it('clicking + Menge ergänzen, entering values, and confirming writes displayQuantity to state', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[untrackedNoDQ]} />);
    await user.click(screen.getByRole('button', { name: /menge für salz ergänzen/i }));

    const amountInput = screen.getByLabelText(/anzeige-menge für salz/i);
    const unitInput = screen.getByLabelText(/anzeige-einheit für salz/i);
    fireEvent.change(amountInput, { target: { value: '1' } });
    await user.clear(unitInput);
    await user.type(unitInput, 'TL');
    await user.click(screen.getByRole('button', { name: /^ok$/i }));

    const state = readState();
    expect(state[0]?.displayQuantity).toEqual({ amount: 1, unitLabel: 'TL' });
  });

  it('untracked row with displayQuantity renders {amount} {unitLabel} in place of canonical', () => {
    render(<Capture initial={[untrackedWithDQ]} />);
    expect(screen.getByTestId('display-quantity-0')).toHaveTextContent(/^1 TL$/);
    // canonical amount input for that row should be absent (exact label, not the edit button)
    expect(screen.queryByLabelText('Menge für Salz')).not.toBeInTheDocument();
  });

  it('clicking the edit affordance opens a prefilled inline editor', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[untrackedWithDQ]} />);
    await user.click(screen.getByRole('button', { name: /menge für salz bearbeiten/i }));
    expect(screen.getByLabelText(/anzeige-menge für salz/i)).toHaveValue(1);
    expect(screen.getByLabelText(/anzeige-einheit für salz/i)).toHaveValue('TL');
  });

  it('"Menge entfernen" clears the displayQuantity from state', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[untrackedWithDQ]} />);
    await user.click(screen.getByRole('button', { name: /menge für salz bearbeiten/i }));
    await user.click(screen.getByRole('button', { name: /^menge entfernen$/i }));
    const state = readState();
    expect(state[0]?.displayQuantity).toBeUndefined();
  });

  it('canceling the editor leaves the row state unchanged', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[untrackedWithDQ]} />);
    await user.click(screen.getByRole('button', { name: /menge für salz bearbeiten/i }));
    const unitInput = screen.getByLabelText(/anzeige-einheit für salz/i);
    await user.clear(unitInput);
    await user.type(unitInput, 'EL');
    await user.click(screen.getByRole('button', { name: /^abbrechen$/i }));
    const state = readState();
    expect(state[0]?.displayQuantity).toEqual({ amount: 1, unitLabel: 'TL' });
  });

  it('toggling an untracked row with displayQuantity to tracked clears displayQuantity', async () => {
    const user = userEvent.setup();
    render(<Capture initial={[untrackedWithDQ]} />);
    await user.click(screen.getByTestId('untracked-toggle-0'));
    const state = readState();
    expect(state[0]?.untracked).toBeUndefined();
    expect(state[0]?.displayQuantity).toBeUndefined();
  });
});
