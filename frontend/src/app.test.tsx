import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/msw/server';
import { App } from './app';
import { renderWithProviders } from './test/harness';
import { makeDailyLog, makeGoal, makeLogEntry, makeWeekLog } from './test/msw/fixtures';

describe('App', () => {
  it('renders the app header', () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('heading', { name: /forkcast/i })).toBeInTheDocument();
  });

  it('header uses sticky positioning so it stays on screen while scrolling', () => {
    renderWithProviders(<App />);
    const header = screen.getByRole('heading', { name: /forkcast/i }).closest('header');
    expect(header).not.toBeNull();
    expect(header?.className).toMatch(/sticky/);
  });

  it('renders the bottom navigation with Tagebuch, Planen, Rezepte, and Einstellungen tabs', () => {
    renderWithProviders(<App />);
    const nav = screen.getByRole('navigation', { name: /Hauptnavigation/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tagebuch/i, current: 'page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Planen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rezepte/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Einstellungen/i })).toBeInTheDocument();
  });

  it('navigates to the weekly planner via the Planen tab', async () => {
    renderWithProviders(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Planen/i }));
    expect(await screen.findByText('Wochenplan')).toBeInTheDocument();
  });

  it('does not render a settings gear in the header', () => {
    renderWithProviders(<App />);
    const header = screen.getByRole('heading', { name: /forkcast/i }).closest('header');
    expect(header?.querySelector('button[aria-label="Einstellungen"]')).toBeNull();
  });

  it('shows the daily kcal/macro summary in the log view', async () => {
    server.use(
      http.get('/api/daily-log/:date', () =>
        HttpResponse.json(
          makeDailyLog({ totals: { calories: 1500, protein: 120, carbs: 150, fat: 50, macrosPartial: false } }),
        ),
      ),
      http.get('/api/nutrition-goal', () => HttpResponse.json(makeGoal({ calories: 2000 }))),
    );
    renderWithProviders(<App />);
    expect(await screen.findByText(/1500\s*\/\s*2000\s*kcal/i)).toBeInTheDocument();
    expect(screen.getByText('500 kcal offen')).toBeInTheDocument();
  });

  it('hides the bottom navigation inside a recipe sub-screen and restores it on back', async () => {
    server.use(http.get('/api/recipes', () => HttpResponse.json([])));
    renderWithProviders(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Rezepte/i }));
    // Nav is visible on the recipes list.
    expect(screen.getByRole('navigation', { name: /Hauptnavigation/i })).toBeInTheDocument();

    // Open the create editor — a recipe sub-screen.
    await userEvent.click(await screen.findByRole('button', { name: /neues rezept/i }));
    await waitFor(() => expect(screen.queryByRole('navigation', { name: /Hauptnavigation/i })).not.toBeInTheDocument());

    // The header back-arrow returns to the list and restores the nav.
    await userEvent.click(screen.getByRole('button', { name: /^zurück$/i }));
    expect(await screen.findByRole('navigation', { name: /Hauptnavigation/i })).toBeInTheDocument();
  });

  it('hides the daily summary when on the settings screen', async () => {
    server.use(
      http.get('/api/daily-log/:date', () =>
        HttpResponse.json(
          makeDailyLog({ totals: { calories: 1500, protein: 120, carbs: 150, fat: 50, macrosPartial: false } }),
        ),
      ),
      http.get('/api/nutrition-goal', () => HttpResponse.json(makeGoal({ calories: 2000 }))),
    );
    renderWithProviders(<App />);
    await screen.findByText(/1500\s*\/\s*2000\s*kcal/i);

    await userEvent.click(screen.getByRole('button', { name: /Einstellungen/i }));

    expect(screen.queryByText(/kcal offen/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  describe('screen headers — the header names where you are', () => {
    it('Tagebuch keeps the forkcast wordmark in the header', () => {
      renderWithProviders(<App />);
      const wordmark = screen.getByRole('heading', { name: 'forkcast' });
      expect(wordmark.closest('header')).not.toBeNull();
    });

    it('Rezepte names itself in the header with no duplicate body heading', async () => {
      server.use(http.get('/api/recipes', () => HttpResponse.json([])));
      renderWithProviders(<App />);
      await userEvent.click(screen.getByRole('button', { name: /Rezepte/i }));

      const headings = await screen.findAllByRole('heading', { name: 'Rezepte' });
      expect(headings).toHaveLength(1);
      expect(headings[0]!.closest('header')).not.toBeNull();
      expect(screen.queryByRole('heading', { name: 'forkcast' })).not.toBeInTheDocument();
    });

    it('Einstellungen names itself in the header with no duplicate body heading', async () => {
      renderWithProviders(<App />);
      await userEvent.click(screen.getByRole('button', { name: /Einstellungen/i }));

      const headings = await screen.findAllByRole('heading', { name: 'Einstellungen' });
      expect(headings).toHaveLength(1);
      expect(headings[0]!.closest('header')).not.toBeNull();
      // Body section headings (e.g. Ernährungsziel) are unaffected.
      expect(screen.getByRole('heading', { name: /ernährungsziel/i }).closest('header')).toBeNull();
    });

    it('Wochenplan names itself in the header with no duplicate body heading', async () => {
      renderWithProviders(<App />);
      await userEvent.click(screen.getByRole('button', { name: /Planen/i }));

      const headings = await screen.findAllByRole('heading', { name: 'Wochenplan' });
      expect(headings).toHaveLength(1);
      expect(headings[0]!.closest('header')).not.toBeNull();
    });
  });

  describe('cooking session in the URL', () => {
    const recipe = { id: 'pasta', name: 'Pasta', yield: 2, ingredients: [], steps: [], createdAt: '', updatedAt: '' };

    function serveWeek() {
      const ketchup = (date: string, batchId: string) =>
        makeLogEntry({
          id: batchId,
          date,
          slot: 'dinner',
          recipeId: 'pasta',
          recipeBatchId: batchId,
          recipePortions: 1,
          ingredient: {
            type: 'full',
            name: 'Ketchup',
            unit: 'ml',
            macrosPerUnit: { calories: 1, protein: 0, carbs: 0.25, fat: 0 },
            amount: 50,
          },
        });
      const days = makeWeekLog('2026-06-08').days.map((day) => {
        const entries =
          day.date === '2026-06-08'
            ? [ketchup(day.date, 'mo')]
            : day.date === '2026-06-10'
              ? [ketchup(day.date, 'mi')]
              : [];
        return { ...day, slots: day.slots.map((s) => (s.slot === 'dinner' ? { ...s, entries } : s)) };
      });
      server.use(
        http.get('/api/week-log/:startDate', ({ params }) =>
          HttpResponse.json(makeWeekLog(params['startDate'] as string, days)),
        ),
        http.get('/api/recipes/:id', () => HttpResponse.json(recipe)),
        http.get('/api/recipes', () => HttpResponse.json([recipe])),
      );
    }

    afterEach(() => window.history.replaceState(null, '', '/'));

    it('reopens the cooking view after a reload, with its meals and the people eating along', async () => {
      serveWeek();
      window.history.replaceState(null, '', '/?cook=pasta&week=2026-06-08&b=2026-06-10~mi&extra=2');

      renderWithProviders(<App />);

      expect(await screen.findByRole('heading', { name: 'Pasta' })).toBeInTheDocument();
      expect(await screen.findByText('1 geplant + 2 essen mit')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Menge von Ketchup ändern/ })).toHaveTextContent('150 ml');
      expect(screen.queryByRole('navigation', { name: /Hauptnavigation/i })).not.toBeInTheDocument();
    });

    it('returns to the planner week and clears the URL when leaving', async () => {
      serveWeek();
      window.history.replaceState(null, '', '/?cook=pasta&week=2026-06-08&extra=1');
      renderWithProviders(<App />);

      await userEvent.click(await screen.findByRole('button', { name: 'Zurück zum Planer' }));

      expect(await screen.findByRole('navigation', { name: /Hauptnavigation/i })).toBeInTheDocument();
      expect(window.location.search).toBe('');
      expect((await screen.findAllByText(/8\. Juni/)).length).toBeGreaterThan(0);
    });

    it('opens from the Kochen action on a planner banner', async () => {
      serveWeek();
      // Whatever day the planner opens on holds a Pasta batch.
      server.use(
        http.get('/api/week-log/:startDate', ({ params }) => {
          const week = makeWeekLog(params['startDate'] as string);
          return HttpResponse.json({
            ...week,
            days: week.days.map((day) => ({
              ...day,
              slots: day.slots.map((s) =>
                s.slot === 'dinner'
                  ? {
                      ...s,
                      entries: [
                        makeLogEntry({
                          id: `b-${day.date}`,
                          date: day.date,
                          slot: 'dinner',
                          recipeId: 'pasta',
                          recipeBatchId: `b-${day.date}`,
                          recipePortions: 1,
                        }),
                      ],
                    }
                  : s,
              ),
            })),
          });
        }),
      );
      renderWithProviders(<App />);

      await userEvent.click(screen.getByRole('button', { name: /Planen/i }));
      const [cook] = await screen.findAllByRole('button', { name: '„Pasta“ kochen' });
      await userEvent.click(cook!);

      expect(await screen.findByRole('button', { name: 'Zurück zum Planer' })).toBeInTheDocument();
      await waitFor(() => expect(window.location.search).toMatch(/^\?cook=pasta&week=/));
    });

    it('mirrors the default selection into the URL', async () => {
      serveWeek();
      window.history.replaceState(null, '', '/?cook=pasta&week=2026-06-08');
      renderWithProviders(<App />);

      await screen.findByText('2 geplant');

      await waitFor(() =>
        expect(window.location.search).toBe('?cook=pasta&week=2026-06-08&b=2026-06-08%7Emo%2C2026-06-10%7Emi'),
      );
    });
  });
});
