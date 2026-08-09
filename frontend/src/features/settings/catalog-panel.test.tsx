import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { CatalogPanel } from './catalog-panel';
import type { CatalogEntry } from '../../domain/food-catalog';

const entry = (id: string): CatalogEntry => ({
  id,
  name: id,
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 10, protein: 0, carbs: 0, fat: 0 },
});

let downloads: string[] = [];

beforeEach(() => {
  downloads = [];
  // jsdom has no object-URL plumbing; stub it and record the anchor's filename instead.
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true });
  // jsdom implements click() on HTMLElement, so the anchor's own prototype has nothing to spy on.
  vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function (this: HTMLElement) {
    if (this instanceof HTMLAnchorElement) downloads.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function serveCatalog(entries: CatalogEntry[]) {
  server.use(
    http.get('/api/catalog', () => HttpResponse.json({ entries })),
    http.get('/api/export-catalog', () => HttpResponse.json(entries)),
  );
}

describe('CatalogPanel', () => {
  it('shows how many entries the catalog holds', async () => {
    serveCatalog([entry('a'), entry('b'), entry('c')]);
    renderWithProviders(<CatalogPanel onManage={() => {}} />);

    expect(await screen.findByText('3 Einträge')).toBeInTheDocument();
  });

  it('links into the catalog manager', async () => {
    serveCatalog([entry('a')]);
    const onManage = vi.fn<() => void>();
    renderWithProviders(<CatalogPanel onManage={onManage} />);

    await userEvent.click(screen.getByRole('button', { name: /katalog verwalten/i }));

    expect(onManage).toHaveBeenCalled();
  });

  it('states that the snapshot is a backup and does not drain the catalog', () => {
    serveCatalog([]);
    renderWithProviders(<CatalogPanel onManage={() => {}} />);

    expect(screen.getByText(/backup/i)).toBeInTheDocument();
    expect(screen.getByText(/bleibt dabei unverändert/i)).toBeInTheDocument();
  });

  it('downloads a timestamped snapshot without changing the entry count', async () => {
    serveCatalog([entry('a'), entry('b')]);
    renderWithProviders(<CatalogPanel onManage={() => {}} />);
    await screen.findByText('2 Einträge');

    await userEvent.click(screen.getByRole('button', { name: /sicherung herunterladen/i }));

    await vi.waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toMatch(/^catalog-\d{8}-\d{4}\.json$/);
    expect(await screen.findByText('2 Einträge')).toBeInTheDocument();
  });

  it('reports a failed export', async () => {
    server.use(
      http.get('/api/catalog', () => HttpResponse.json({ entries: [] })),
      http.get('/api/export-catalog', () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
    );
    renderWithProviders(<CatalogPanel onManage={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /sicherung herunterladen/i }));

    expect(await screen.findByText(/download fehlgeschlagen/i)).toBeInTheDocument();
    expect(downloads).toHaveLength(0);
  });
});
