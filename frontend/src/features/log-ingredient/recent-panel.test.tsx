import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { RecentPanel } from './recent-panel';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { RecentlyUsedIngredient } from '../../domain/meal-log';

const oats: RecentlyUsedIngredient = {
  name: 'Oats',
  unit: 'g',
  macrosPerUnit: { calories: 3.89, protein: 0.17, carbs: 0.66, fat: 0.07 },
  lastUsedAt: '2026-04-22T08:00:00.000Z',
};

const skyr: RecentlyUsedIngredient = {
  name: 'Skyr',
  unit: 'g',
  macrosPerUnit: { calories: 0.65, protein: 0.11, carbs: 0.04, fat: 0.002 },
  lastUsedAt: '2026-04-21T08:00:00.000Z',
};

const chicken: RecentlyUsedIngredient = {
  name: 'Chicken Breast',
  unit: 'g',
  macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
  lastUsedAt: '2026-04-15T08:00:00.000Z',
};

describe('RecentPanel', () => {
  it('renders the list returned by the hook in order', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats, skyr, chicken])));

    renderWithProviders(<RecentPanel onSelect={() => {}} />);

    expect(await screen.findByText('Oats')).toBeInTheDocument();
    expect(screen.getByText('Skyr')).toBeInTheDocument();
    expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
  });

  it('shows an empty state when there is no history', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([])));
    renderWithProviders(<RecentPanel onSelect={() => {}} />);
    expect(await screen.findByText(/no ingredients yet/i)).toBeInTheDocument();
  });

  it('filters fuzzily on search input', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats, skyr, chicken])));
    renderWithProviders(<RecentPanel onSelect={() => {}} />);
    await screen.findByText('Oats');

    await userEvent.type(screen.getByRole('searchbox'), 'oat');

    expect(screen.getByText('Oats')).toBeInTheDocument();
    expect(screen.queryByText('Skyr')).not.toBeInTheDocument();
    expect(screen.queryByText('Chicken Breast')).not.toBeInTheDocument();
  });

  it('matches with typos (fuzzy)', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats, skyr])));
    renderWithProviders(<RecentPanel onSelect={() => {}} />);
    await screen.findByText('Skyr');

    await userEvent.type(screen.getByRole('searchbox'), 'skir');

    expect(screen.getByText('Skyr')).toBeInTheDocument();
  });

  it('shows an empty-result state when fuzzy match has no hits', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])));
    renderWithProviders(<RecentPanel onSelect={() => {}} />);
    await screen.findByText('Oats');

    await userEvent.type(screen.getByRole('searchbox'), 'zzzqqq');

    expect(screen.queryByText('Oats')).not.toBeInTheDocument();
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it('calls onSelect with an IngredientSearchResult shape when a row is clicked', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])));
    const onSelect = vi.fn<(r: IngredientSearchResult) => void>();
    renderWithProviders(<RecentPanel onSelect={onSelect} />);

    await userEvent.click(await screen.findByText('Oats'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0][0];
    expect(arg.name).toBe('Oats');
    expect(arg.unit).toBe('g');
    expect(arg.macrosPerUnit).toEqual(oats.macrosPerUnit);
    expect(arg.offId).toMatch(/^recent:/);
  });
});
