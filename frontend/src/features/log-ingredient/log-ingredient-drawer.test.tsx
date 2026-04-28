import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { makeDailyLog } from '../../test/msw/fixtures';
import { SlotCard } from '../daily-log/slot-card';
import type { SlotSummary, RecentlyUsedIngredient } from '../../domain/meal-log';

function makeEmptySlot(slot: SlotSummary['slot']): SlotSummary {
  return { slot, entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } };
}

async function openDrawer() {
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  return screen.findByRole('dialog');
}

const oats: RecentlyUsedIngredient = {
  name: 'Oats',
  unit: 'g',
  macrosPerUnit: { calories: 3.89, protein: 0.17, carbs: 0.66, fat: 0.07 },
  lastUsedAt: '2026-04-22T08:00:00.000Z',
};

describe('SlotCard Add button → drawer', () => {
  it('opens the log-ingredient drawer when Add is clicked', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: /quick/i }));
    await userEvent.type(screen.getByLabelText(/label/i), 'Steak');
    await userEvent.type(screen.getByLabelText(/calories/i), '500');
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));

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
    await userEvent.click(screen.getByRole('button', { name: /quick/i }));
    await userEvent.type(screen.getByLabelText(/label/i), 'Coffee');
    await userEvent.type(screen.getByLabelText(/calories/i), '5');
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));

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

    await userEvent.click(screen.getByRole('button', { name: /^recent$/i }));

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

    await userEvent.click(screen.getByRole('button', { name: /^recent$/i }));
    await screen.findByText('Oats');
    expect(calls).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^recent$/i }));
    expect(await screen.findByText('Oats')).toBeInTheDocument();

    expect(calls).toBe(1);
  });

  it('logs a full entry with the picked ingredient + typed amount when picking from Recent', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: /^recent$/i }));
    await userEvent.click(await screen.findByText('Oats'));

    await userEvent.type(screen.getByLabelText(/amount/i), '50');
    await userEvent.click(screen.getByRole('button', { name: /^log$/i }));

    await waitFor(() => expect(posted).toBeDefined());
    const ingredient = (posted as Record<string, unknown>)['ingredient'] as Record<string, unknown>;
    expect(ingredient).toMatchObject({
      type: 'full',
      name: 'Oats',
      unit: 'g',
      macrosPerUnit: oats.macrosPerUnit,
      amount: 50,
    });
  });

  it('returns to the Recent tab (not Search) when Back is pressed from confirm after a Recent pick', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])));

    renderWithProviders(<SlotCard summary={makeEmptySlot('lunch')} date="2026-04-21" />, {
      queryClient: createTestQueryClient(),
    });
    await openDrawer();

    await userEvent.click(screen.getByRole('button', { name: /^recent$/i }));
    await userEvent.click(await screen.findByText('Oats'));

    // Confirm step is showing
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^back$/i }));

    // Back on the Recent tab list, NOT the Search panel
    expect(await screen.findByText('Oats')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search ingredients/i)).not.toBeInTheDocument();
  });
});
