import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { CatalogManagerScreen } from './catalog-manager-screen';
import type { CatalogEntry } from '../../domain/food-catalog';

const moehre: CatalogEntry = {
  id: 'moehre',
  name: 'Möhre',
  synonyms: ['Karotte', 'carrot'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
};

const olivenoel: CatalogEntry = {
  id: 'olivenoel',
  name: 'Olivenöl',
  synonyms: ['olive oil'],
  unit: 'ml',
  macrosPer100: { calories: 884, protein: 0, carbs: 0, fat: 100 },
};

const salz: CatalogEntry = {
  id: 'salz',
  name: 'Salz',
  synonyms: [],
  unit: 'g',
  untracked: true,
  macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 },
};

function serveCatalog(entries: CatalogEntry[]) {
  server.use(http.get('/api/catalog', () => HttpResponse.json({ entries })));
}

const renderManager = () => renderWithProviders(<CatalogManagerScreen onBack={() => {}} />);

describe('CatalogManagerScreen — list', () => {
  it('lists entries with their per-100 calories', async () => {
    serveCatalog([moehre, olivenoel]);
    renderManager();

    expect(await screen.findByText('Möhre')).toBeInTheDocument();
    expect(screen.getByText('Olivenöl')).toBeInTheDocument();
    expect(screen.getByText('41 kcal / 100 g')).toBeInTheDocument();
    expect(screen.getByText('884 kcal / 100 ml')).toBeInTheDocument();
  });

  it('marks untracked entries instead of showing zero calories', async () => {
    serveCatalog([salz]);
    renderManager();

    expect(await screen.findByText('Salz')).toBeInTheDocument();
    expect(screen.getByText('Nicht gezählt')).toBeInTheDocument();
  });

  it('filters by canonical name', async () => {
    serveCatalog([moehre, olivenoel]);
    renderManager();
    await screen.findByText('Möhre');

    await userEvent.type(screen.getByRole('searchbox'), 'oliven');

    expect(screen.getByText('Olivenöl')).toBeInTheDocument();
    expect(screen.queryByText('Möhre')).not.toBeInTheDocument();
  });

  it('filters by synonym, folding diacritics and case', async () => {
    serveCatalog([moehre, olivenoel]);
    renderManager();
    await screen.findByText('Möhre');

    await userEvent.type(screen.getByRole('searchbox'), 'KAROTTE');

    expect(screen.getByText('Möhre')).toBeInTheDocument();
    expect(screen.queryByText('Olivenöl')).not.toBeInTheDocument();
  });

  it('reports when a filter matches nothing', async () => {
    serveCatalog([moehre]);
    renderManager();
    await screen.findByText('Möhre');

    await userEvent.type(screen.getByRole('searchbox'), 'zzz');

    expect(screen.getByText(/keine treffer/i)).toBeInTheDocument();
  });
});

describe('CatalogManagerScreen — editing', () => {
  it('saves a corrected macro and shows the new value in the list', async () => {
    serveCatalog([moehre]);
    let sent: { id: string; entry: CatalogEntry } | null = null;
    server.use(
      http.post('/api/update-catalog-entry', async ({ request }) => {
        sent = (await request.json()) as { id: string; entry: CatalogEntry };
        server.use(http.get('/api/catalog', () => HttpResponse.json({ entries: [sent!.entry] })));
        return HttpResponse.json({ entry: sent.entry });
      }),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /möhre bearbeiten/i }));
    const kcal = await screen.findByLabelText('kcal');
    await userEvent.clear(kcal);
    await userEvent.type(kcal, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('25 kcal / 100 g')).toBeInTheDocument();
    expect(sent!.id).toBe('moehre');
    expect(sent!.entry.macrosPer100.calories).toBe(25);
  });

  it('removes a synonym the user deleted from the field', async () => {
    serveCatalog([moehre]);
    let sent: { entry: CatalogEntry } | null = null;
    server.use(
      http.post('/api/update-catalog-entry', async ({ request }) => {
        sent = (await request.json()) as { entry: CatalogEntry };
        return HttpResponse.json({ entry: sent.entry });
      }),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /möhre bearbeiten/i }));
    const synonyms = await screen.findByLabelText('Synonyme');
    await userEvent.clear(synonyms);
    await userEvent.type(synonyms, 'Karotte');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await screen.findByRole('searchbox');
    expect(sent!.entry.synonyms).toEqual(['Karotte']);
  });

  it('surfaces a rejected save inline and keeps the typed input', async () => {
    serveCatalog([moehre]);
    server.use(
      http.post('/api/update-catalog-entry', () =>
        HttpResponse.json({ error: 'untracked entries must have all-zero macrosPer100' }, { status: 400 }),
      ),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /möhre bearbeiten/i }));
    await userEvent.click(await screen.findByLabelText('Nicht zählen'));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText(/all-zero/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Nicht zählen')).toBeChecked();
    expect(screen.getByLabelText('Name')).toHaveValue('Möhre');
  });
});

describe('CatalogManagerScreen — creating', () => {
  it('opens an empty form and makes no AI request', async () => {
    serveCatalog([moehre]);
    let aiCalled = false;
    server.use(
      http.post('/api/draft-catalog-entry', () => {
        aiCalled = true;
        return HttpResponse.json({ entry: moehre });
      }),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: '+ Neues Lebensmittel' }));

    expect(await screen.findByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Synonyme')).toHaveValue('');
    expect(screen.getByLabelText('kcal')).toHaveValue('0');
    expect(aiCalled).toBe(false);
  });

  it('saves a fully hand-typed entry without invoking the fill', async () => {
    serveCatalog([]);
    let aiCalled = false;
    let sent: { entry: CatalogEntry } | null = null;
    server.use(
      http.post('/api/draft-catalog-entry', () => {
        aiCalled = true;
        return HttpResponse.json({ entry: moehre });
      }),
      http.post('/api/add-catalog-entry', async ({ request }) => {
        sent = (await request.json()) as { entry: CatalogEntry };
        return HttpResponse.json({ entry: { ...sent.entry, id: 'balsamicoessig' } });
      }),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: '+ Neues Lebensmittel' }));
    await userEvent.type(await screen.findByLabelText('Name'), 'Balsamicoessig');
    await userEvent.type(screen.getByLabelText('Synonyme'), 'Balsamico-Essig');
    const kcal = screen.getByLabelText('kcal');
    await userEvent.clear(kcal);
    await userEvent.type(kcal, '88');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await screen.findByRole('searchbox');
    expect(aiCalled).toBe(false);
    expect(sent!.entry).toMatchObject({
      name: 'Balsamicoessig',
      synonyms: ['Balsamico-Essig'],
      macrosPer100: expect.objectContaining({ calories: 88 }),
    });
  });

  it('fills unit, synonyms and macros from the AI action, leaving them editable', async () => {
    serveCatalog([]);
    server.use(
      http.post('/api/draft-catalog-entry', () =>
        HttpResponse.json({
          entry: {
            id: 'balsamicoessig',
            name: 'Balsamicoessig',
            synonyms: ['Balsamico-Essig', 'balsamic vinegar'],
            unit: 'ml',
            macrosPer100: { calories: 88, protein: 0, carbs: 17, fat: 0 },
          },
        }),
      ),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: '+ Neues Lebensmittel' }));
    await userEvent.type(await screen.findByLabelText('Name'), 'Balsamicoessig');
    await userEvent.click(screen.getByRole('button', { name: 'KI ausfüllen' }));

    expect(await screen.findByLabelText('Synonyme')).toHaveValue('Balsamico-Essig, balsamic vinegar');
    expect(screen.getByLabelText('kcal')).toHaveValue('88');
    expect(screen.getByRole('radio', { name: 'ml' })).toBeChecked();
    expect(screen.getByText(/KI-Schätzung/i)).toBeInTheDocument();

    const kcal = screen.getByLabelText('kcal');
    await userEvent.clear(kcal);
    await userEvent.type(kcal, '90');
    expect(kcal).toHaveValue('90');
  });

  it('shows an error and keeps typed input when the fill fails', async () => {
    serveCatalog([]);
    server.use(
      http.post('/api/draft-catalog-entry', () =>
        HttpResponse.json({ error: 'ai-resolution-failed' }, { status: 502 }),
      ),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: '+ Neues Lebensmittel' }));
    await userEvent.type(await screen.findByLabelText('Name'), 'Balsamicoessig');
    await userEvent.click(screen.getByRole('button', { name: 'KI ausfüllen' }));

    expect(await screen.findByText(/KI-Vorschlag fehlgeschlagen/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Balsamicoessig');
  });

  it('offers to open the existing entry when the name is already taken', async () => {
    serveCatalog([moehre]);
    server.use(
      http.post('/api/add-catalog-entry', () =>
        HttpResponse.json(
          { error: 'an entry named "Möhre" already exists', code: 'catalog-entry-exists', existingId: 'moehre' },
          { status: 400 },
        ),
      ),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: '+ Neues Lebensmittel' }));
    await userEvent.type(await screen.findByLabelText('Name'), 'Möhre');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Vorhandenen Eintrag öffnen' }));

    expect(await screen.findByLabelText('Name')).toHaveValue('Möhre');
    expect(screen.getByLabelText('Synonyme')).toHaveValue('Karotte, carrot');
  });
});

describe('CatalogManagerScreen — deleting', () => {
  it('requires confirmation and leaves the entry in place when dismissed', async () => {
    serveCatalog([moehre]);
    let deleteCalled = false;
    server.use(
      http.post('/api/remove-catalog-entry', () => {
        deleteCalled = true;
        return HttpResponse.json({ entry: moehre });
      }),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /möhre bearbeiten/i }));
    await userEvent.click(await screen.findByRole('button', { name: /möhre löschen/i }));

    const dialog = await screen.findByText('Eintrag löschen?');
    expect(dialog).toBeInTheDocument();
    expect(deleteCalled).toBe(false);

    // Scoped to the confirmation: the editor sheet underneath has its own cancel.
    await userEvent.click(within(dialog.closest('div')!).getByRole('button', { name: 'Abbrechen' }));

    expect(deleteCalled).toBe(false);
    expect(await screen.findByText('Möhre')).toBeInTheDocument();
  });

  it('removes the entry from the list once confirmed', async () => {
    serveCatalog([moehre, olivenoel]);
    server.use(
      http.post('/api/remove-catalog-entry', () => {
        server.use(http.get('/api/catalog', () => HttpResponse.json({ entries: [olivenoel] })));
        return HttpResponse.json({ entry: moehre });
      }),
    );
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: /möhre bearbeiten/i }));
    await userEvent.click(await screen.findByRole('button', { name: /möhre löschen/i }));
    const confirmDialog = await screen.findByText('Eintrag löschen?');
    await userEvent.click(within(confirmDialog.closest('div')!).getByRole('button', { name: 'Endgültig löschen' }));

    await screen.findByRole('searchbox');
    expect(screen.queryByText('Möhre')).not.toBeInTheDocument();
    expect(screen.getByText('Olivenöl')).toBeInTheDocument();
  });
});
