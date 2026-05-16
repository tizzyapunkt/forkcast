import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { ReviewImportScreen } from './review-import-screen';
import type { RecipeDraft } from '../../domain/recipes';

const draft: RecipeDraft = {
  name: 'Test Pasta',
  yield: 2,
  steps: ['Boil water', 'Cook pasta'],
  ingredients: [
    {
      matched: true,
      name: 'Olivenöl',
      unit: 'ml',
      macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
      amount: 30,
      unitOverridden: false,
      source: 'FOODS',
    },
    {
      matched: true,
      name: 'Tomatenmark',
      unit: 'g',
      macrosPerUnit: { calories: 0.8, protein: 0.04, carbs: 0.13, fat: 0 },
      amount: 50,
      unitOverridden: true,
      source: 'FOODS',
    },
    {
      matched: false,
      name: 'mystery herb',
      amount: 1,
      unit: 'tsp',
    },
  ],
};

describe('ReviewImportScreen', () => {
  it('renders matched ingredients in the form and lists unmatched in the banner', async () => {
    renderWithProviders(<ReviewImportScreen draft={draft} onSaved={() => {}} onCancel={() => {}} />);

    expect(screen.getByDisplayValue('Test Pasta')).toBeInTheDocument();
    expect(screen.getByText('Olivenöl')).toBeInTheDocument();
    expect(screen.getByText('Tomatenmark')).toBeInTheDocument();
    expect(screen.getByText(/1 zutat ohne treffer/i)).toBeInTheDocument();
    expect(screen.getByText('mystery herb')).toBeInTheDocument();
  });

  it('shows an unitOverridden indicator when the catalog unit replaced the model unit', () => {
    renderWithProviders(<ReviewImportScreen draft={draft} onSaved={() => {}} onCancel={() => {}} />);

    expect(screen.getByTestId('unit-override-1')).toBeInTheDocument();
  });

  it('discards an unmatched ingredient without resolving it', async () => {
    renderWithProviders(<ReviewImportScreen draft={draft} onSaved={() => {}} onCancel={() => {}} />);

    await userEvent.click(screen.getByLabelText(/mystery herb.*verwerfen/i));
    expect(screen.queryByText('mystery herb')).not.toBeInTheDocument();
    expect(screen.queryByText(/zutat ohne treffer/i)).not.toBeInTheDocument();
  });

  it('renders piece-tracked draft rows in dual form with an estimate badge', () => {
    const pieceDraft: RecipeDraft = {
      name: 'Soup',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Zwiebel',
          unit: 'g',
          macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
          amount: 150,
          unitOverridden: false,
          source: 'FOODS',
          pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
        },
      ],
    };
    renderWithProviders(<ReviewImportScreen draft={pieceDraft} onSaved={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText(/stückzahl für zwiebel/i)).toHaveValue(1);
    expect(screen.getByLabelText(/gewicht pro stück.*zwiebel/i)).toHaveValue(150);
    expect(screen.getByTestId('piece-estimate-0')).toBeInTheDocument();
  });

  it('saving a piece-tracked recipe persists the updated mass and pieceQuantity after editing gramsPerPiece', async () => {
    const pieceDraft: RecipeDraft = {
      name: 'Soup',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Zwiebel',
          unit: 'g',
          macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
          amount: 150,
          unitOverridden: false,
          source: 'FOODS',
          pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
        },
      ],
    };
    let captured: { ingredients: Array<{ amount: number; pieceQuantity?: unknown }> } | null = null;
    server.use(
      http.post('/api/add-recipe', async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
      }),
    );

    const { fireEvent } = await import('@testing-library/react');
    const onSaved = vi.fn<() => void>();
    renderWithProviders(<ReviewImportScreen draft={pieceDraft} onSaved={onSaved} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/gewicht pro stück.*zwiebel/i), { target: { value: '200' } });
    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(captured!.ingredients[0]!.amount).toBe(200);
    expect(captured!.ingredients[0]!.pieceQuantity).toEqual({ amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 200 });
  });

  it('renders an inherited-untracked draft row with the toggle on and a badge', () => {
    const untrackedDraft: RecipeDraft = {
      name: 'Pasta',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Olivenöl',
          unit: 'ml',
          macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
          amount: 30,
          unitOverridden: false,
          source: 'FOODS',
        },
        {
          matched: true,
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 5,
          unitOverridden: false,
          source: 'FOODS',
          untracked: true,
        },
      ],
    };
    renderWithProviders(<ReviewImportScreen draft={untrackedDraft} onSaved={() => {}} onCancel={() => {}} />);

    const oilToggle = screen.getByTestId('untracked-toggle-0');
    const saltToggle = screen.getByTestId('untracked-toggle-1');
    expect(oilToggle).toHaveAttribute('aria-pressed', 'false');
    expect(saltToggle).toHaveAttribute('aria-pressed', 'true');
    expect(oilToggle).toHaveTextContent(/nicht zählen/i);
    expect(saltToggle).toHaveTextContent(/nicht gezählt/i);
  });

  it('persists the user-edited untracked state in the POST /add-recipe payload', async () => {
    const untrackedDraft: RecipeDraft = {
      name: 'Pasta',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Olivenöl',
          unit: 'ml',
          macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
          amount: 30,
          unitOverridden: false,
          source: 'FOODS',
        },
        {
          matched: true,
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 5,
          unitOverridden: false,
          source: 'FOODS',
          untracked: true,
        },
      ],
    };
    let captured: { ingredients: Array<{ name: string; untracked?: boolean }> } | null = null;
    server.use(
      http.post('/api/add-recipe', async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
      }),
    );

    const onSaved = vi.fn<() => void>();
    renderWithProviders(<ReviewImportScreen draft={untrackedDraft} onSaved={onSaved} onCancel={() => {}} />);

    // Toggle Olivenöl ON (override tracked → untracked) and leave Salz as-is.
    await userEvent.click(screen.getByLabelText(/olivenöl nicht in nährwerten zählen/i));

    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(captured!.ingredients[0]!.name).toBe('Olivenöl');
    expect(captured!.ingredients[0]!.untracked).toBe(true);
    expect(captured!.ingredients[1]!.name).toBe('Salz');
    expect(captured!.ingredients[1]!.untracked).toBe(true);
  });

  it('swaps a misrecognized matched row via the picker, keeping the AI-extracted amount', async () => {
    const wrongMatchDraft: RecipeDraft = {
      name: 'Test Pasta',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Olivenöl',
          unit: 'ml',
          macrosPerUnit: { calories: 8.84, protein: 0, carbs: 0, fat: 1 },
          amount: 30,
          unitOverridden: false,
          source: 'FOODS',
        },
      ],
    };
    let captured: { ingredients: Array<{ name: string; amount: number; unit: string }> } | null = null;
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
      http.post('/api/add-recipe', async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
      }),
    );

    const onSaved = vi.fn<() => void>();
    renderWithProviders(<ReviewImportScreen draft={wrongMatchDraft} onSaved={onSaved} onCancel={() => {}} />);

    await userEvent.click(screen.getByTestId('replace-row-0'));
    await userEvent.type(screen.getByRole('searchbox'), 'sonne');
    const result = await screen.findByRole('button', { name: /sonnenblumenöl/i });
    await userEvent.click(result);

    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(captured!.ingredients[0]!.name).toBe('Sonnenblumenöl');
    expect(captured!.ingredients[0]!.amount).toBe(30);
    expect(captured!.ingredients[0]!.unit).toBe('ml');
  });

  it('clears the AI-estimate badge after a swap, even if pieceQuantity is preserved', async () => {
    const estimatedDraft: RecipeDraft = {
      name: 'Soup',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Zwiebel',
          unit: 'g',
          macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
          amount: 150,
          unitOverridden: false,
          source: 'FOODS',
          pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
        },
      ],
    };
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

    renderWithProviders(<ReviewImportScreen draft={estimatedDraft} onSaved={() => {}} onCancel={() => {}} />);

    expect(screen.getByTestId('piece-estimate-0')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('replace-row-0'));
    await userEvent.type(screen.getByRole('searchbox'), 'schal');
    const result = await screen.findByRole('button', { name: /schalotte/i });
    await userEvent.click(result);

    expect(screen.queryByTestId('piece-estimate-0')).not.toBeInTheDocument();
  });

  it('round-trips importer-provided displayQuantity through to the add-recipe payload', async () => {
    const dq = { amount: 1, unitLabel: 'TL' } as const;
    const draftWithDQ: RecipeDraft = {
      name: 'Pasta',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 0,
          unitOverridden: false,
          source: 'FOODS',
          untracked: true,
          displayQuantity: dq,
        },
      ],
    };
    let captured: {
      ingredients: Array<{
        name: string;
        untracked?: boolean;
        displayQuantity?: { amount: number; unitLabel: string };
      }>;
    } | null = null;
    server.use(
      http.post('/api/add-recipe', async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
      }),
    );

    const onSaved = vi.fn<() => void>();
    renderWithProviders(<ReviewImportScreen draft={draftWithDQ} onSaved={onSaved} onCancel={() => {}} />);

    // Row should render `1 TL` (not `0 g`).
    expect(screen.getByTestId('display-quantity-0')).toHaveTextContent(/^1 TL$/);

    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(captured!.ingredients[0]!.untracked).toBe(true);
    expect(captured!.ingredients[0]!.displayQuantity).toEqual({ amount: 1, unitLabel: 'TL' });
  });

  it('lets the user add a displayQuantity to an imported untracked row and includes it on save', async () => {
    const draftMissingDQ: RecipeDraft = {
      name: 'Pasta',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 0,
          unitOverridden: false,
          source: 'FOODS',
          untracked: true,
        },
      ],
    };
    let captured: { ingredients: Array<{ displayQuantity?: { amount: number; unitLabel: string } }> } | null = null;
    server.use(
      http.post('/api/add-recipe', async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
      }),
    );

    const onSaved = vi.fn<() => void>();
    const { fireEvent } = await import('@testing-library/react');
    renderWithProviders(<ReviewImportScreen draft={draftMissingDQ} onSaved={onSaved} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /menge für salz ergänzen/i }));
    fireEvent.change(screen.getByLabelText(/anzeige-menge für salz/i), { target: { value: '1' } });
    await userEvent.clear(screen.getByLabelText(/anzeige-einheit für salz/i));
    await userEvent.type(screen.getByLabelText(/anzeige-einheit für salz/i), 'EL');
    await userEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(captured!.ingredients[0]!.displayQuantity).toEqual({ amount: 1, unitLabel: 'EL' });
  });

  it('toggling an imported untracked row to tracked drops displayQuantity from the save payload', async () => {
    const dq = { amount: 1, unitLabel: 'TL' } as const;
    const draftWithDQ: RecipeDraft = {
      name: 'Pasta',
      yield: 1,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 5,
          unitOverridden: false,
          source: 'FOODS',
          untracked: true,
          displayQuantity: dq,
        },
      ],
    };
    let captured: { ingredients: Array<{ untracked?: boolean; displayQuantity?: unknown }> } | null = null;
    server.use(
      http.post('/api/add-recipe', async ({ request }) => {
        captured = (await request.json()) as typeof captured;
        return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
      }),
    );

    const onSaved = vi.fn<() => void>();
    renderWithProviders(<ReviewImportScreen draft={draftWithDQ} onSaved={onSaved} onCancel={() => {}} />);

    // Toggle untracked → tracked (clears displayQuantity per the editor rules).
    await userEvent.click(screen.getByTestId('untracked-toggle-0'));
    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(captured!.ingredients[0]!.untracked).toBeUndefined();
    expect(captured!.ingredients[0]!.displayQuantity).toBeUndefined();
  });

  describe('debug box', () => {
    it('does not render the debug box when draft.debug is undefined', () => {
      renderWithProviders(<ReviewImportScreen draft={draft} onSaved={() => {}} onCancel={() => {}} />);
      expect(screen.queryByTestId('import-debug-box')).not.toBeInTheDocument();
    });

    it('renders the debug box (collapsed) and reveals raw/chosen/candidates/flags when toggled', async () => {
      const draftWithDebug: RecipeDraft = {
        ...draft,
        debug: {
          ingredients: [
            {
              raw: { name: 'tomato paste', amount: 2, unit: 'tbsp' },
              candidates: [
                { name: 'Tomatenmark', source: 'FOODS', unit: 'g', untracked: false },
                { name: 'Tomaten', source: 'FOODS', unit: 'g', untracked: false },
                { name: 'Tomate, getrocknet', source: 'FOODS', unit: 'g', untracked: false },
              ],
              chosen: { name: 'Tomatenmark', source: 'FOODS', unit: 'g', untracked: false },
              flags: { unitOverridden: true, pieceQuantityDropped: false, untrackedInherited: false },
            },
          ],
        },
      };
      renderWithProviders(<ReviewImportScreen draft={draftWithDebug} onSaved={() => {}} onCancel={() => {}} />);

      const box = screen.getByTestId('import-debug-box');
      expect(box).toBeInTheDocument();
      expect(screen.queryByTestId('import-debug-entry-0')).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId('import-debug-toggle'));

      const entry = screen.getByTestId('import-debug-entry-0');
      expect(entry).toHaveTextContent('tomato paste');
      expect(entry).toHaveTextContent('Tomatenmark');
      expect(entry).toHaveTextContent('Tomaten');
      expect(entry).toHaveTextContent('Tomate, getrocknet');
      expect(entry).toHaveTextContent(/unitOverridden/i);
    });
  });

  it('submits via POST /add-recipe and calls onSaved', async () => {
    server.use(
      http.post('/api/add-recipe', async ({ request }) => {
        const body = (await request.json()) as { name: string; ingredients: unknown[]; steps: unknown[] };
        expect(body.name).toBe('Test Pasta');
        expect(body.ingredients).toHaveLength(2);
        return HttpResponse.json({ id: 'new-1', ...body, createdAt: '', updatedAt: '' }, { status: 201 });
      }),
    );

    const onSaved = vi.fn<() => void>();
    renderWithProviders(<ReviewImportScreen draft={draft} onSaved={onSaved} onCancel={() => {}} />);

    await userEvent.click(screen.getByLabelText(/mystery herb.*verwerfen/i));
    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
