import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { LogIngredientDrawer, type BatchTarget } from './log-ingredient-drawer';
import type { LogEntry, RecentlyUsedIngredient } from '../../domain/meal-log';

const hack: LogEntry = {
  id: 'hack',
  date: '2026-09-29',
  slot: 'dinner',
  loggedAt: '',
  recipeId: 'chili',
  recipeBatchId: 'batch-1',
  recipePortions: 1,
  ingredient: {
    type: 'full',
    name: 'Hackfleisch',
    unit: 'g',
    macrosPerUnit: { calories: 2.5, protein: 0.2, carbs: 0, fat: 0.2 },
    amount: 250,
  },
};

const tofuResult = {
  id: 'tofu',
  source: 'CATALOG',
  name: 'Tofu',
  unit: 'g',
  macrosPerUnit: { calories: 1.2, protein: 0.12, carbs: 0.02, fat: 0.07 },
};
const milkResult = { ...tofuResult, id: 'milch', name: 'Milch', unit: 'ml' };
const saltResult = { ...tofuResult, id: 'salz', name: 'Salz', untracked: true };

const spinatRecent: RecentlyUsedIngredient = {
  name: 'Spinat',
  unit: 'g',
  macrosPerUnit: { calories: 0.23, protein: 0.03, carbs: 0.01, fat: 0 },
  lastUsedAt: '2026-09-20T08:00:00.000Z',
  lastAmount: 80,
};

const replaceTarget: BatchTarget = { kind: 'replace', entry: hack, recipeName: 'Chili' };
const addTarget: BatchTarget = { kind: 'add', recipeBatchId: 'batch-1', recipeName: 'Chili' };

function renderDrawer(target: BatchTarget, onClose = vi.fn<() => void>()) {
  renderWithProviders(<LogIngredientDrawer open slot="dinner" date="2026-09-29" onClose={onClose} target={target} />, {
    queryClient: createTestQueryClient(),
  });
  return onClose;
}

async function searchAndPick(query: string, name: string) {
  await userEvent.type(screen.getByPlaceholderText(/zutaten suchen/i), query);
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`, 'i') }));
}

describe('LogIngredientDrawer — batch-targeted mode', () => {
  beforeEach(() => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([tofuResult, milkResult, saltResult])));
  });

  it.each([
    ['replace', replaceTarget, 'Zutat ersetzen — Chili'],
    ['add', addTarget, 'Zutat hinzufügen — Chili'],
  ])('%s mode names the action and recipe and offers only single-ingredient tabs', async (_mode, target, title) => {
    renderDrawer(target);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^suche$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^favoriten$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^zuletzt$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^rezepte$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^schnell$/i })).not.toBeInTheDocument();
  });

  it('keeps untracked search results un-selectable', async () => {
    renderDrawer(addTarget);

    await userEvent.type(screen.getByPlaceholderText(/zutaten suchen/i), 'salz');

    expect(await screen.findByRole('button', { name: /^salz/i })).toBeDisabled();
  });

  it('replace sends the picked food to /replace-batch-ingredient, not /log-ingredient, and closes', async () => {
    let replaced: unknown;
    let logged = false;
    server.use(
      http.post('/api/replace-batch-ingredient', async ({ request }) => {
        replaced = await request.json();
        return HttpResponse.json({});
      }),
      http.post('/api/log-ingredient', () => {
        logged = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const onClose = renderDrawer(replaceTarget);

    await searchAndPick('tofu', 'Tofu');
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(replaced).toEqual({
      entryId: 'hack',
      ingredient: { type: 'full', name: 'Tofu', unit: 'g', macrosPerUnit: tofuResult.macrosPerUnit, amount: 250 },
    });
    expect(logged).toBe(false);
  });

  it('replace pre-fills the replaced amount for a same-unit food', async () => {
    renderDrawer(replaceTarget);

    await searchAndPick('tofu', 'Tofu');

    expect(screen.getByLabelText(/menge/i)).toHaveValue('250');
  });

  it('replace does not pre-fill the amount for a different-unit food', async () => {
    renderDrawer(replaceTarget);

    await searchAndPick('milch', 'Milch');

    expect(screen.getByLabelText(/menge/i)).toHaveValue('');
  });

  it('add sends the picked food to /add-to-recipe-batch with the batch and date', async () => {
    let added: unknown;
    server.use(
      http.get('/api/recently-used-ingredients', () => HttpResponse.json([spinatRecent])),
      http.post('/api/add-to-recipe-batch', async ({ request }) => {
        added = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const onClose = renderDrawer(addTarget);

    await userEvent.click(screen.getByRole('button', { name: /^zuletzt$/i }));
    await userEvent.click(await screen.findByText('Spinat'));
    expect(screen.getByLabelText(/menge/i)).toHaveValue('80');
    await userEvent.click(screen.getByRole('button', { name: /erfassen/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(added).toEqual({
      recipeBatchId: 'batch-1',
      date: '2026-09-29',
      ingredient: { type: 'full', name: 'Spinat', unit: 'g', macrosPerUnit: spinatRecent.macrosPerUnit, amount: 80 },
    });
  });

  it('closing without confirming sends nothing', async () => {
    let calls = 0;
    server.use(
      http.post('/api/replace-batch-ingredient', () => {
        calls++;
        return HttpResponse.json({});
      }),
    );
    const onClose = renderDrawer(replaceTarget);

    await searchAndPick('tofu', 'Tofu');
    await userEvent.click(screen.getByRole('button', { name: /^abbrechen$/i }));

    expect(onClose).toHaveBeenCalled();
    expect(calls).toBe(0);
  });
});
