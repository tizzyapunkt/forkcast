import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { ReviewImportScreen } from './review-import-screen';
import type { IngredientMatchProvenance, RecipeDraft } from '../../domain/recipes';

function segment(rowName: string, label: string): HTMLElement {
  const group = screen.getByRole('group', { name: new RegExp(`Maß-Steuerung für ${rowName}`, 'i') });
  return within(group).getByRole('radio', { name: label });
}

const noFlags = {
  unitOverridden: false,
  pieceQuantityDropped: false,
  untrackedInherited: false,
  missingAmount: false,
} as const;

function provenanceEntry(overrides: Partial<IngredientMatchProvenance> = {}): IngredientMatchProvenance {
  return {
    raw: { name: 'raw name' },
    candidates: [],
    chosen: null,
    flags: { ...noFlags },
    ...overrides,
  };
}

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
      source: 'CATALOG',
    },
    {
      matched: true,
      name: 'Tomatenmark',
      unit: 'g',
      macrosPerUnit: { calories: 0.8, protein: 0.04, carbs: 0.13, fat: 0 },
      amount: 50,
      unitOverridden: true,
      source: 'CATALOG',
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
          source: 'CATALOG',
          pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
        },
      ],
    };
    renderWithProviders(<ReviewImportScreen draft={pieceDraft} onSaved={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText(/stückzahl für zwiebel/i)).toHaveValue('1');
    expect(screen.getByLabelText(/gewicht pro stück.*zwiebel/i)).toHaveValue('150');
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
          source: 'CATALOG',
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
          source: 'CATALOG',
        },
        {
          matched: true,
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 5,
          unitOverridden: false,
          source: 'CATALOG',
          untracked: true,
        },
      ],
    };
    renderWithProviders(<ReviewImportScreen draft={untrackedDraft} onSaved={() => {}} onCancel={() => {}} />);

    expect(segment('Olivenöl', 'Gewicht')).toHaveAttribute('aria-checked', 'true');
    expect(segment('Salz', 'Frei')).toHaveAttribute('aria-checked', 'true');
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
          source: 'CATALOG',
        },
        {
          matched: true,
          name: 'Salz',
          unit: 'g',
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 5,
          unitOverridden: false,
          source: 'CATALOG',
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

    // Switch Olivenöl to Frei (override tracked → untracked) and leave Salz as-is.
    await userEvent.click(segment('Olivenöl', 'Frei'));

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
          source: 'CATALOG',
        },
      ],
    };
    let captured: { ingredients: Array<{ name: string; amount: number; unit: string }> } | null = null;
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'sonnenblumenoel',
            source: 'CATALOG',
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
          source: 'CATALOG',
          pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
        },
      ],
    };
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'schalotte',
            source: 'CATALOG',
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
          source: 'CATALOG',
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

    // The Frei row prefills the display amount/unit inputs (1 / TL), not the canonical 0 g.
    expect(screen.getByLabelText(/anzeige-menge für salz/i)).toHaveValue('1');
    expect(screen.getByLabelText(/anzeige-einheit für salz/i)).toHaveValue('TL');

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
          source: 'CATALOG',
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

    // The row is already in Frei mode (untracked); the free amount/unit inputs are inline.
    fireEvent.change(screen.getByLabelText(/anzeige-menge für salz/i), { target: { value: '1' } });
    await userEvent.clear(screen.getByLabelText(/anzeige-einheit für salz/i));
    await userEvent.type(screen.getByLabelText(/anzeige-einheit für salz/i), 'EL');

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
          source: 'CATALOG',
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

    // Switch Frei → Gewicht (clears untracked + displayQuantity per the seeding rules).
    await userEvent.click(segment('Salz', 'Gewicht'));
    await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(captured!.ingredients[0]!.untracked).toBeUndefined();
    expect(captured!.ingredients[0]!.displayQuantity).toBeUndefined();
  });

  describe('match provenance', () => {
    // Draft index 1 is unmatched, so form row 1 is draft index 2 — the pairing must survive that gap.
    const gappedDraft: RecipeDraft = {
      name: 'Sugo',
      yield: 2,
      steps: [],
      ingredients: [
        {
          matched: true,
          name: 'Olivenöl',
          unit: 'ml',
          macrosPerUnit: { calories: 9, protein: 0, carbs: 0, fat: 1 },
          amount: 30,
          unitOverridden: false,
          source: 'CATALOG',
        },
        { matched: false, name: 'mystery herb', amount: 1, unit: 'tsp' },
        {
          matched: true,
          name: 'Tomatenmark',
          unit: 'g',
          macrosPerUnit: { calories: 0.8, protein: 0.04, carbs: 0.13, fat: 0 },
          amount: 50,
          unitOverridden: true,
          source: 'CATALOG',
        },
      ],
      provenance: {
        ingredients: [
          provenanceEntry({
            raw: { name: 'Olivenöl', amount: 30, unit: 'ml' },
            candidates: [{ name: 'Olivenöl', source: 'CATALOG', unit: 'ml', untracked: false }],
            chosen: { name: 'Olivenöl', source: 'CATALOG', unit: 'ml', untracked: false },
          }),
          provenanceEntry({ raw: { name: 'mystery herb', amount: 1, unit: 'tsp' } }),
          provenanceEntry({
            raw: { name: 'Kirschtomaten', amount: 2, unit: 'tbsp' },
            candidates: [
              { name: 'Tomatenmark', source: 'CATALOG', unit: 'g', untracked: false },
              { name: 'Tomaten', source: 'CATALOG', unit: 'g', untracked: false },
            ],
            chosen: { name: 'Tomatenmark', source: 'CATALOG', unit: 'g', untracked: false },
            flags: { ...noFlags, unitOverridden: true },
          }),
        ],
      },
    };

    it('pairs each matched row with its provenance entry by draft index, skipping unmatched rows', () => {
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={() => {}} onCancel={() => {}} />);

      expect(screen.getByTestId('row-raw-0')).toHaveTextContent('30 ml Olivenöl');
      expect(screen.getByTestId('row-raw-1')).toHaveTextContent('2 tbsp Kirschtomaten');
    });

    it('renders the raw extracted line beneath the matched name so a mismatch is legible in place', () => {
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={() => {}} onCancel={() => {}} />);

      expect(screen.getByText('Tomatenmark')).toBeInTheDocument();
      expect(screen.getByLabelText(/gelesener text für tomatenmark/i)).toHaveTextContent(/Kirschtomaten/);
    });

    it('renders no provenance affordances when the draft carries none', () => {
      renderWithProviders(<ReviewImportScreen draft={draft} onSaved={() => {}} onCancel={() => {}} />);

      expect(screen.queryByTestId('row-raw-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('row-uncertain-0')).not.toBeInTheDocument();
    });

    it('keeps every remaining row paired with its own provenance after an earlier row is removed', async () => {
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={() => {}} onCancel={() => {}} />);

      await userEvent.click(screen.getByLabelText(/^Olivenöl entfernen$/i));

      expect(screen.getByTestId('row-raw-0')).toHaveTextContent('2 tbsp Kirschtomaten');
      expect(screen.queryByTestId('row-raw-1')).not.toBeInTheDocument();
    });

    it('keeps the raw line unchanged when the row amount is edited', async () => {
      const { fireEvent } = await import('@testing-library/react');
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={() => {}} onCancel={() => {}} />);

      fireEvent.change(screen.getByLabelText(/menge für tomatenmark/i), { target: { value: '75' } });

      expect(screen.getByTestId('row-raw-1')).toHaveTextContent('2 tbsp Kirschtomaten');
    });

    it('keeps the raw line unchanged when the row ingredient is replaced', async () => {
      server.use(
        http.get('/api/search-ingredients', () =>
          HttpResponse.json([
            {
              id: 'kirschtomaten',
              source: 'CATALOG',
              name: 'Kirschtomaten',
              unit: 'g',
              macrosPerUnit: { calories: 0.18, protein: 0.009, carbs: 0.039, fat: 0.002 },
            },
          ]),
        ),
      );
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={() => {}} onCancel={() => {}} />);

      await userEvent.click(screen.getByTestId('replace-row-1'));
      await userEvent.type(screen.getByRole('searchbox'), 'kirsch');
      await userEvent.click(await screen.findByRole('button', { name: /kirschtomaten/i }));

      expect(screen.getByText('Kirschtomaten')).toBeInTheDocument();
      expect(screen.getByTestId('row-raw-1')).toHaveTextContent('2 tbsp Kirschtomaten');
    });

    it('gives a row added through the resolve flow no raw line', async () => {
      server.use(
        http.post('/api/propose-ingredient-resolutions', () =>
          HttpResponse.json({ proposals: [{ verdict: 'skip', reason: 'x' }] }),
        ),
        http.get('/api/search-ingredients', () =>
          HttpResponse.json([
            {
              id: 'oregano',
              source: 'CATALOG',
              name: 'Oregano',
              unit: 'g',
              macrosPerUnit: { calories: 2.65, protein: 0.09, carbs: 0.69, fat: 0.043 },
            },
          ]),
        ),
      );
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={() => {}} onCancel={() => {}} />);

      await userEvent.click(await screen.findByLabelText(/mystery herb.*zuordnen/i));
      await userEvent.click(screen.getByRole('button', { name: /^katalog$/i }));
      await userEvent.type(screen.getByRole('searchbox'), 'oreg');
      await userEvent.click(await screen.findByRole('button', { name: /oregano/i }));

      expect(screen.getByText('Oregano')).toBeInTheDocument();
      expect(screen.queryByTestId('row-raw-2')).not.toBeInTheDocument();
    });

    it('swaps a row from its import candidates in one tap, keeping the row amount', async () => {
      let captured: { ingredients: Array<{ name: string; amount: number; unit: string }> } | null = null;
      server.use(
        http.get('/api/search-ingredients', () =>
          HttpResponse.json([
            {
              id: 'tomaten',
              source: 'CATALOG',
              name: 'Tomaten',
              unit: 'g',
              macrosPerUnit: { calories: 0.18, protein: 0.009, carbs: 0.039, fat: 0.002 },
            },
          ]),
        ),
        http.post('/api/add-recipe', async ({ request }) => {
          captured = (await request.json()) as typeof captured;
          return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
        }),
      );

      const onSaved = vi.fn<() => void>();
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={onSaved} onCancel={() => {}} />);

      await userEvent.click(screen.getByTestId('replace-row-1'));
      // The runner-up candidate is offered without typing a query.
      await userEvent.click(screen.getByTestId('picker-candidate-1'));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());

      expect(captured!.ingredients[1]!.name).toBe('Tomaten');
      expect(captured!.ingredients[1]!.amount).toBe(50);
      expect(captured!.ingredients[1]!.unit).toBe('g');
    });

    it('marks a row whose unit was replaced and whose tier offered alternatives', () => {
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={() => {}} onCancel={() => {}} />);

      const marker = screen.getByTestId('row-uncertain-1');
      expect(marker).toHaveTextContent(/Einheit tbsp → g/);
      expect(marker).toHaveTextContent(/2 Alternativen/);
    });

    it('leaves a confident single-candidate match with no flags unmarked', () => {
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={() => {}} onCancel={() => {}} />);

      expect(screen.queryByTestId('row-uncertain-0')).not.toBeInTheDocument();
    });

    it.each([
      ['pieceQuantityDropped', { ...noFlags, pieceQuantityDropped: true }, /Stückangabe verworfen/],
      ['untrackedInherited', { ...noFlags, untrackedInherited: true }, /zählt nicht in den Nährwerten/],
      ['missingAmount', { ...noFlags, missingAmount: true }, /Menge fehlt/],
    ])('names the %s condition in German on the marked row', (_label, flags, expected) => {
      const flaggedDraft: RecipeDraft = {
        name: 'X',
        yield: 1,
        steps: [],
        ingredients: [
          {
            matched: true,
            name: 'Knoblauch',
            unit: 'g',
            macrosPerUnit: { calories: 1.5, protein: 0.06, carbs: 0.33, fat: 0.005 },
            amount: 6,
            unitOverridden: false,
            source: 'CATALOG',
          },
        ],
        provenance: {
          ingredients: [
            provenanceEntry({
              raw: { name: 'Knoblauch', amount: 2, unit: 'g' },
              candidates: [{ name: 'Knoblauch', source: 'CATALOG', unit: 'g', untracked: false }],
              chosen: { name: 'Knoblauch', source: 'CATALOG', unit: 'g', untracked: false },
              flags,
            }),
          ],
        },
      };
      renderWithProviders(<ReviewImportScreen draft={flaggedDraft} onSaved={() => {}} onCancel={() => {}} />);

      expect(screen.getByTestId('row-uncertain-0')).toHaveTextContent(expected);
    });

    it('saves normally with markers on screen, and stores no provenance data', async () => {
      let captured: { ingredients: Array<Record<string, unknown>> } | null = null;
      server.use(
        http.post('/api/add-recipe', async ({ request }) => {
          captured = (await request.json()) as typeof captured;
          return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
        }),
      );

      const onSaved = vi.fn<() => void>();
      renderWithProviders(<ReviewImportScreen draft={gappedDraft} onSaved={onSaved} onCancel={() => {}} />);

      expect(screen.getByTestId('row-uncertain-1')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());

      const body = JSON.stringify(captured);
      expect(body).not.toMatch(/provenance|candidates|chosen|Kirschtomaten/);
      for (const ing of captured!.ingredients) {
        expect(ing).not.toHaveProperty('provenance');
      }
    });
  });

  describe('ingredient note', () => {
    it('renders a note subtitle on an unmatched draft row', () => {
      const draftWithUnmatchedNote: RecipeDraft = {
        name: 'X',
        yield: 1,
        steps: [],
        ingredients: [
          {
            matched: false,
            name: 'Yuzu-Schale',
            amount: 2,
            unit: 'g',
            note: 'fein abgerieben',
          },
        ],
      };
      renderWithProviders(<ReviewImportScreen draft={draftWithUnmatchedNote} onSaved={() => {}} onCancel={() => {}} />);
      const note = screen.getByTestId('unmatched-note-Yuzu-Schale');
      expect(note).toBeInTheDocument();
      expect(note).toHaveTextContent(/^fein abgerieben$/);
    });

    it('threads matched-row note through to the add-recipe payload on save', async () => {
      const draftWithMatchedNote: RecipeDraft = {
        name: 'Soup',
        yield: 1,
        steps: [],
        ingredients: [
          {
            matched: true,
            name: 'Ingwer',
            unit: 'g',
            macrosPerUnit: { calories: 0.8, protein: 0.018, carbs: 0.178, fat: 0.008 },
            amount: 5,
            unitOverridden: false,
            source: 'CATALOG',
            note: 'fein gehackt',
          },
        ],
      };
      let captured: { ingredients: Array<{ name: string; note?: string }> } | null = null;
      server.use(
        http.post('/api/add-recipe', async ({ request }) => {
          captured = (await request.json()) as typeof captured;
          return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
        }),
      );

      const onSaved = vi.fn<() => void>();
      renderWithProviders(<ReviewImportScreen draft={draftWithMatchedNote} onSaved={onSaved} onCancel={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(captured!.ingredients[0]!.note).toBe('fein gehackt');
    });

    it('clears the note when an unmatched row is resolved via in-sheet manual catalog match', async () => {
      const draftWithUnmatchedNote: RecipeDraft = {
        name: 'X',
        yield: 1,
        steps: [],
        ingredients: [
          {
            matched: false,
            name: 'Yuzu-Schale',
            amount: 2,
            unit: 'g',
            note: 'fein abgerieben',
          },
        ],
      };
      let captured: { ingredients: Array<{ name: string; note?: string; amount: number }> } | null = null;
      server.use(
        // No AI proposal for this item → the sheet falls back to manual catalog search.
        http.post('/api/propose-ingredient-resolutions', () =>
          HttpResponse.json({ proposals: [{ verdict: 'skip', reason: 'x' }] }),
        ),
        http.get('/api/search-ingredients', () =>
          HttpResponse.json([
            {
              id: 'zitronen-schale',
              source: 'CATALOG',
              name: 'Zitronenschale',
              unit: 'g',
              macrosPerUnit: { calories: 0.5, protein: 0.015, carbs: 0.16, fat: 0.003 },
            },
          ]),
        ),
        http.post('/api/add-recipe', async ({ request }) => {
          captured = (await request.json()) as typeof captured;
          return HttpResponse.json({ id: 'new-1', ...captured, createdAt: '', updatedAt: '' }, { status: 201 });
        }),
      );

      const onSaved = vi.fn<() => void>();
      renderWithProviders(<ReviewImportScreen draft={draftWithUnmatchedNote} onSaved={onSaved} onCancel={() => {}} />);

      // Wait for the prefetched proposal to land, then open the resolve sheet.
      await userEvent.click(await screen.findByLabelText(/yuzu-schale.*zuordnen/i));
      // Skip verdict → fall back to the in-sheet catalog search.
      await userEvent.click(screen.getByRole('button', { name: /^katalog$/i }));
      await userEvent.type(screen.getByRole('searchbox'), 'zitr');
      const result = await screen.findByRole('button', { name: /zitronenschale/i });
      await userEvent.click(result);

      await userEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(captured!.ingredients[0]!.name).toBe('Zitronenschale');
      expect(captured!.ingredients[0]!.amount).toBe(2); // original amount preserved
      expect(captured!.ingredients[0]).not.toHaveProperty('note');
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

  it('surfaces the source photos for review when photos are provided', () => {
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, writable: true });
    const file = new File([new Uint8Array(10)], 'recipe.jpg', { type: 'image/jpeg' });
    const photos = [{ id: 'p1', file, mediaType: 'image/jpeg' as const, previewUrl: 'blob:stale', sizeBytes: 10 }];

    renderWithProviders(<ReviewImportScreen draft={draft} photos={photos} onSaved={() => {}} onCancel={() => {}} />);

    expect(screen.getByTestId('source-photo-0')).toBeInTheDocument();
    // the unmatched panel still renders alongside the photos
    expect(screen.getByText(/1 zutat ohne treffer/i)).toBeInTheDocument();
  });
});
