import { screen, waitFor } from '@testing-library/react';
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

  it('shows the week range and header rollups (avg per day + planned days)', async () => {
    useWeek(weekWithWednesday());
    renderWithProviders(<PlannerScreen />);

    expect(await screen.findByText('8.–14. Juni')).toBeInTheDocument();
    expect(await screen.findByText(/Ø 264 kcal\/Tag/)).toBeInTheDocument(); // 1846 / 7
    expect(screen.getByText('1/7 Tage geplant')).toBeInTheDocument();
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
