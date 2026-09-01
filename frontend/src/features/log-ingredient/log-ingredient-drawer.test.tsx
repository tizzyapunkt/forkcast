import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { makeDailyLog } from '../../test/msw/fixtures';
import { serveFavorites } from '../../test/msw/favorites';
import { SlotCard } from '../daily-log/slot-card';
import type { SlotSummary, RecentlyUsedIngredient } from '../../domain/meal-log';

function makeEmptySlot(slot: SlotSummary['slot']): SlotSummary {
  return { slot, entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } };
}

async function openDrawer() {
  await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
  return screen.findByRole('dialog');
}

const oats: RecentlyUsedIngredient = {
  name: 'Oats',
  unit: 'g',
  macrosPerUnit: { calories: 3.89, protein: 0.17, carbs: 0.66, fat: 0.07 },
  lastUsedAt: '2026-04-22T08:00:00.000Z',
  lastAmount: 80,
};

describe('SlotCard Add button → drawer', () => {
  it('opens the log-ingredient drawer when Hinzufügen is clicked', async () => {
    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    expect(await openDrawer()).toBeInTheDocument();
  });

  it('carries the slot into the submitted payload', async () => {
    let posted: unknown;
    server.use(
      http.post('/api/log-ingredient', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          { id: 'x', date: '2026-04-21', slot: 'dinner', ingredient: {}, loggedAt: '' },
          { status: 201 },
        );
      }),
    );
    renderWithProviders(<SlotCard summary={makeEmptySlot('dinner')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });

    await openDrawer();
    await userEvent.click(screen.getByRole('button', { name: /schnell/i }));
    await userEvent.type(screen.getByLabelText(/bezeichnung/i), 'Steak');
    await userEvent.type(screen.getByLabelText(/kalorien/i), '500');
    await userEvent.click(screen.getByRole('button', { name: /eintrag hinzufügen/i }));

    await waitFor(() => expect(posted).toBeDefined());
    expect((posted as Record<string, unknown>)['slot']).toBe('dinner');
  });

  it('closes the drawer and invalidates the daily log on success', async () => {
    server.use(
      http.post('/api/log-ingredient', () =>
        HttpResponse.json(
          {
            id: 'x',
            date: '2026-04-21',
            slot: 'breakfast',
            ingredient: { type: 'quick', label: 'x', calories: 1 },
            loggedAt: '',
          },
          { status: 201 },
        ),
      ),
      http.get('/api/daily-log/:date', () => HttpResponse.json(makeDailyLog())),
    );
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, { queryClient });

    await openDrawer();
    await userEvent.click(screen.getByRole('button', { name: /schnell/i }));
    await userEvent.type(screen.getByLabelText(/bezeichnung/i), 'Coffee');
    await userEvent.type(screen.getByLabelText(/kalorien/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /eintrag hinzufügen/i }));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['daily-log', '2026-04-21'] }));
  });
});

describe('Recent tab', () => {
  it('does not fire /recently-used-ingredients when drawer opens on Search tab', async () => {
    let calls = 0;
    server.use(
      http.get('/api/recently-used-ingredients', () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    // Give any pending fetches a chance to fire
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(0);
  });

  it('fires exactly one request when switching to the Recent tab and renders the list', async () => {
    let calls = 0;
    server.use(
      http.get('/api/recently-used-ingredients', () => {
        calls += 1;
        return HttpResponse.json([oats]);
      }),
    );

    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));

    expect(await screen.findByText('Oats')).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('does not refetch when switching away from Recent and back within the same session', async () => {
    let calls = 0;
    server.use(
      http.get('/api/recently-used-ingredients', () => {
        calls += 1;
        return HttpResponse.json([oats]);
      }),
    );

    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));
    await screen.findByText('Oats');
    expect(calls).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: /^suche$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));
    expect(await screen.findByText('Oats')).toBeInTheDocument();

    expect(calls).toBe(1);
  });

  it('pre-fills the confirm step with lastAmount when picking from Recent', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])));

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));
    await userEvent.click(await screen.findByText('Oats'));

    expect(screen.getByLabelText(/menge/i)).toHaveValue('80');
  });

  it('logs a full entry with the pre-filled lastAmount when picking from Recent and confirming unchanged', async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])),
      http.post('/api/log-ingredient', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'x', date: '2026-04-21', slot: 'lunch', ingredient: posted['ingredient'], loggedAt: '' },
          { status: 201 },
        );
      }),
      http.get('/api/daily-log/:date', () => HttpResponse.json(makeDailyLog())),
    );

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));
    await userEvent.click(await screen.findByText('Oats'));
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() => expect(posted).toBeDefined());
    const ingredient = (posted as Record<string, unknown>)['ingredient'] as Record<string, unknown>;
    expect(ingredient).toMatchObject({
      type: 'full',
      name: 'Oats',
      unit: 'g',
      macrosPerUnit: oats.macrosPerUnit,
      amount: 80,
    });
  });

  it('logs the edited amount when the user overrides the pre-filled value', async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])),
      http.post('/api/log-ingredient', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'x', date: '2026-04-21', slot: 'lunch', ingredient: posted['ingredient'], loggedAt: '' },
          { status: 201 },
        );
      }),
      http.get('/api/daily-log/:date', () => HttpResponse.json(makeDailyLog())),
    );

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));
    await userEvent.click(await screen.findByText('Oats'));

    const amountInput = screen.getByLabelText(/menge/i);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '50');
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() => expect(posted).toBeDefined());
    const ingredient = (posted as Record<string, unknown>)['ingredient'] as Record<string, unknown>;
    expect(ingredient['amount']).toBe(50);
  });

  it('does not pre-fill the amount when reaching confirm via the Search tab', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'foods-oats',
            source: 'CATALOG',
            name: 'Oats',
            unit: 'g',
            macrosPerUnit: { calories: 3.89, protein: 0.17, carbs: 0.66, fat: 0.07 },
          },
        ]),
      ),
    );

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.type(screen.getByPlaceholderText(/zutaten suchen/i), 'oats');
    await userEvent.click(await screen.findByText('Oats'));

    expect(screen.getByLabelText(/menge/i)).toHaveValue('');
  });

  it('hides the tab bar and shows a header back-arrow on the amount sub-step', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])));
    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();
    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));
    await userEvent.click(await screen.findByText('Oats'));

    // On the AmountStep: tabs are gone, header back-arrow present.
    expect(screen.queryByRole('button', { name: /^suche$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^rezepte$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^zurück$/i })).toBeInTheDocument();
    // Back restores the tab bar.
    await userEvent.click(screen.getByRole('button', { name: /^zurück$/i }));
    expect(screen.getByRole('button', { name: /^suche$/i })).toBeInTheDocument();
  });

  it('lets a quick-amount chip set the Menge on the amount sub-step', async () => {
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'foods-oats',
            source: 'CATALOG',
            name: 'Oats',
            unit: 'g',
            macrosPerUnit: { calories: 3.89, protein: 0.17, carbs: 0.66, fat: 0.07 },
          },
        ]),
      ),
    );
    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();
    await userEvent.type(screen.getByPlaceholderText(/zutaten suchen/i), 'oats');
    await userEvent.click(await screen.findByText('Oats'));

    await userEvent.click(screen.getByRole('button', { name: '150 g' }));
    expect(screen.getByLabelText(/menge/i)).toHaveValue('150');
  });

  it('returns to the Recent tab (not Search) when Back is pressed from confirm after a Recent pick', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])));

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));
    await userEvent.click(await screen.findByText('Oats'));

    // Confirm step is showing
    expect(screen.getByLabelText(/menge/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^zurück$/i }));

    // Back on the Recent tab list, NOT the Search panel
    expect(await screen.findByText('Oats')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/zutaten suchen/i)).not.toBeInTheDocument();
  });
});

describe('Recipes tab', () => {
  const sampleRecipe = {
    id: 'rec-1',
    name: 'Oats Bowl',
    yield: 1,
    ingredients: [
      {
        name: 'Oats',
        unit: 'g' as const,
        macrosPerUnit: { calories: 3.7, protein: 0.13, carbs: 0.66, fat: 0.07 },
        amount: 80,
      },
    ],
    steps: [],
    createdAt: '',
    updatedAt: '',
  };

  it('shows tabs in order Suche → Favoriten → Zuletzt → Rezepte → Schnell', async () => {
    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    const dialog = screen.getByRole('dialog');
    const tabs = dialog.querySelectorAll('button');
    const tabLabels = Array.from(tabs)
      .map((b) => b.textContent?.trim() ?? '')
      .filter((t) => ['Suche', 'Favoriten', 'Zuletzt', 'Rezepte', 'Schnell'].includes(t));
    expect(tabLabels).toEqual(['Suche', 'Favoriten', 'Zuletzt', 'Rezepte', 'Schnell']);
  });

  it('logs the recipe via POST /log-recipe with the chosen portions when picking from the Recipes tab', async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get('/api/recipes', () => HttpResponse.json([sampleRecipe])),
      http.post('/api/log-recipe', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([], { status: 201 });
      }),
      http.get('/api/daily-log/:date', () => HttpResponse.json(makeDailyLog())),
    );

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^rezepte$/i }));
    await userEvent.click(await screen.findByText('Oats Bowl'));

    const portionsInput = await screen.findByLabelText(/zu erfassende portionen/i);
    await userEvent.clear(portionsInput);
    await userEvent.type(portionsInput, '2');
    await userEvent.click(screen.getByRole('button', { name: /zutaten übernehmen/i }));

    await waitFor(() => expect(posted).toBeDefined());
    expect(posted).toMatchObject({
      recipeId: 'rec-1',
      portions: 2,
      date: '2026-04-21',
      slot: 'lunch',
    });
  });

  it('previews only tracked ingredients with scaled amounts and confirms with "Zutaten übernehmen"', async () => {
    const recipeWithSalt = {
      ...sampleRecipe,
      ingredients: [
        ...sampleRecipe.ingredients,
        {
          name: 'Salz',
          unit: 'g' as const,
          macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          amount: 5,
          untracked: true,
        },
      ],
    };
    server.use(http.get('/api/recipes', () => HttpResponse.json([recipeWithSalt])));

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^rezepte$/i }));
    await userEvent.click(await screen.findByText('Oats Bowl'));

    // The preview counts and lists only the tracked ingredient — Salz never appears,
    // because LogRecipe produces no entry for it.
    expect(await screen.findByText('Es wird 1 Zutat übernommen:')).toBeInTheDocument();
    expect(screen.getByText(/Oats — 80 g/)).toBeInTheDocument();
    expect(screen.queryByText(/Salz/)).not.toBeInTheDocument();
    expect(screen.getByText(/Jede Zutat lässt sich danach einzeln anpassen/)).toBeInTheDocument();

    // Raising the portions rescales the previewed amounts (yield 1 → 2 portions doubles).
    const portionsInput = screen.getByLabelText(/zu erfassende portionen/i);
    await userEvent.clear(portionsInput);
    await userEvent.type(portionsInput, '2');
    expect(await screen.findByText(/Oats — 160 g/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /zutaten übernehmen/i })).toBeInTheDocument();
  });

  it('Back from the recipe-confirm returns to the Recipes tab', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([sampleRecipe])));

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^rezepte$/i }));
    await userEvent.click(await screen.findByText('Oats Bowl'));
    await userEvent.click(screen.getByRole('button', { name: /^zurück$/i }));

    expect(await screen.findByText('Oats Bowl')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/rezepte filtern/i)).toBeInTheDocument();
  });
});

describe('Favoriten tab', () => {
  const skyr = {
    name: 'Skyr Natur',
    unit: 'g' as const,
    macrosPerUnit: { calories: 0.63, protein: 0.11, carbs: 0.04, fat: 0.002 },
    favoritedAt: '2026-01-01T08:00:00.000Z',
    lastAmount: 180,
    lastUsedAt: '2026-02-08T07:00:00.000Z',
  };

  it('opens on Search, not on Favoriten', async () => {
    serveFavorites([skyr]);
    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    expect(screen.getByPlaceholderText('Zutaten suchen…')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Favoriten filtern…')).not.toBeInTheDocument();
  });

  it('loads favorites on open so the star on Search rows is correct straight away', async () => {
    let calls = 0;
    server.use(
      http.get('/api/favorite-ingredients', () => {
        calls += 1;
        return HttpResponse.json([skyr]);
      }),
    );
    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await waitFor(() => expect(calls).toBe(1));
  });

  it('pre-fills the confirm step with the favorite last amount', async () => {
    serveFavorites([skyr]);
    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();
    await userEvent.click(screen.getByRole('button', { name: 'Favoriten' }));

    await userEvent.click(await screen.findByRole('button', { name: /^Skyr Natur/ }));

    expect(await screen.findByLabelText(/Menge/)).toHaveValue('180');
  });

  it('opens the confirm step empty for a favorite that has never been logged', async () => {
    serveFavorites([{ ...skyr, lastAmount: undefined, lastUsedAt: undefined }]);
    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();
    await userEvent.click(screen.getByRole('button', { name: 'Favoriten' }));

    await userEvent.click(await screen.findByRole('button', { name: /^Skyr Natur/ }));

    expect(await screen.findByLabelText(/Menge/)).toHaveValue('');
  });

  it('returns to the Favoriten tab (not Search) when Back is pressed from confirm', async () => {
    serveFavorites([skyr]);
    renderWithProviders(<SlotCard summary={makeEmptySlot('breakfast')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();
    await userEvent.click(screen.getByRole('button', { name: 'Favoriten' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Skyr Natur/ }));

    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));

    expect(await screen.findByPlaceholderText('Favoriten filtern…')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Zutaten suchen…')).not.toBeInTheDocument();
  });
});
