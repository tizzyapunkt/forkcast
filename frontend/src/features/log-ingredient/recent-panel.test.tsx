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
  lastAmount: 80,
};

const skyr: RecentlyUsedIngredient = {
  name: 'Skyr',
  unit: 'g',
  macrosPerUnit: { calories: 0.65, protein: 0.11, carbs: 0.04, fat: 0.002 },
  lastUsedAt: '2026-04-21T08:00:00.000Z',
  lastAmount: 150,
};

const chicken: RecentlyUsedIngredient = {
  name: 'Chicken Breast',
  unit: 'g',
  macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 },
  lastUsedAt: '2026-04-15T08:00:00.000Z',
  lastAmount: 200,
};

describe('RecentPanel', () => {
  it('renders the list returned by the hook in order', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats, skyr, chicken])));

    renderWithProviders(<RecentPanel onSelect={() => {}} />);

    expect(await screen.findByText('Oats')).toBeInTheDocument();
    expect(screen.getByText('Skyr')).toBeInTheDocument();
    expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
  });

  it('shows kcal per 100g on each row for g-unit ingredients', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])));
    renderWithProviders(<RecentPanel onSelect={() => {}} />);
    await screen.findByText('Oats');
    // oats: 3.89 kcal/g → 389 kcal / 100g
    expect(screen.getByText('389 kcal / 100g')).toBeInTheDocument();
  });

  it('shows an empty state when there is no history', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([])));
    renderWithProviders(<RecentPanel onSelect={() => {}} />);
    expect(await screen.findByText(/noch keine zutaten/i)).toBeInTheDocument();
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
    expect(screen.getByText(/keine treffer für/i)).toBeInTheDocument();
  });

  it('calls onSelect with an IngredientSearchResult shape and the lastAmount when a row is clicked', async () => {
    server.use(http.get('/api/recently-used-ingredients', () => HttpResponse.json([oats])));
    const onSelect = vi.fn<(r: IngredientSearchResult, defaultAmount: number) => void>();
    renderWithProviders(<RecentPanel onSelect={onSelect} />);

    await userEvent.click(await screen.findByText('Oats'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [result, defaultAmount] = onSelect.mock.calls[0];
    expect(result.name).toBe('Oats');
    expect(result.unit).toBe('g');
    expect(result.macrosPerUnit).toEqual(oats.macrosPerUnit);
    expect(result.id).toMatch(/^recent:/);
    expect(result.source).toBe('RECENT');
    expect(defaultAmount).toBe(80);
  });
});
