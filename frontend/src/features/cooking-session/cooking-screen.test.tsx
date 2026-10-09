import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { makeDailyLog, makeLogEntry, makeWeekLog } from '../../test/msw/fixtures';
import { addDays } from '../../domain/date';
import type { DailyLog, FullIngredientEntry, LogEntry } from '../../domain/meal-log';
import type { Recipe } from '../../domain/recipes';
import { CookingScreen } from './cooking-screen';
import type { CookingSession } from './cooking-url';

const WEEK = '2026-06-08'; // a past week: every batch is preselected
const KETCHUP = { calories: 1, protein: 0, carbs: 0.25, fat: 0 };
const PASTA = { calories: 3.6, protein: 0.12, carbs: 0.72, fat: 0.02 };

function food(name: string, amount: number, unit: 'g' | 'ml' = 'g', macros = PASTA): FullIngredientEntry {
  return { type: 'full', name, unit, macrosPerUnit: macros, amount };
}

function batchEntries(date: string, batchId: string, items: FullIngredientEntry[]): LogEntry[] {
  return items.map((ingredient, i) =>
    makeLogEntry({
      id: `${batchId}-${i}`,
      date,
      slot: 'dinner',
      recipeId: 'pasta',
      recipeBatchId: batchId,
      recipePortions: 1,
      ingredient,
    }),
  );
}

function weekWith(byDate: Record<string, LogEntry[]>): DailyLog[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(WEEK, i);
    const entries = byDate[date] ?? [];
    return makeDailyLog({
      date,
      slots: (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((slot) => ({
        slot,
        entries: entries.filter((e) => e.slot === slot),
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0, macrosPartial: false },
      })),
    });
  });
}

const recipe: Recipe = {
  id: 'pasta',
  name: 'Pasta mit Tomatensauce',
  yield: 2,
  ingredients: [
    { name: 'Spaghetti', unit: 'g', macrosPerUnit: PASTA, amount: 250 },
    { name: 'Ketchup', unit: 'ml', macrosPerUnit: KETCHUP, amount: 100, note: 'die ganze Flasche' },
    {
      name: 'Oregano',
      unit: 'g',
      macrosPerUnit: PASTA,
      amount: 2,
      untracked: true,
      displayQuantity: { amount: 1, unitLabel: 'TL' },
    },
  ],
  steps: ['Nudeln kochen.', 'Sauce rühren.'],
  createdAt: '',
  updatedAt: '',
};

const monday = batchEntries('2026-06-08', 'mo', [food('Spaghetti', 125), food('Ketchup', 50, 'ml', KETCHUP)]);
const wednesday = batchEntries('2026-06-10', 'mi', [food('Spaghetti', 125), food('Ketchup', 50, 'ml', KETCHUP)]);

function serve({ days = weekWith({ '2026-06-08': monday, '2026-06-10': wednesday }), withRecipe = true } = {}) {
  const posted: unknown[] = [];
  server.use(
    http.get('/api/week-log/:startDate', () => HttpResponse.json(makeWeekLog(WEEK, days))),
    http.get('/api/recipes/:id', () =>
      withRecipe ? HttpResponse.json(recipe) : HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get('/api/recipes', () => HttpResponse.json(withRecipe ? [recipe] : [])),
    http.post('/api/set-batch-ingredients', async ({ request }) => {
      posted.push(await request.json());
      return HttpResponse.json([]);
    }),
  );
  return posted;
}

function Harness({ initial, onChange }: { initial: CookingSession; onChange?: (s: CookingSession) => void }) {
  const [session, setSession] = useState(initial);
  return (
    <CookingScreen
      session={session}
      onSessionChange={(next) => {
        onChange?.(next);
        setSession(next);
      }}
      onBack={() => {}}
    />
  );
}

function renderScreen(extra = 2, onChange?: (s: CookingSession) => void) {
  return renderWithProviders(
    <Harness initial={{ recipeId: 'pasta', weekStart: WEEK, batches: null, extra }} onChange={onChange} />,
  );
}

const rowAmount = (name: string) => screen.getByRole('button', { name: new RegExp(`^Menge von ${name} ändern`) });

describe('CookingScreen', () => {
  it('shows the whole pot for the planned meals and the people eating along', async () => {
    serve();
    renderScreen();

    expect(await screen.findByRole('heading', { name: 'Pasta mit Tomatensauce' })).toBeInTheDocument();
    expect(screen.getAllByText('4 Portionen').length).toBeGreaterThan(0);
    expect(screen.getByText('2 geplant + 2 essen mit')).toBeInTheDocument();
    expect(screen.getByText('Mo, Mi')).toBeInTheDocument();
    expect(rowAmount('Ketchup')).toHaveTextContent('200 ml');
    expect(rowAmount('Spaghetti')).toHaveTextContent('500 g');
    expect(screen.getByText('die ganze Flasche')).toBeInTheDocument();
  });

  it('writes the default selection into the session once the week is loaded', async () => {
    serve();
    const onChange = vi.fn<(s: CookingSession) => void>();
    renderScreen(2, onChange);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ batches: ['2026-06-08~mo', '2026-06-10~mi'] })),
    );
  });

  it('shows macros per logged portion, which people eating along do not change', async () => {
    serve();
    renderScreen(0);

    const hero = await screen.findByRole('region', { name: 'Pro Portion' });
    // 125 g Spaghetti × 3.6 + 50 ml Ketchup × 1
    expect(within(hero).getByText('500')).toBeInTheDocument();
  });

  it('recomputes the pot when a meal is deselected or someone eats along', async () => {
    serve();
    renderScreen(0);

    await userEvent.click(await screen.findByRole('button', { name: /Anpassen/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Mo · Abendessen/ }));
    expect(rowAmount('Ketchup')).toHaveTextContent('50 ml');

    await userEvent.click(screen.getByRole('button', { name: 'Eine Portion mehr' }));
    expect(rowAmount('Ketchup')).toHaveTextContent('100 ml');
  });

  it('keeps the last selected meal selected', async () => {
    serve({ days: weekWith({ '2026-06-10': wednesday }) });
    renderScreen(0);

    await userEvent.click(await screen.findByRole('button', { name: /Anpassen/ }));
    const only = screen.getByRole('button', { name: /^Mi · Abendessen/ });
    await userEvent.click(only);

    expect(only).toHaveAttribute('aria-pressed', 'true');
  });

  it('lists untracked ingredients scaled to the pot and the steps as written', async () => {
    serve();
    renderScreen();

    const spices = await screen.findByRole('region', { name: 'Gewürze & Kleinkram' });
    expect(within(spices).getByText('2 TL')).toBeInTheDocument();
    expect(within(spices).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Sauce rühren.')).toBeInTheDocument();
    expect(screen.getByText('Mengen im Text gelten fürs Originalrezept (2 Portionen).')).toBeInTheDocument();
  });

  it('writes a new pot amount by portion to the selected meals, and undoes it', async () => {
    const posted = serve();
    renderScreen();

    await userEvent.click(await screen.findByRole('button', { name: /^Menge von Ketchup ändern/ }));
    const input = screen.getByLabelText('Menge von Ketchup für den Topf');
    await userEvent.clear(input);
    await userEvent.type(input, '400{Enter}');

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({
      changes: [
        { recipeBatchId: 'mo', date: '2026-06-08', remove: [], set: [food('Ketchup', 100, 'ml', KETCHUP)] },
        { recipeBatchId: 'mi', date: '2026-06-10', remove: [], set: [food('Ketchup', 100, 'ml', KETCHUP)] },
      ],
    });
    expect(await screen.findByText('vorher 200 ml')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ketchup zurücksetzen' }));

    await waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1]).toEqual({
      changes: [
        { recipeBatchId: 'mo', date: '2026-06-08', remove: [], set: [food('Ketchup', 50, 'ml', KETCHUP)] },
        { recipeBatchId: 'mi', date: '2026-06-10', remove: [], set: [food('Ketchup', 50, 'ml', KETCHUP)] },
      ],
    });
    await waitFor(() => expect(screen.queryByText('vorher 200 ml')).not.toBeInTheDocument());
  });

  it('sends nothing when an edit is cancelled with Escape', async () => {
    const posted = serve();
    renderScreen();

    await userEvent.click(await screen.findByRole('button', { name: /^Menge von Ketchup ändern/ }));
    await userEvent.type(screen.getByLabelText('Menge von Ketchup für den Topf'), '9{Escape}');

    expect(rowAmount('Ketchup')).toHaveTextContent('200 ml');
    expect(posted).toHaveLength(0);
  });

  it('swaps an ingredient, prefilled with the pot amount when the unit matches', async () => {
    const posted = serve();
    server.use(
      http.get('/api/search-ingredients', () =>
        HttpResponse.json([
          {
            id: 'passata',
            source: 'CATALOG',
            name: 'Passata',
            unit: 'ml',
            macrosPerUnit: { calories: 0.35, protein: 0.01, carbs: 0.06, fat: 0 },
          },
        ]),
      ),
      // After the write the week holds Passata instead of Ketchup.
      http.post('/api/set-batch-ingredients', async ({ request }) => {
        posted.push(await request.json());
        const passata = food('Passata', 50, 'ml', { calories: 0.35, protein: 0.01, carbs: 0.06, fat: 0 });
        const swapped = weekWith({
          '2026-06-08': batchEntries('2026-06-08', 'mo', [food('Spaghetti', 125), passata]),
          '2026-06-10': batchEntries('2026-06-10', 'mi', [food('Spaghetti', 125), passata]),
        });
        server.use(http.get('/api/week-log/:startDate', () => HttpResponse.json(makeWeekLog(WEEK, swapped))));
        return HttpResponse.json([]);
      }),
    );
    renderScreen();

    await userEvent.click(await screen.findByRole('button', { name: 'Mehr zu Ketchup' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tauschen' }));
    await userEvent.type(await screen.findByPlaceholderText(/zutaten suchen/i), 'passata');
    await userEvent.click(await screen.findByRole('button', { name: /^passata/i }));

    expect(screen.getByText('Gleiche Menge wie Ketchup vorbefüllt.')).toBeInTheDocument();
    expect(screen.getByText(/^35 kcal/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Menge für den ganzen Topf/ })).toHaveValue('200');
    await userEvent.click(screen.getByRole('button', { name: 'Tauschen' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      changes: [
        { recipeBatchId: 'mo', remove: [{ name: 'Ketchup', unit: 'ml' }], set: [{ name: 'Passata', amount: 50 }] },
        { recipeBatchId: 'mi', remove: [{ name: 'Ketchup', unit: 'ml' }], set: [{ name: 'Passata', amount: 50 }] },
      ],
    });
    expect(await screen.findByText('vorher Ketchup 200 ml')).toBeInTheDocument();
  });

  it('leaves an ingredient out of the selected meals, but never the last one of a meal', async () => {
    const posted = serve({
      days: weekWith({
        '2026-06-08': monday,
        '2026-06-10': batchEntries('2026-06-10', 'mi', [food('Ketchup', 50, 'ml', KETCHUP)]),
      }),
    });
    renderScreen();

    await userEvent.click(await screen.findByRole('button', { name: 'Mehr zu Ketchup' }));
    expect(screen.getByRole('menuitem', { name: 'Weglassen' })).toBeDisabled();
    expect(screen.getByText('Die Mahlzeit braucht mindestens eine Zutat.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('heading', { name: 'Pasta mit Tomatensauce' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mehr zu Spaghetti' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Weglassen' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({
      changes: [
        { recipeBatchId: 'mo', date: '2026-06-08', remove: [{ name: 'Spaghetti', unit: 'g' }], set: [] },
        { recipeBatchId: 'mi', date: '2026-06-10', remove: [{ name: 'Spaghetti', unit: 'g' }], set: [] },
      ],
    });
  });

  it('shows an error and keeps the old amount when saving fails', async () => {
    serve();
    server.use(http.post('/api/set-batch-ingredients', () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderScreen();

    await userEvent.click(await screen.findByRole('button', { name: /^Menge von Ketchup ändern/ }));
    await userEvent.type(screen.getByLabelText('Menge von Ketchup für den Topf'), '{Control>}a{/Control}400{Enter}');

    expect(await screen.findByText('Konnte nicht speichern. Ketchup steht wieder auf 200 ml.')).toBeInTheDocument();
    expect(rowAmount('Ketchup')).toHaveTextContent('200 ml');
    expect(screen.queryByRole('button', { name: 'Ketchup zurücksetzen' })).not.toBeInTheDocument();
  });

  it('works from the plan alone when the recipe was deleted', async () => {
    serve({ withRecipe: false });
    renderScreen();

    expect(await screen.findByText(/Das Rezept gibt es nicht mehr/)).toBeInTheDocument();
    expect(rowAmount('Ketchup')).toHaveTextContent('200 ml');
    expect(screen.queryByRole('region', { name: 'Zubereitung' })).not.toBeInTheDocument();
  });

  describe('screen wake lock', () => {
    afterEach(() => Reflect.deleteProperty(navigator, 'wakeLock'));

    it('says the screen stays on while the lock is held', async () => {
      const sentinel = Object.assign(new EventTarget(), { released: false, release: async () => {} });
      Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => sentinel }, configurable: true });
      serve();

      await act(async () => {
        renderScreen();
      });

      expect(await screen.findByText('Bleibt an')).toBeInTheDocument();
    });

    it('shows no indicator without support', async () => {
      serve();
      renderScreen();

      await screen.findByRole('heading', { name: 'Pasta mit Tomatensauce' });
      expect(screen.queryByText('Bleibt an')).not.toBeInTheDocument();
    });
  });
});
