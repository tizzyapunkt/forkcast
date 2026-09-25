import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { makeDailyLog, makeWeekLog, makeLogEntry, makeGoal } from '../../test/msw/fixtures';
import { addDays } from '../../domain/date';
import { PlannerScreen } from './planner-screen';
import type { DailyLog } from '../../domain/meal-log';

// Pin "today" to Wednesday 2026-06-10 so the active week is Mon 2026-06-08 .. Sun 2026-06-14.
vi.mock('../../domain/date', async (orig) => {
  const actual = await orig<typeof import('../../domain/date')>();
  return { ...actual, today: () => '2026-06-10' };
});

const zero = { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false };

function weekWithWednesday(): DailyLog[] {
  const wed = makeDailyLog({
    date: '2026-06-10',
    slots: [
      {
        slot: 'breakfast',
        entries: [
          makeLogEntry({
            date: '2026-06-10',
            slot: 'breakfast',
            ingredient: { type: 'quick', label: 'Haferbrei', calories: 1846, protein: 60, carbs: 200, fat: 50 },
          }),
        ],
        totals: { calories: 1846, protein: 60, carbs: 200, fat: 50, macrosPartial: false },
      },
      { slot: 'lunch', entries: [], totals: zero },
      { slot: 'dinner', entries: [], totals: zero },
      { slot: 'snack', entries: [], totals: zero },
    ],
    totals: { calories: 1846, protein: 60, carbs: 200, fat: 50, macrosPartial: false },
  });
  return Array.from({ length: 7 }, (_, i) => (i === 2 ? wed : makeDailyLog({ date: addDays('2026-06-08', i) })));
}

function useWeek(days: DailyLog[]) {
  server.use(
    http.get('/api/week-log/:startDate', () => HttpResponse.json(makeWeekLog('2026-06-08', days))),
    http.get('/api/nutrition-goal', () => HttpResponse.json(makeGoal({ calories: 2000 }))),
  );
}

describe('PlannerScreen', () => {
  it('renders the active week as seven day sections with the current day expanded', async () => {
    useWeek(weekWithWednesday());
    renderWithProviders(<PlannerScreen />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: /ein-\/ausklappen/i })).toHaveLength(7));
    // Wednesday (today) is expanded → its slots are visible; collapsed days don't render slot labels.
    expect(screen.getByText('Frühstück')).toBeInTheDocument();
    expect(screen.getByText('Mittagessen')).toBeInTheDocument();
  });

  it('shows the week range and rollups inside the app header (avg per day + planned days)', async () => {
    useWeek(weekWithWednesday());
    renderWithProviders(<PlannerScreen />);

    expect(await screen.findByText('8.–14. Juni')).toBeInTheDocument();
    const avg = await screen.findByText(/Ø 264 kcal\/Tag/); // 1846 / 7
    expect(avg).toBeInTheDocument();
    expect(screen.getByText('1/7 Tage geplant')).toBeInTheDocument();
    // The rollups and the week stepper live INSIDE the indigo header, next to the "Wochenplan" title.
    const header = screen.getByRole('heading', { name: 'Wochenplan' }).closest('header');
    expect(header).not.toBeNull();
    expect(header).toContainElement(avg);
    expect(header).toContainElement(screen.getByText('8.–14. Juni'));
  });

  it('shows the day total against the goal and marks empty days "leer"', async () => {
    useWeek(weekWithWednesday());
    renderWithProviders(<PlannerScreen />);

    expect(await screen.findByText('1846 / 2000 kcal')).toBeInTheDocument();
    // Six empty days render the "leer" indicator.
    expect(screen.getAllByText('leer')).toHaveLength(6);
  });

  it('advances to the next week when the next-week control is used', async () => {
    useWeek(weekWithWednesday());
    renderWithProviders(<PlannerScreen />);

    await screen.findByText('8.–14. Juni');
    await userEvent.click(screen.getByRole('button', { name: /nächste woche/i }));
    expect(await screen.findByText('15.–21. Juni')).toBeInTheDocument();
  });

  it('opens the add-food sheet targeting the chosen day + slot when "+" is tapped', async () => {
    useWeek(weekWithWednesday());
    renderWithProviders(<PlannerScreen />);

    await screen.findByText('Frühstück');
    await userEvent.click(screen.getByRole('button', { name: /Zu Frühstück am 10\. Juni hinzufügen/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Zu Frühstück hinzufügen/i)).toBeInTheDocument();
  });

  it('copies a day to the next via a confirm step', async () => {
    let posted: { fromDate?: string; toDate?: string } | null = null;
    useWeek(weekWithWednesday());
    server.use(
      http.post('/api/copy-log-day', async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json([], { status: 201 });
      }),
    );
    renderWithProviders(<PlannerScreen />);

    await screen.findByText('Frühstück');
    // Wednesday is expanded; copy it to Thursday.
    await userEvent.click(screen.getByRole('button', { name: /^tag kopieren$/i }));
    expect(screen.getByText('Mittwoch kopieren')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Auf Donnerstag übertragen/i }));

    await waitFor(() => expect(posted).toEqual({ fromDate: '2026-06-10', toDate: '2026-06-11' }));
  });
});

describe('PlannerScreen — daily-log parity in slot bodies', () => {
  const bolognese = {
    id: 'rec-1',
    name: 'Bolognese',
    yield: 2,
    ingredients: [],
    steps: [],
    createdAt: '',
    updatedAt: '',
  };

  function fullEntry(id: string, name: string, amount: number, overrides = {}) {
    return makeLogEntry({
      id,
      date: '2026-06-10',
      slot: 'breakfast',
      ingredient: {
        type: 'full',
        name,
        unit: 'g',
        macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
        amount,
      },
      ...overrides,
    });
  }

  function weekWithEntries() {
    const entries = [
      fullEntry('ad-hoc-1', 'Haferflocken', 60),
      fullEntry('batch-a', 'Rindertatar', 100, { recipeId: 'rec-1', recipeBatchId: 'batch-1', recipePortions: 1 }),
      fullEntry('batch-b', 'Sojasauce', 50, { recipeId: 'rec-1', recipeBatchId: 'batch-1', recipePortions: 1 }),
    ];
    const wed = makeDailyLog({
      date: '2026-06-10',
      slots: [
        {
          slot: 'breakfast',
          entries,
          totals: { calories: 347, protein: 65, carbs: 0, fat: 8, macrosPartial: false },
        },
        { slot: 'lunch', entries: [], totals: zero },
        { slot: 'dinner', entries: [], totals: zero },
        { slot: 'snack', entries: [], totals: zero },
      ],
      totals: { calories: 347, protein: 65, carbs: 0, fat: 8, macrosPartial: false },
    });
    return Array.from({ length: 7 }, (_, i) => (i === 2 ? wed : makeDailyLog({ date: addDays('2026-06-08', i) })));
  }

  function useWeekWithRecipes(days: DailyLog[]) {
    useWeek(days);
    server.use(http.get('/api/recipes', () => HttpResponse.json([bolognese])));
  }

  it('renders entries with amount, kcal, and macro suffix exactly like the daily log', async () => {
    useWeekWithRecipes(weekWithEntries());
    renderWithProviders(<PlannerScreen />);

    expect(await screen.findByText('Haferflocken')).toBeInTheDocument();
    // Editable amount input with the entry's amount (not a name-only row).
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.some((i) => (i as HTMLInputElement).value === '60')).toBe(true);
    // kcal + the unified macro suffix for the 60 g entry: 99 kcal · 19 P · 0 KH · 2 F
    expect(screen.getByText(/99\s*kcal/)).toBeInTheDocument();
    expect(screen.getByText(/19 P · 0 KH · 2 F/)).toBeInTheDocument();
  });

  it('renders a recipe batch as a grouped card with banner, exactly like the daily log', async () => {
    useWeekWithRecipes(weekWithEntries());
    renderWithProviders(<PlannerScreen />);

    const group = await screen.findByTestId('recipe-batch-batch-1');
    expect(await within(group).findByText('Bolognese')).toBeInTheDocument();
    expect(within(group).getByText('1 Port.')).toBeInTheDocument();
    expect(within(group).getByText('Rindertatar')).toBeInTheDocument();
    expect(within(group).getByText('Sojasauce')).toBeInTheDocument();
  });

  it('persists an inline amount edit from the planner via the same PATCH flow the diary uses', async () => {
    let patched: Record<string, unknown> | undefined;
    useWeekWithRecipes(weekWithEntries());
    server.use(
      http.patch('/api/log-entry/:id', async ({ request, params }) => {
        patched = { id: params['id'], ...((await request.json()) as Record<string, unknown>) };
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<PlannerScreen />);

    await screen.findByText('Haferflocken');
    const input = screen
      .getAllByRole('textbox')
      .find((i) => (i as HTMLInputElement).value === '60') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '250');

    // Live recompute is immediate (413 kcal), the PATCH lands after the debounce.
    expect(await screen.findByText(/413\s*kcal/)).toBeInTheDocument();
    await waitFor(() => expect(patched).toMatchObject({ id: 'ad-hoc-1', type: 'full', amount: 250 }), {
      timeout: 2000,
    });
  });

  it('removes a recipe batch from a planner day via the group banner', async () => {
    let posted: Record<string, unknown> | undefined;
    useWeekWithRecipes(weekWithEntries());
    server.use(
      http.post('/api/remove-recipe-log', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ removed: 2 });
      }),
    );
    renderWithProviders(<PlannerScreen />);

    await userEvent.click(await screen.findByRole('button', { name: 'Rezept „Bolognese“ entfernen' }));

    await waitFor(() => expect(posted).toEqual({ recipeBatchId: 'batch-1', date: '2026-06-10' }));
  });
  it('replaces a batch ingredient from the planner and shows it inside the group with updated totals', async () => {
    let posted: Record<string, unknown> | undefined;
    let replaced = false;
    const before = weekWithEntries();
    const tofuEntry = fullEntry('batch-a', 'Tofu', 100, {
      recipeId: 'rec-1',
      recipeBatchId: 'batch-1',
      recipePortions: 1,
    });
    const after = before.map((day) =>
      day.date !== '2026-06-10'
        ? day
        : {
            ...day,
            slots: day.slots.map((slot) => ({
              ...slot,
              entries: slot.entries.map((e) => (e.id === 'batch-a' ? tofuEntry : e)),
            })),
            totals: { calories: 512, protein: 40, carbs: 0, fat: 8, macrosPartial: false },
          },
    );
    server.use(
      http.get('/api/week-log/:startDate', () =>
        HttpResponse.json(makeWeekLog('2026-06-08', replaced ? after : before)),
      ),
      http.get('/api/nutrition-goal', () => HttpResponse.json(makeGoal({ calories: 2000 }))),
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
      http.post('/api/replace-batch-ingredient', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        replaced = true;
        return HttpResponse.json(tofuEntry);
      }),
    );
    renderWithProviders(<PlannerScreen />);

    const group = await screen.findByTestId('recipe-batch-batch-1');
    expect(await within(group).findByRole('button', { name: 'Zutat zu „Bolognese“ hinzufügen' })).toBeInTheDocument();
    await userEvent.click(within(group).getByRole('button', { name: 'Zutat „Rindertatar“ ersetzen' }));
    await userEvent.type(await screen.findByPlaceholderText(/zutaten suchen/i), 'tofu');
    await userEvent.click(await screen.findByRole('button', { name: /^tofu/i }));
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() =>
      expect(posted).toMatchObject({ entryId: 'batch-a', ingredient: { name: 'Tofu', amount: 100 } }),
    );
    const refreshed = await screen.findByTestId('recipe-batch-batch-1');
    expect(await within(refreshed).findByText('Tofu')).toBeInTheDocument();
    expect(within(refreshed).queryByText('Rindertatar')).not.toBeInTheDocument();
    expect(await screen.findAllByText(/512/)).not.toHaveLength(0);
  });
  it('offers the cooked-portions control on a planner batch and shows the cooked value', async () => {
    let posted: Record<string, unknown> | undefined;
    const days = weekWithEntries().map((day) => ({
      ...day,
      slots: day.slots.map((slot) => ({
        ...slot,
        entries: slot.entries.map((e) => (e.recipeBatchId ? { ...e, cookedPortions: 2 } : e)),
      })),
    }));
    useWeekWithRecipes(days);
    server.use(
      http.post('/api/set-cooked-portions', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<PlannerScreen />);

    const group = await screen.findByTestId('recipe-batch-batch-1');
    expect(within(group).getByText('für 2 gekocht')).toBeInTheDocument();
    await userEvent.click(within(group).getByRole('button', { name: /gekochte portionen für/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Eine Portion mehr' }));
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    await waitFor(() => expect(posted).toEqual({ recipeBatchId: 'batch-1', date: '2026-06-10', cookedPortions: 3 }));
  });
});

describe('PlannerScreen — Einkaufsliste', () => {
  function serveGroceryLists() {
    const requested: string[] = [];
    server.use(
      http.get('/api/grocery-list/:startDate', ({ params }) => {
        requested.push(params['startDate'] as string);
        return HttpResponse.json({
          startDate: params['startDate'],
          items: [{ name: 'Reis', unit: 'g', amount: 300, untracked: false, dates: [params['startDate']] }],
          skippedQuickEntries: 0,
        });
      }),
    );
    return requested;
  }

  it('opens the grocery list for the week shown', async () => {
    useWeek(weekWithWednesday());
    const requested = serveGroceryLists();
    renderWithProviders(<PlannerScreen />);

    await userEvent.click(await screen.findByRole('button', { name: /einkaufsliste für/i }));

    const sheet = await screen.findByRole('dialog', { name: 'Einkaufsliste' });
    expect(await within(sheet).findByText('Reis')).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: /8\.–14\. Juni/ })).toBeInTheDocument();
    expect(requested).toEqual(['2026-06-08']);
  });

  it('follows week navigation', async () => {
    useWeek(weekWithWednesday());
    const requested = serveGroceryLists();
    renderWithProviders(<PlannerScreen />);

    await userEvent.click(await screen.findByRole('button', { name: 'Nächste Woche' }));
    await userEvent.click(await screen.findByRole('button', { name: /einkaufsliste für/i }));

    await screen.findByRole('dialog', { name: 'Einkaufsliste' });
    await waitFor(() => expect(requested).toEqual(['2026-06-15']));
  });

  it('starts fresh with every item checked when reopened', async () => {
    useWeek(weekWithWednesday());
    serveGroceryLists();
    renderWithProviders(<PlannerScreen />);

    await userEvent.click(await screen.findByRole('button', { name: /einkaufsliste für/i }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Reis einkaufen' }));
    expect(screen.getByRole('checkbox', { name: 'Reis einkaufen' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    await userEvent.click(screen.getByRole('button', { name: /einkaufsliste für/i }));

    expect(await screen.findByRole('checkbox', { name: 'Reis einkaufen' })).toBeChecked();
  });
});
