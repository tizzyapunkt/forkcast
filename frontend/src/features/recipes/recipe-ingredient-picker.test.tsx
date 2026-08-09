import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { RecipeIngredientPicker } from './recipe-ingredient-picker';
import type { RecipeIngredient, SearchCandidateProvenance } from '../../domain/recipes';
import type { IngredientSearchResult } from '../../domain/ingredient-search';

function PickerHarness({ onPicked }: { onPicked: (ing: RecipeIngredient) => void }) {
  const [open, setOpen] = useState(true);
  return <RecipeIngredientPicker open={open} onClose={() => setOpen(false)} onPicked={onPicked} />;
}

function ReplaceHarness({
  candidates,
  onPickResult,
}: {
  candidates?: readonly SearchCandidateProvenance[];
  onPickResult: (result: IngredientSearchResult) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <RecipeIngredientPicker
      open={open}
      mode="replace"
      candidates={candidates}
      onClose={() => setOpen(false)}
      onPicked={vi.fn<(ing: RecipeIngredient) => void>()}
      onPickResult={onPickResult}
    />
  );
}

describe('RecipeIngredientPicker — overlay portal', () => {
  // The picker is rendered deep inside RecipeForm's subtree, but the scroll lock
  // freezes `#root` with `position: fixed`. On iOS a fixed ancestor becomes the
  // containing block for fixed descendants, so the drawer must portal OUT of the
  // app shell (into <body>) to stay anchored to the viewport. Guard that here.
  it('renders the dialog into <body>, not inside the host subtree', () => {
    const { container } = renderWithProviders(<PickerHarness onPicked={vi.fn<(ing: RecipeIngredient) => void>()} />);

    const dialog = screen.getByRole('dialog');
    expect(container).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
  });

  it('does not render anything into the host subtree when closed', () => {
    function ClosedHarness() {
      return (
        <RecipeIngredientPicker
          open={false}
          onClose={vi.fn<() => void>()}
          onPicked={vi.fn<(ing: RecipeIngredient) => void>()}
        />
      );
    }
    renderWithProviders(<ClosedHarness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('RecipeIngredientPicker — untracked propagation', () => {
  it('picking a FOODS-untracked result yields a row with untracked: true', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'salz',
            source: 'CATALOG',
            name: 'Salz',
            unit: 'g',
            macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            untracked: true,
          },
        ]),
      ),
    );

    const onPicked = vi.fn<(ing: RecipeIngredient) => void>();
    const user = userEvent.setup();
    renderWithProviders(<PickerHarness onPicked={onPicked} />);

    await user.type(screen.getByRole('searchbox'), 'salz');
    const resultButton = await screen.findByRole('button', { name: /^salz/i });
    await user.click(resultButton);

    const amountInput = await screen.findByLabelText(/menge pro rezept/i);
    await user.type(amountInput, '5');
    await user.click(screen.getByRole('button', { name: /^hinzufügen$/i }));

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    expect(onPicked).toHaveBeenCalledWith({
      name: 'Salz',
      unit: 'g',
      macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      amount: 5,
      untracked: true,
    });
  });

  it('picking a tracked FOODS result yields a row without untracked', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'huehnchenbrust',
            source: 'CATALOG',
            name: 'Hähnchenbrust',
            unit: 'g',
            macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.04 },
          },
        ]),
      ),
    );

    const onPicked = vi.fn<(ing: RecipeIngredient) => void>();
    const user = userEvent.setup();
    renderWithProviders(<PickerHarness onPicked={onPicked} />);

    await user.type(screen.getByRole('searchbox'), 'huh');
    const resultButton = await screen.findByRole('button', { name: /hähnchenbrust/i });
    await user.click(resultButton);

    const amountInput = await screen.findByLabelText(/menge pro rezept/i);
    await user.type(amountInput, '200');
    await user.click(screen.getByRole('button', { name: /^hinzufügen$/i }));

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    const payload = onPicked.mock.calls[0]?.[0];
    expect(payload?.name).toBe('Hähnchenbrust');
    expect(payload?.amount).toBe(200);
    expect('untracked' in (payload ?? {})).toBe(false);
  });

  it('accepts a comma-delimited decimal amount (German locale) and adds the parsed value', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'olivenoel',
            source: 'CATALOG',
            name: 'Olivenöl',
            unit: 'ml',
            macrosPerUnit: { calories: 8.84, protein: 0, carbs: 0, fat: 1 },
          },
        ]),
      ),
    );

    const onPicked = vi.fn<(ing: RecipeIngredient) => void>();
    const user = userEvent.setup();
    renderWithProviders(<PickerHarness onPicked={onPicked} />);

    await user.type(screen.getByRole('searchbox'), 'oliven');
    const resultButton = await screen.findByRole('button', { name: /olivenöl/i });
    await user.click(resultButton);

    const amountInput = await screen.findByLabelText(/menge pro rezept/i);
    await user.type(amountInput, '0,25');
    await user.click(screen.getByRole('button', { name: /^hinzufügen$/i }));

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    expect(onPicked.mock.calls[0]?.[0]?.amount).toBe(0.25);
  });

  it('picking an OFF result yields a row without untracked even if the search response has the field', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: '0123456789012',
            source: 'OFF',
            name: 'Some product',
            unit: 'g',
            macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
          },
        ]),
      ),
    );

    const onPicked = vi.fn<(ing: RecipeIngredient) => void>();
    const user = userEvent.setup();
    renderWithProviders(<PickerHarness onPicked={onPicked} />);

    await user.type(screen.getByRole('searchbox'), 'product');
    const resultButton = await screen.findByRole('button', { name: /some product/i });
    await user.click(resultButton);

    const amountInput = await screen.findByLabelText(/menge pro rezept/i);
    await user.type(amountInput, '100');
    await user.click(screen.getByRole('button', { name: /^hinzufügen$/i }));

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    const payload = onPicked.mock.calls[0]?.[0];
    expect('untracked' in (payload ?? {})).toBe(false);
  });
});

describe('RecipeIngredientPicker — import candidates in replace mode', () => {
  const candidates: SearchCandidateProvenance[] = [
    { name: 'Tomatenmark', source: 'CATALOG', unit: 'g', untracked: false },
    { name: 'Kirschtomaten', source: 'CATALOG', unit: 'g', untracked: false },
    { name: 'Tomaten, getrocknet', source: 'SCAN', unit: 'g', untracked: false },
  ];

  it('lists the candidates in rank order above the search input before any query is typed', () => {
    renderWithProviders(
      <ReplaceHarness candidates={candidates} onPickResult={vi.fn<(r: IngredientSearchResult) => void>()} />,
    );

    const section = screen.getByTestId('picker-candidates');
    expect(section).toHaveTextContent(/Beim Import gefunden/i);
    expect(screen.getByTestId('picker-candidate-0')).toHaveTextContent('Tomatenmark');
    expect(screen.getByTestId('picker-candidate-1')).toHaveTextContent('Kirschtomaten');
    expect(screen.getByTestId('picker-candidate-2')).toHaveTextContent('Tomaten, getrocknet');
    // Each option names its source, so a SCAN entry is distinguishable from a catalog one.
    expect(screen.getByLabelText(/Tomaten, getrocknet aus SCAN übernehmen/i)).toBeInTheDocument();
    // Rendered ahead of the search input in document order.
    expect(section.compareDocumentPosition(screen.getByRole('searchbox')) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('resolves a tapped candidate to a real search result by exact name and applies it', async () => {
    let requestedUrl = '';
    server.use(
      http.get('/api/search-ingredients', ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json([
          {
            id: 'kirschtomaten-lang',
            source: 'CATALOG',
            name: 'Kirschtomaten, eingelegt',
            unit: 'g',
            macrosPerUnit: { calories: 0.5, protein: 0.01, carbs: 0.06, fat: 0.02 },
          },
          {
            id: 'kirschtomaten',
            source: 'CATALOG',
            name: 'Kirschtomaten',
            unit: 'g',
            macrosPerUnit: { calories: 0.18, protein: 0.009, carbs: 0.039, fat: 0.002 },
          },
        ]);
      }),
    );

    const onPickResult = vi.fn<(r: IngredientSearchResult) => void>();
    renderWithProviders(<ReplaceHarness candidates={candidates} onPickResult={onPickResult} />);

    await userEvent.click(screen.getByTestId('picker-candidate-1'));

    await waitFor(() => expect(onPickResult).toHaveBeenCalledTimes(1));
    // Exact name wins over the fuzzy first result, and the lookup is scoped to the candidate's source.
    expect(onPickResult.mock.calls[0]?.[0]?.name).toBe('Kirschtomaten');
    expect(onPickResult.mock.calls[0]?.[0]?.macrosPerUnit.calories).toBe(0.18);
    expect(requestedUrl).toContain('sources=catalog');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('falls back to search with a notice when the candidate no longer resolves', async () => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([])));

    const onPickResult = vi.fn<(r: IngredientSearchResult) => void>();
    renderWithProviders(<ReplaceHarness candidates={candidates} onPickResult={onPickResult} />);

    await userEvent.click(screen.getByTestId('picker-candidate-0'));

    expect(await screen.findByRole('status')).toHaveTextContent(/Tomatenmark.*nicht mehr im Katalog/i);
    expect(onPickResult).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('renders no candidate section for an empty candidate list, leaving search unchanged', async () => {
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

    const onPickResult = vi.fn<(r: IngredientSearchResult) => void>();
    renderWithProviders(<ReplaceHarness candidates={[]} onPickResult={onPickResult} />);

    expect(screen.queryByTestId('picker-candidates')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox'), 'schal');
    await userEvent.click(await screen.findByRole('button', { name: /schalotte/i }));

    await waitFor(() => expect(onPickResult).toHaveBeenCalledTimes(1));
    expect(onPickResult.mock.calls[0]?.[0]?.name).toBe('Schalotte');
  });

  it('renders no candidate section for a row that carries no provenance', () => {
    renderWithProviders(<ReplaceHarness onPickResult={vi.fn<(r: IngredientSearchResult) => void>()} />);

    expect(screen.queryByTestId('picker-candidates')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });
});
