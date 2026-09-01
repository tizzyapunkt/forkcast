import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { ResolvePane, type ResolveItem } from './resolve-pane';
import type { MatchedDraftIngredient } from '../../domain/recipes';
import type { ResolutionProposal } from '../../domain/food-resolution';

const limettensaft: ResolveItem = { name: 'Limettensaft', amount: 20, unit: 'ml' };

const synonymProposal: ResolutionProposal = {
  verdict: 'synonym-of',
  foodId: 'limette',
  synonym: 'Limettensaft',
  confidence: 'medium',
  food: {
    id: 'limette',
    name: 'Limette',
    unit: 'g',
    macrosPer100: { calories: 30, protein: 0.7, carbs: 10.5, fat: 0.2 },
  },
};

function renderPane(
  proposal: ResolutionProposal,
  item: ResolveItem = limettensaft,
  onResolved: (i: MatchedDraftIngredient) => void = vi.fn<(i: MatchedDraftIngredient) => void>(),
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ResolvePane
        item={item}
        state="ready"
        proposal={proposal}
        context="import"
        onResolved={onResolved}
        onDiscard={vi.fn<() => void>()}
        onRetry={vi.fn<() => void>()}
        onClose={vi.fn<() => void>()}
      />
    </QueryClientProvider>,
  );
  return { onResolved };
}

const drafted = {
  id: 'limettensaft',
  name: 'Limettensaft',
  synonyms: [],
  unit: 'ml' as const,
  macrosPer100: { calories: 25, protein: 0.4, carbs: 8.4, fat: 0.1 },
};

const reisnudeln: ResolveItem = { name: 'dünne Reisnudeln', amount: 200, unit: 'g' };

const newFoodProposal: ResolutionProposal = {
  verdict: 'new-food',
  confidence: 'medium',
  entry: {
    id: 'duenne-reisnudeln',
    name: 'dünne Reisnudeln',
    synonyms: [],
    unit: 'g',
    macrosPer100: { calories: 360, protein: 6, carbs: 82, fat: 0.5 },
  },
};

function confirmSpy() {
  const bodies: Array<Record<string, unknown>> = [];
  server.use(
    http.post('/api/confirm-ingredient-resolution', async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        ingredient: {
          matched: true,
          name: 'Reisnudeln',
          unit: 'g',
          macrosPerUnit: { calories: 3.6, protein: 0.06, carbs: 0.82, fat: 0.005 },
          amount: 200,
          unitOverridden: false,
          source: 'CATALOG',
        },
      });
    }),
  );
  return bodies;
}

async function renameTo(name: string) {
  const field = await screen.findByLabelText('Name');
  await userEvent.clear(field);
  await userEvent.type(field, name);
}

describe('renaming a proposed new food', () => {
  it('keeps the proposed name as a synonym and sends it on confirm', async () => {
    const bodies = confirmSpy();
    renderPane(newFoodProposal, reisnudeln);

    await renameTo('Reisnudeln');
    expect(screen.getByRole('button', { name: /synonym „dünne reisnudeln“ entfernen/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /bestätigen & einfügen/i }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.entry).toMatchObject({ name: 'Reisnudeln', synonyms: ['dünne Reisnudeln'] });
  });

  it('drops the retained synonym when the user removes it', async () => {
    const bodies = confirmSpy();
    renderPane(newFoodProposal, reisnudeln);

    await renameTo('Reisnudeln');
    await userEvent.click(screen.getByRole('button', { name: /synonym „dünne reisnudeln“ entfernen/i }));
    expect(screen.queryByRole('button', { name: /synonym „dünne reisnudeln“ entfernen/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /bestätigen & einfügen/i }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.entry).toMatchObject({ synonyms: [] });
  });

  it('adds no synonym when the name was left alone', async () => {
    const bodies = confirmSpy();
    renderPane(newFoodProposal, reisnudeln);

    await screen.findByLabelText('Name');
    await userEvent.click(screen.getByRole('button', { name: /bestätigen & einfügen/i }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.entry).toMatchObject({ synonyms: [] });
  });

  it('offers the dropped qualifier as the row note and sends it as the original note', async () => {
    const bodies = confirmSpy();
    renderPane(newFoodProposal, reisnudeln);

    await renameTo('Reisnudeln');
    expect(screen.getByLabelText(/notiz/i)).toHaveValue('dünne');

    await userEvent.click(screen.getByRole('button', { name: /bestätigen & einfügen/i }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.original).toMatchObject({ note: 'dünne' });
    expect(bodies[0]!.entry).not.toHaveProperty('note');
  });

  it('leaves a note the recipe already stated untouched', async () => {
    renderPane(newFoodProposal, { ...reisnudeln, note: 'eingeweicht' });

    await renameTo('Reisnudeln');

    expect(screen.getByLabelText(/notiz/i)).toHaveValue('eingeweicht');
  });

  it('lets the user rewrite and clear the offered note', async () => {
    const bodies = confirmSpy();
    renderPane(newFoodProposal, reisnudeln);

    await renameTo('Reisnudeln');
    const note = screen.getByLabelText(/notiz/i);
    await userEvent.clear(note);
    expect(note).toHaveValue('');

    await userEvent.click(screen.getByRole('button', { name: /bestätigen & einfügen/i }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.original).not.toHaveProperty('note');
  });
});

describe('teaching the catalog from a manual pick', () => {
  const catalogHit = {
    id: 'reisnudeln',
    source: 'CATALOG',
    name: 'Reisnudeln',
    unit: 'g',
    macrosPerUnit: { calories: 3.6, protein: 0.06, carbs: 0.82, fat: 0.005 },
  };

  function searchReturning(result: Record<string, unknown>) {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([result])));
  }

  async function pickFromCatalog(name: string) {
    await userEvent.click(screen.getByRole('button', { name: /katalog zuordnen|anderes lebensmittel/i }));
    await userEvent.type(screen.getByRole('searchbox'), 'Reis');
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`, 'i') }));
  }

  it('learns the raw name as a synonym of the picked entry by default', async () => {
    const bodies = confirmSpy();
    searchReturning(catalogHit);
    renderPane(newFoodProposal, reisnudeln);

    await screen.findByLabelText('Name');
    await pickFromCatalog('Reisnudeln');

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ kind: 'synonym', foodId: 'reisnudeln', synonym: 'dünne Reisnudeln' });
  });

  it('assigns a proposed new food to an existing entry instead of creating one', async () => {
    const bodies = confirmSpy();
    searchReturning(catalogHit);
    const { onResolved } = renderPane(newFoodProposal, reisnudeln);

    await screen.findByLabelText('Name');
    await pickFromCatalog('Reisnudeln');

    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.kind).toBe('synonym');
    expect(bodies.some((b) => b.kind === 'new-food')).toBe(false);
  });

  it('writes nothing when the user switches the toggle off', async () => {
    const bodies = confirmSpy();
    searchReturning(catalogHit);
    const { onResolved } = renderPane(newFoodProposal, reisnudeln);

    await screen.findByLabelText('Name');
    await userEvent.click(screen.getByRole('button', { name: /katalog zuordnen|anderes lebensmittel/i }));
    await userEvent.click(screen.getByLabelText(/als synonym lernen/i));
    await userEvent.type(screen.getByRole('searchbox'), 'Reis');
    await userEvent.click(await screen.findByRole('button', { name: /^reisnudeln/i }));

    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(bodies).toHaveLength(0);
  });

  it('writes nothing for a result that is not a catalog entry', async () => {
    const bodies = confirmSpy();
    searchReturning({ ...catalogHit, id: 'off:123', source: 'OFF' });
    const { onResolved } = renderPane(newFoodProposal, reisnudeln);

    await screen.findByLabelText('Name');
    await pickFromCatalog('Reisnudeln');

    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(bodies).toHaveLength(0);
  });

  it('writes nothing when the raw name already is the entry name', async () => {
    const bodies = confirmSpy();
    searchReturning(catalogHit);
    const { onResolved } = renderPane(newFoodProposal, { ...reisnudeln, name: 'reisnudeln' });

    await screen.findByLabelText('Name');
    await pickFromCatalog('Reisnudeln');

    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(bodies).toHaveLength(0);
  });
});

describe('rejecting a synonym proposal for an own entry', () => {
  it('learns an edited synonym string instead of the proposed one', async () => {
    const bodies = confirmSpy();
    renderPane(synonymProposal, { ...limettensaft, name: 'grüne Oliven, entsteint' });

    const field = screen.getByLabelText(/wird gelernt als/i);
    await userEvent.clear(field);
    await userEvent.type(field, 'grüne Oliven');
    await userEvent.click(screen.getByRole('button', { name: /bestätigen & einfügen/i }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ kind: 'synonym', synonym: 'grüne Oliven' });
  });

  it('drafts a fresh entry for the raw name and opens it in the editor', async () => {
    let requestedName: string | null = null;
    server.use(
      http.post('/api/draft-catalog-entry', async ({ request }) => {
        requestedName = ((await request.json()) as { name: string }).name;
        return HttpResponse.json({ entry: drafted });
      }),
    );

    renderPane(synonymProposal);
    await userEvent.click(screen.getByRole('button', { name: /eigenen eintrag anlegen/i }));

    expect(await screen.findByLabelText('Name')).toHaveValue('Limettensaft');
    expect(requestedName).toBe('Limettensaft');
    expect(screen.getByLabelText('kcal')).toHaveValue('25');
  });

  it('shows a cancellable loading state while the draft is in flight', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('/api/draft-catalog-entry', async () => {
        await gate;
        return HttpResponse.json({ entry: drafted });
      }),
    );

    renderPane(synonymProposal);
    await userEvent.click(screen.getByRole('button', { name: /eigenen eintrag anlegen/i }));

    expect(screen.getByText(/KI erstellt einen Eintrag/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /abbrechen/i }));
    expect(screen.getByText(/wird als Synonym für Limette gelernt/i)).toBeInTheDocument();

    release();
  });

  it('confirms the drafted entry as a new food and never learns the rejected synonym', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('/api/draft-catalog-entry', () => HttpResponse.json({ entry: drafted })),
      http.post('/api/confirm-ingredient-resolution', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ingredient: {
            matched: true,
            name: 'Limettensaft',
            unit: 'ml',
            macrosPerUnit: { calories: 0.25, protein: 0.004, carbs: 0.084, fat: 0.001 },
            amount: 20,
            unitOverridden: false,
            source: 'CATALOG',
          },
        });
      }),
    );

    const { onResolved } = renderPane(synonymProposal);
    await userEvent.click(screen.getByRole('button', { name: /eigenen eintrag anlegen/i }));
    await screen.findByLabelText('Name');
    await userEvent.click(screen.getByRole('button', { name: /bestätigen & einfügen/i }));

    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.kind).toBe('new-food');
    expect(bodies[0]!.entry).toMatchObject({ name: 'Limettensaft' });
  });

  it('opens the editor on a partial drafted entry instead of tearing down', async () => {
    server.use(
      http.post('/api/draft-catalog-entry', () =>
        HttpResponse.json({ entry: { id: 'zitronensaft', name: 'Zitronensaft', unit: 'ml' } }),
      ),
    );

    renderPane(synonymProposal, { name: 'Zitronensaft', amount: 2, unit: 'ml' });
    await userEvent.click(screen.getByRole('button', { name: /eigenen eintrag anlegen/i }));

    expect(await screen.findByLabelText('Name')).toHaveValue('Zitronensaft');
    expect(screen.getByLabelText('kcal')).toHaveValue('0');
  });

  it('falls back to a blank editable entry when the draft request fails', async () => {
    server.use(http.post('/api/draft-catalog-entry', () => HttpResponse.json({ error: 'nope' }, { status: 502 })));

    renderPane(synonymProposal);
    await userEvent.click(screen.getByRole('button', { name: /eigenen eintrag anlegen/i }));

    expect(await screen.findByLabelText('Name')).toHaveValue('Limettensaft');
    expect(screen.getByLabelText('kcal')).toHaveValue('0');
    expect(screen.queryByText(/KI-geschätzt/i)).not.toBeInTheDocument();
  });

  it('keeps edits made to the drafted entry when leaving and re-entering the override', async () => {
    server.use(http.post('/api/draft-catalog-entry', () => HttpResponse.json({ entry: drafted })));

    renderPane(synonymProposal);
    await userEvent.click(screen.getByRole('button', { name: /eigenen eintrag anlegen/i }));

    const kcal = await screen.findByLabelText('kcal');
    await userEvent.clear(kcal);
    await userEvent.type(kcal, '31');

    await userEvent.click(screen.getByRole('button', { name: /zurück zum vorschlag/i }));
    expect(screen.getByText(/wird als Synonym für Limette gelernt/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /eigenen eintrag anlegen/i }));
    expect(await screen.findByLabelText('kcal')).toHaveValue('31');
  });
});
