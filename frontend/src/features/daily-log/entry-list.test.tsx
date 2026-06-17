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

    await waitFor(() => expect(posted).toEqual({ recipeBatchId: 'batch-1' }));
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
