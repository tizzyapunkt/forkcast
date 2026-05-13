import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { makeDailyLog, makeLogEntry } from '../../test/msw/fixtures';
import { DailyLogScreen } from './daily-log-screen';

function render(date = '2026-04-20') {
  renderWithProviders(<DailyLogScreen date={date} />);
}

describe('DailyLogScreen', () => {
  it('renders all 4 slot headings even when log is empty', async () => {
    render();
    for (const slot of ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack']) {
      expect(await screen.findByText(slot)).toBeInTheDocument();
    }
  });

  it('renders a quick entry row with label and calories', async () => {
    const entry = makeLogEntry({ slot: 'breakfast', ingredient: { type: 'quick', label: 'Oats', calories: 300 } });
    const log = makeDailyLog({
      slots: [
        {
          slot: 'breakfast',
          entries: [entry],
          totals: { calories: 300, protein: 0, carbs: 0, fat: 0, macrosPartial: true },
        },
        { slot: 'lunch', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
        { slot: 'dinner', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
        { slot: 'snack', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
      ],
      totals: { calories: 300, protein: 0, carbs: 0, fat: 0, macrosPartial: true },
    });
    server.use(http.get('/api/daily-log/:date', () => HttpResponse.json(log)));
    render();
    expect(await screen.findByText('Oats')).toBeInTheDocument();
    expect(screen.getAllByText('300 kcal').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a full entry row with name and amount', async () => {
    const entry = makeLogEntry({
      slot: 'lunch',
      ingredient: {
        type: 'full',
        name: 'Chicken breast',
        unit: 'g',
        macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
        amount: 200,
      },
    });
    const log = makeDailyLog({
      slots: [
        { slot: 'breakfast', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
        {
          slot: 'lunch',
          entries: [entry],
          totals: { calories: 330, protein: 62, carbs: 0, fat: 7.2, macrosPartial: false },
        },
        { slot: 'dinner', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
        { slot: 'snack', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
      ],
      totals: { calories: 330, protein: 62, carbs: 0, fat: 7.2, macrosPartial: false },
    });
    server.use(http.get('/api/daily-log/:date', () => HttpResponse.json(log)));
    render();
    expect(await screen.findByText('Chicken breast')).toBeInTheDocument();
  });

  it('shows slot macros next to kcal when a slot has entries with macros', async () => {
    const entry = makeLogEntry({
      slot: 'lunch',
      ingredient: {
        type: 'full',
        name: 'Chicken breast',
        unit: 'g',
        macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
        amount: 200,
      },
    });
    const log = makeDailyLog({
      slots: [
        { slot: 'breakfast', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
        {
          slot: 'lunch',
          entries: [entry],
          totals: { calories: 330, protein: 62, carbs: 0, fat: 7, macrosPartial: false },
        },
        { slot: 'dinner', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
        { slot: 'snack', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
      ],
      totals: { calories: 330, protein: 62, carbs: 0, fat: 7, macrosPartial: false },
    });
    server.use(http.get('/api/daily-log/:date', () => HttpResponse.json(log)));
    render();
    const lunchHeading = await screen.findByRole('heading', { name: 'Mittagessen' });
    const lunchSlot = lunchHeading.closest('section');
    expect(lunchSlot).not.toBeNull();
    expect(lunchSlot!.textContent ?? '').toMatch(/62\s*g\s*P/i);
    expect(lunchSlot!.textContent ?? '').toMatch(/7\s*g\s*F/i);
  });

  it('suppresses the slot macro line when totals.macrosPartial is true', async () => {
    const entry = makeLogEntry({
      slot: 'breakfast',
      ingredient: { type: 'quick', label: 'Coffee', calories: 5 },
    });
    const log = makeDailyLog({
      slots: [
        {
          slot: 'breakfast',
          entries: [entry],
          totals: { calories: 5, protein: 0, carbs: 0, fat: 0, macrosPartial: true },
        },
        { slot: 'lunch', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
        { slot: 'dinner', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
        { slot: 'snack', entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false } },
      ],
      totals: { calories: 5, protein: 0, carbs: 0, fat: 0, macrosPartial: true },
    });
    server.use(http.get('/api/daily-log/:date', () => HttpResponse.json(log)));
    render();

    expect(await screen.findByText('Coffee')).toBeInTheDocument();
    const breakfastHeading = screen.getByRole('heading', { name: 'Frühstück' });
    const breakfastSlot = breakfastHeading.closest('section');
    expect(breakfastSlot).not.toBeNull();
    expect(breakfastSlot!.textContent ?? '').not.toMatch(/g\s*P\b/i);
    expect(breakfastSlot!.textContent ?? '').not.toMatch(/g\s*K\b/i);
    expect(breakfastSlot!.textContent ?? '').not.toMatch(/g\s*F\b/i);
  });

  it('shows loading skeleton before data arrives', () => {
    render();
    expect(screen.getByTestId('daily-log-skeleton')).toBeInTheDocument();
  });

  it('shows error banner on fetch failure', async () => {
    server.use(
      http.get('/api/daily-log/:date', () => HttpResponse.json({ error: 'Server exploded' }, { status: 500 })),
    );
    render();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
