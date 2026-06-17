import { fireEvent, screen, waitFor } from '@testing-library/react';
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

describe('EntryRow macros', () => {
  it('renders calories and macros for a full entry, computed from macrosPerUnit * amount', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([])));
    const entry: LogEntry = {
      id: 'e-m1',
      date: '2026-04-28',
      slot: 'lunch',
      loggedAt: '2026-04-28T12:00:00.000Z',
      ingredient: {
        type: 'full',
        name: 'Beef',
        unit: 'g',
        macrosPerUnit: { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 },
        amount: 200,
      },
    };

    renderWithProviders(<EntryRow entry={entry} />);

    expect(await screen.findByText(/500\s*kcal/i)).toBeInTheDocument();
    expect(screen.getByText(/52\s*P/i)).toBeInTheDocument();
    expect(screen.getByText(/0\s*KH/i)).toBeInTheDocument();
    expect(screen.getByText(/30\s*F/i)).toBeInTheDocument();
  });

  it('renders calories and macros for a quick entry that has all three macro fields', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([])));
    const entry: LogEntry = {
      id: 'e-m2',
      date: '2026-04-28',
      slot: 'snack',
      loggedAt: '2026-04-28T15:00:00.000Z',
      ingredient: { type: 'quick', label: 'Protein bar', calories: 250, protein: 20, carbs: 15, fat: 10 },
    };

    renderWithProviders(<EntryRow entry={entry} />);

    expect(await screen.findByText(/250\s*kcal/i)).toBeInTheDocument();
    expect(screen.getByText(/20\s*P/i)).toBeInTheDocument();
    expect(screen.getByText(/15\s*KH/i)).toBeInTheDocument();
    expect(screen.getByText(/10\s*F/i)).toBeInTheDocument();
  });

  it('renders calories only for a quick entry with no macro fields', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([])));
    const entry: LogEntry = {
      id: 'e-m3',
      date: '2026-04-28',
      slot: 'snack',
      loggedAt: '2026-04-28T15:00:00.000Z',
      ingredient: { type: 'quick', label: 'Apple', calories: 80 },
    };

    renderWithProviders(<EntryRow entry={entry} />);

    expect(await screen.findByText(/80\s*kcal/i)).toBeInTheDocument();
    expect(screen.queryByText(/g\s*P\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/g\s*K\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/g\s*F\b/i)).not.toBeInTheDocument();
  });

  it('updates calories and macros live when the inline amount input changes (before the PATCH lands)', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([])));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const entry: LogEntry = {
        id: 'e-live',
        date: '2026-04-28',
        slot: 'lunch',
        loggedAt: '2026-04-28T12:00:00.000Z',
        ingredient: {
          type: 'full',
          name: 'Chicken breast',
          unit: 'g',
          macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
          amount: 100,
        },
      };

      renderWithProviders(<EntryRow entry={entry} />);

      expect(await screen.findByText(/165\s*kcal/i)).toBeInTheDocument();
      expect(screen.getByText(/31\s*P/i)).toBeInTheDocument();

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '250' } });

      // No timer advancement → no PATCH yet, but the row must reflect the typed amount.
      expect(await screen.findByText(/413\s*kcal/i)).toBeInTheDocument();
      expect(screen.getByText(/78\s*P/i)).toBeInTheDocument();
      expect(screen.getByText(/9\s*F/i)).toBeInTheDocument();
      expect(screen.queryByText(/165\s*kcal/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders calories only for a quick entry with partial macros (no zero fabrication)', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([])));
    const entry: LogEntry = {
      id: 'e-m4',
      date: '2026-04-28',
      slot: 'snack',
      loggedAt: '2026-04-28T15:00:00.000Z',
      ingredient: { type: 'quick', label: 'Mystery snack', calories: 80, protein: 5 },
    };

    renderWithProviders(<EntryRow entry={entry} />);

    expect(await screen.findByText(/80\s*kcal/i)).toBeInTheDocument();
    expect(screen.queryByText(/g\s*P\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/g\s*K\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/g\s*F\b/i)).not.toBeInTheDocument();
  });
});

describe('EntryRow recipe hint', () => {
  it('shows the recipe hint when entry.recipeId resolves to an existing recipe', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([sampleRecipe])));

    renderWithProviders(<EntryRow entry={recipeEntry} />);

    expect(await screen.findByTestId('recipe-hint')).toHaveTextContent(/aus bolognese/i);
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
