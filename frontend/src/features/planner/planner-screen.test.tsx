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
    const inputs = screen.getAllByRole('spinbutton');
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
      .getAllByRole('spinbutton')
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

    await waitFor(() => expect(posted).toEqual({ recipeBatchId: 'batch-1' }));
  });
});
