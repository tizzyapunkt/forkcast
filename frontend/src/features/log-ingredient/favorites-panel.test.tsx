import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { serveFavorites, type StoredFavorite } from '../../test/msw/favorites';
import { FavoritesPanel } from './favorites-panel';
import type { IngredientSearchResult } from '../../domain/ingredient-search';

const skyr: StoredFavorite = {
  name: 'Skyr Natur',
  unit: 'g',
  macrosPerUnit: { calories: 0.63, protein: 0.11, carbs: 0.04, fat: 0.002 },
  favoritedAt: '2026-01-04T08:00:00.000Z',
  lastAmount: 180,
  lastUsedAt: '2026-02-08T07:00:00.000Z',
};

const oats: StoredFavorite = {
  name: 'Haferflocken',
  unit: 'g',
  macrosPerUnit: { calories: 3.72, protein: 0.13, carbs: 0.59, fat: 0.07 },
  favoritedAt: '2026-01-03T08:00:00.000Z',
  lastAmount: 60,
  lastUsedAt: '2026-02-01T07:00:00.000Z',
};

const peanutButter: StoredFavorite = {
  name: 'Erdnussbutter',
  unit: 'g',
  macrosPerUnit: { calories: 6.17, protein: 0.25, carbs: 0.12, fat: 0.5 },
  favoritedAt: '2026-01-02T08:00:00.000Z',
};

describe('FavoritesPanel', () => {
  it('shows a loading state while the list is in flight', () => {
    server.use(http.get('/api/favorite-ingredients', () => new Promise(() => {})));

    renderWithProviders(<FavoritesPanel onSelect={() => {}} />);

    expect(screen.getByText('Laden…')).toBeInTheDocument();
  });

  it('renders the list in the order the query returned', async () => {
    serveFavorites([skyr, oats, peanutButter]);

    renderWithProviders(<FavoritesPanel onSelect={() => {}} />);

    await screen.findByText('Skyr Natur');
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('Skyr Natur');
    expect(names[1]).toContain('Haferflocken');
    expect(names[2]).toContain('Erdnussbutter');
  });

  it('points at the star when nothing is favorited, keeping the filter input in place', async () => {
    serveFavorites([]);

    renderWithProviders(<FavoritesPanel onSelect={() => {}} />);

    expect(await screen.findByText(/tippe in „Suche“ oder „Zuletzt“ auf den Stern/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('filters the loaded list fuzzily without a request per keystroke', async () => {
    let requests = 0;
    server.use(
      http.get('/api/favorite-ingredients', () => {
        requests += 1;
        return HttpResponse.json([skyr, oats, peanutButter]);
      }),
    );
    renderWithProviders(<FavoritesPanel onSelect={() => {}} />);
    await screen.findByText('Skyr Natur');
    const before = requests;

    await userEvent.type(screen.getByRole('searchbox'), 'skir');

    expect(screen.getByText('Skyr Natur')).toBeInTheDocument();
    expect(screen.queryByText('Haferflocken')).not.toBeInTheDocument();
    expect(requests).toBe(before);
  });

  it('reports when the filter matches nothing', async () => {
    serveFavorites([skyr]);
    renderWithProviders(<FavoritesPanel onSelect={() => {}} />);
    await screen.findByText('Skyr Natur');

    await userEvent.type(screen.getByRole('searchbox'), 'zucchini');

    expect(screen.getByText(/Keine Treffer für „zucchini“/)).toBeInTheDocument();
  });

  it('passes the picked favorite and its last amount to the host', async () => {
    serveFavorites([skyr]);
    const onSelect = vi.fn<(r: IngredientSearchResult, amount?: number) => void>();
    renderWithProviders(<FavoritesPanel onSelect={onSelect} showLastAmount />);

    await userEvent.click(await screen.findByRole('button', { name: /^Skyr Natur/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [result, amount] = onSelect.mock.calls[0]!;
    expect(result).toMatchObject({ name: 'Skyr Natur', unit: 'g', macrosPerUnit: skyr.macrosPerUnit });
    expect(amount).toBe(180);
  });

  it('passes no amount for a favorite that has never been logged', async () => {
    serveFavorites([peanutButter]);
    const onSelect = vi.fn<(r: IngredientSearchResult, amount?: number) => void>();
    renderWithProviders(<FavoritesPanel onSelect={onSelect} showLastAmount />);

    await userEvent.click(await screen.findByRole('button', { name: /^Erdnussbutter/ }));

    expect(onSelect.mock.calls[0]![1]).toBeUndefined();
  });

  describe('row variants', () => {
    it('shows the last amount ahead of the energy density in the drawer', async () => {
      serveFavorites([skyr]);

      renderWithProviders(<FavoritesPanel onSelect={() => {}} showLastAmount />);

      const row = await screen.findByRole('button', { name: /^Skyr Natur/ });
      expect(row).toHaveTextContent('zuletzt 180 g');
      expect(row).toHaveTextContent('63 kcal / 100g');
    });

    it('says a favorite has not been logged yet instead of showing an amount', async () => {
      serveFavorites([peanutButter]);

      renderWithProviders(<FavoritesPanel onSelect={() => {}} showLastAmount />);

      const row = await screen.findByRole('button', { name: /^Erdnussbutter/ });
      expect(row).toHaveTextContent('617 kcal / 100g');
      expect(row).toHaveTextContent('noch nicht geloggt');
      expect(row).not.toHaveTextContent('zuletzt');
    });

    it('omits the last amount entirely in the recipe picker', async () => {
      serveFavorites([skyr]);

      renderWithProviders(<FavoritesPanel onSelect={() => {}} />);

      const row = await screen.findByRole('button', { name: /^Skyr Natur/ });
      expect(row).toHaveTextContent('63 kcal / 100g');
      expect(row).not.toHaveTextContent('zuletzt');
      expect(row).not.toHaveTextContent('noch nicht geloggt');
    });
  });

  describe('star', () => {
    it('renders every row favorited and removes it from the list in place', async () => {
      const { posted } = serveFavorites([skyr, oats]);
      const onSelect = vi.fn<(r: IngredientSearchResult, amount?: number) => void>();
      renderWithProviders(<FavoritesPanel onSelect={onSelect} showLastAmount />);

      await userEvent.click(await screen.findByRole('button', { name: '„Skyr Natur“ aus Favoriten entfernen' }));

      expect(screen.queryByText('Skyr Natur')).not.toBeInTheDocument();
      expect(screen.getByText('Haferflocken')).toBeInTheDocument();
      expect(posted).toEqual([{ name: 'Skyr Natur', unit: 'g' }]);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
