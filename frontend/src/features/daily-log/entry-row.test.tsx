import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { EntryRow } from './entry-row';
import type { LogEntry } from '../../domain/meal-log';

const sampleRecipe = {
  id: 'rec-1',
  name: 'Bolognese',
  yield: 4,
  ingredients: [
    {
      name: 'Beef',
      unit: 'g' as const,
      macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
      amount: 500,
    },
  ],
  steps: [],
  createdAt: '',
  updatedAt: '',
};

const recipeEntry: LogEntry = {
  id: 'e-1',
  date: '2026-04-28',
  slot: 'lunch',
  loggedAt: '2026-04-28T12:00:00.000Z',
  recipeId: 'rec-1',
  ingredient: {
    type: 'full',
    name: 'Beef',
    unit: 'g',
    macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
    amount: 250,
  },
};

const adhocEntry: LogEntry = {
  id: 'e-2',
  date: '2026-04-28',
  slot: 'snack',
  loggedAt: '2026-04-28T15:00:00.000Z',
  ingredient: { type: 'quick', label: 'Apple', calories: 80 },
};

describe('EntryRow recipe hint', () => {
  it('shows the recipe hint when entry.recipeId resolves to an existing recipe', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([sampleRecipe])));

    renderWithProviders(<EntryRow entry={recipeEntry} />);

    expect(await screen.findByTestId('recipe-hint')).toHaveTextContent(/from bolognese/i);
  });

  it('shows no hint when the recipe does not resolve (deleted)', async () => {
    let calls = 0;
    server.use(
      http.get('/api/recipes', () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<EntryRow entry={recipeEntry} />);

    await waitFor(() => expect(calls).toBe(1));
    expect(screen.queryByTestId('recipe-hint')).not.toBeInTheDocument();
  });

  it('shows no hint for ad-hoc entries', async () => {
    let calls = 0;
    server.use(
      http.get('/api/recipes', () => {
        calls += 1;
        return HttpResponse.json([sampleRecipe]);
      }),
    );

    renderWithProviders(<EntryRow entry={adhocEntry} />);

    await waitFor(() => expect(calls).toBe(1));
    expect(screen.queryByTestId('recipe-hint')).not.toBeInTheDocument();
  });
});
