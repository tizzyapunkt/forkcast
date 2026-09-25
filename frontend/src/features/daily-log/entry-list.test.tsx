import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { EntryList } from './entry-list';
import type { LogEntry } from '../../domain/meal-log';

const bolognese = {
  id: 'rec-1',
  name: 'Bolognese',
  yield: 2,
  ingredients: [],
  steps: [],
  createdAt: '',
  updatedAt: '',
};

function fullEntry(id: string, name: string, overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
    date: '2026-06-11',
    slot: 'lunch',
    loggedAt: '2026-06-11T12:00:00.000Z',
    ingredient: {
      type: 'full',
      name,
      unit: 'g',
      macrosPerUnit: { calories: 2, protein: 0.2, carbs: 0, fat: 0.1 },
      amount: 100,
    },
    ...overrides,
  };
}

const batchOverrides = { recipeId: 'rec-1', recipeBatchId: 'batch-1', recipePortions: 1 };

describe('EntryList — recipe batch grouping', () => {
  it('groups batch entries into one card with banner (recipe name + portions) and keeps ad-hoc entries outside', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([bolognese])));
    const entries = [
      fullEntry('a', 'Rindertatar', batchOverrides),
      fullEntry('b', 'Sojasauce', batchOverrides),
      fullEntry('c', 'Apfel'),
    ];

    renderWithProviders(<EntryList entries={entries} />);

    const group = await screen.findByTestId('recipe-batch-batch-1');
    expect(await within(group).findByText('Bolognese')).toBeInTheDocument();
    expect(within(group).getByText('1 Port.')).toBeInTheDocument();
    expect(within(group).getByText('Rindertatar')).toBeInTheDocument();
    expect(within(group).getByText('Sojasauce')).toBeInTheDocument();
    // The ad-hoc entry renders outside the group card.
    expect(screen.getByText('Apfel')).toBeInTheDocument();
    expect(within(group).queryByText('Apfel')).not.toBeInTheDocument();
  });

  it('suppresses the per-row recipe hint on grouped member rows', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([bolognese])));
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', batchOverrides)]} />);

    await screen.findByText('Bolognese'); // banner is there…
    expect(screen.queryByTestId('recipe-hint')).not.toBeInTheDocument(); // …the per-row hint is not
  });

  it('keeps member rows individually editable and removable', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([bolognese])));
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', batchOverrides)]} />);

    const group = await screen.findByTestId('recipe-batch-batch-1');
    // Inline amount input (editable) and the per-entry remove affordance are present.
    expect(within(group).getByRole('textbox')).toHaveValue('100');
    expect(within(group).getByRole('button', { name: /eintrag entfernen/i })).toBeInTheDocument();
  });

  it('removes the whole batch via POST /remove-recipe-log from the banner', async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([bolognese])),
      http.post('/api/remove-recipe-log', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ removed: 2 });
      }),
    );
    renderWithProviders(
      <EntryList
        entries={[fullEntry('a', 'Rindertatar', batchOverrides), fullEntry('b', 'Sojasauce', batchOverrides)]}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Rezept „Bolognese“ entfernen' }));

    await waitFor(() => expect(posted).toEqual({ recipeBatchId: 'batch-1', date: '2026-06-11' }));
  });

  it('renders two logs of the same recipe as two distinct groups', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([bolognese])));
    const entries = [
      fullEntry('a', 'Rindertatar', batchOverrides),
      fullEntry('b', 'Rindertatar', { recipeId: 'rec-1', recipeBatchId: 'batch-2', recipePortions: 2 }),
    ];

    renderWithProviders(<EntryList entries={entries} />);

    expect(await screen.findByTestId('recipe-batch-batch-1')).toBeInTheDocument();
    const second = screen.getByTestId('recipe-batch-batch-2');
    expect(within(second).getByText('2 Port.')).toBeInTheDocument();
  });

  it('keeps the group with a generic fallback label when the recipe was deleted', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([]))); // recipe gone
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', batchOverrides)]} />);

    const group = await screen.findByTestId('recipe-batch-batch-1');
    await waitFor(() => expect(within(group).getByText('Rezept')).toBeInTheDocument());
    // The rows survive and stay editable.
    expect(within(group).getByText('Rindertatar')).toBeInTheDocument();
    expect(within(group).getByRole('textbox')).toBeInTheDocument();
  });

  it('renders legacy recipe-sourced entries (recipeId without batch metadata) ungrouped with the per-row hint', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([bolognese])));
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', { recipeId: 'rec-1' })]} />);

    expect(await screen.findByTestId('recipe-hint')).toHaveTextContent(/aus bolognese/i);
    expect(screen.queryByTestId('recipe-batch-batch-1')).not.toBeInTheDocument();
  });

  it('renders plain ad-hoc entries without grouping or hints', async () => {
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Apfel')]} />);

    expect(await screen.findByText('Apfel')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-hint')).not.toBeInTheDocument();
  });
});

describe('EntryList — replace and add inside a recipe batch', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([bolognese])),
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'tofu',
            source: 'CATALOG',
            name: 'Tofu',
            unit: 'g',
            macrosPerUnit: { calories: 1.2, protein: 0.12, carbs: 0.02, fat: 0.07 },
          },
        ]),
      ),
    );
  });

  it('offers replace on rows inside a batch only, and add on the banner', async () => {
    renderWithProviders(
      <EntryList
        entries={[
          fullEntry('a', 'Rindertatar', batchOverrides),
          fullEntry('b', 'Apfel'),
          fullEntry('c', 'Sojasauce', { recipeId: 'rec-1' }), // legacy, no batch
        ]}
      />,
    );

    const group = await screen.findByTestId('recipe-batch-batch-1');
    expect(within(group).getByRole('button', { name: 'Zutat „Rindertatar“ ersetzen' })).toBeInTheDocument();
    expect(await within(group).findByRole('button', { name: 'Zutat zu „Bolognese“ hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zutat „Apfel“ ersetzen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zutat „Sojasauce“ ersetzen' })).not.toBeInTheDocument();
  });

  it('replaces a batch row through the batch-targeted sheet', async () => {
    let posted: unknown;
    server.use(
      http.post('/api/replace-batch-ingredient', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', batchOverrides)]} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Zutat „Rindertatar“ ersetzen' }));
    expect(await screen.findByRole('heading', { name: 'Zutat ersetzen — Bolognese' })).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/zutaten suchen/i), 'tofu');
    await userEvent.click(await screen.findByRole('button', { name: /^tofu/i }));
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() => expect(posted).toMatchObject({ entryId: 'a', ingredient: { name: 'Tofu', amount: 100 } }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('adds an ingredient to the batch from the banner', async () => {
    let posted: unknown;
    server.use(
      http.post('/api/add-to-recipe-batch', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', batchOverrides)]} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Zutat zu „Bolognese“ hinzufügen' }));
    expect(await screen.findByRole('heading', { name: 'Zutat hinzufügen — Bolognese' })).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/zutaten suchen/i), 'tofu');
    await userEvent.click(await screen.findByRole('button', { name: /^tofu/i }));
    await userEvent.type(within(screen.getByRole('dialog')).getByLabelText(/menge/i), '150');
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() =>
      expect(posted).toMatchObject({
        recipeBatchId: 'batch-1',
        date: '2026-06-11',
        ingredient: { name: 'Tofu', amount: 150 },
      }),
    );
  });
});

describe('EntryList — cooked portions on a recipe batch', () => {
  beforeEach(() => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([bolognese])));
  });

  it('shows only the logged portions while cooked equals logged', async () => {
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', batchOverrides)]} />);

    const group = await screen.findByTestId('recipe-batch-batch-1');
    expect(within(group).getByText('1 Port.')).toBeInTheDocument();
    expect(within(group).queryByText(/gekocht/)).not.toBeInTheDocument();
  });

  it('shows the cooked portions when they differ from the logged ones', async () => {
    renderWithProviders(
      <EntryList entries={[fullEntry('a', 'Rindertatar', { ...batchOverrides, cookedPortions: 2 })]} />,
    );

    const group = await screen.findByTestId('recipe-batch-batch-1');
    expect(within(group).getByText('1 Port.')).toBeInTheDocument();
    expect(within(group).getByText('für 2 gekocht')).toBeInTheDocument();
  });

  it('raises the cooked portions from the banner and saves them for the batch and its date', async () => {
    let posted: unknown;
    server.use(
      http.post('/api/set-cooked-portions', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', batchOverrides)]} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Gekochte Portionen für „Bolognese“ ändern' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByLabelText('Gekochte Portionen')).toHaveTextContent('1');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Eine Portion mehr' }));
    expect(within(sheet).getByLabelText('Gekochte Portionen')).toHaveTextContent('2');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Übernehmen' }));

    await waitFor(() => expect(posted).toEqual({ recipeBatchId: 'batch-1', date: '2026-06-11', cookedPortions: 2 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not go below the logged portions', async () => {
    renderWithProviders(
      <EntryList
        entries={[fullEntry('a', 'Rindertatar', { ...batchOverrides, recipePortions: 2, cookedPortions: 3 })]}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Gekochte Portionen für „Bolognese“ ändern' }));
    const sheet = await screen.findByRole('dialog');
    const less = within(sheet).getByRole('button', { name: 'Eine Portion weniger' });
    await userEvent.click(less);

    expect(within(sheet).getByLabelText('Gekochte Portionen')).toHaveTextContent('2');
    expect(less).toBeDisabled();
  });

  it('closing without saving sends nothing', async () => {
    let calls = 0;
    server.use(
      http.post('/api/set-cooked-portions', () => {
        calls++;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<EntryList entries={[fullEntry('a', 'Rindertatar', batchOverrides)]} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Gekochte Portionen für „Bolognese“ ändern' }));
    const sheet = await screen.findByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Eine Portion mehr' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });
});
