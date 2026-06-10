import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/msw/server';
import { App } from './app';
import { renderWithProviders } from './test/harness';
import { makeDailyLog, makeGoal } from './test/msw/fixtures';

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
});
