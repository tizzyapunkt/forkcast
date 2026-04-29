import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { SearchPanel } from './search-panel';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { BarcodeScannerProps } from './barcode-scanner';

vi.mock('./barcode-scanner', () => ({
  BarcodeScanner: ({ onDetect, onCancel }: BarcodeScannerProps) => (
    <>
      <button onClick={() => onDetect('4006381333931')}>trigger-detect</button>
      <button onClick={onCancel}>Cancel</button>
    </>
  ),
}));

const oats: IngredientSearchResult = {
  id: '1',
  source: 'BLS',
  name: 'Oats',
  unit: 'g',
  macrosPerUnit: { calories: 3.89, protein: 0.17, carbs: 0.66, fat: 0.07 },
};

const scannedProduct: IngredientSearchResult = {
  id: '4006381333931',
  source: 'OFF',
  name: 'Milka Chocolate',
  unit: 'g',
  macrosPerUnit: { calories: 5.35, protein: 0.05, carbs: 0.59, fat: 0.3 },
};

describe('SearchPanel', () => {
  it('does not request when query is shorter than 2 chars', async () => {
    let called = false;
    server.use(
      http.get('/api/search-ingredients', () => {
        called = true;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'o');
    await new Promise((r) => setTimeout(r, 350));
    expect(called).toBe(false);
  });

  it('shows results after typing a query of 2+ chars', async () => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([oats])));
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'oa');
    expect(await screen.findByText('Oats')).toBeInTheDocument();
  });

  it('shows calorie hint alongside each result', async () => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([oats])));
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'oa');
    expect(await screen.findByText(/3\.89 kcal/)).toBeInTheDocument();
  });

  it('renders a source badge for each result', async () => {
    const blsResult: IngredientSearchResult = { ...oats, source: 'BLS' };
    const offResult: IngredientSearchResult = {
      id: 'off-1',
      source: 'OFF',
      name: 'Packaged Oats',
      unit: 'g',
      macrosPerUnit: { calories: 3.6, protein: 0.13, carbs: 0.6, fat: 0.06 },
    };
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([blsResult, offResult])));
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'oa');
    await screen.findByText('Oats');
    expect(screen.getByText('BLS')).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('renders two rows without key collision when OFF and BLS share the same id', async () => {
    const blsResult: IngredientSearchResult = {
      id: 'same',
      source: 'BLS',
      name: 'BLS Food',
      unit: 'g',
      macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
    };
    const offResult: IngredientSearchResult = {
      id: 'same',
      source: 'OFF',
      name: 'OFF Food',
      unit: 'g',
      macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
    };
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([blsResult, offResult])));
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'fo');
    expect(await screen.findByText('BLS Food')).toBeInTheDocument();
    expect(screen.getByText('OFF Food')).toBeInTheDocument();
  });

  it('calls onSelect with the result when a row is clicked', async () => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([oats])));
    const onSelect = vi.fn<(r: IngredientSearchResult) => void>();
    renderWithProviders(<SearchPanel onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('searchbox'), 'oa');
    await userEvent.click(await screen.findByText('Oats'));
    expect(onSelect).toHaveBeenCalledWith(oats);
  });

  it('shows empty state when results are empty', async () => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([])));
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'zz');
    expect(await screen.findByText(/no results/i)).toBeInTheDocument();
  });

  describe('barcode scanning', () => {
    it('shows a scan barcode button in the default text mode', () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      expect(screen.getByRole('button', { name: /scan barcode/i })).toBeInTheDocument();
    });

    it('clicking scan barcode shows the scanner and hides the search input', async () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /scan barcode/i }));
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('cancelling the scanner returns to the text search input', async () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /scan barcode/i }));
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('calls onSelect with the product when barcode is found', async () => {
      server.use(http.get('/api/search-ingredients/barcode/:barcode', () => HttpResponse.json(scannedProduct)));
      const onSelect = vi.fn<(r: IngredientSearchResult) => void>();
      renderWithProviders(<SearchPanel onSelect={onSelect} />);
      await userEvent.click(screen.getByRole('button', { name: /scan barcode/i }));
      await userEvent.click(screen.getByRole('button', { name: /trigger-detect/i }));
      expect(await screen.findByText(/looking up/i)).toBeInTheDocument();
      // Wait for onSelect to be called after the query resolves
      await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(scannedProduct));
    });

    it('shows "Product not found" when barcode lookup returns 404', async () => {
      // default MSW handler returns 404 for barcode lookup
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /scan barcode/i }));
      await userEvent.click(screen.getByRole('button', { name: /trigger-detect/i }));
      expect(await screen.findByText(/product not found/i)).toBeInTheDocument();
    });

    it('clicking "Try again" after not-found re-shows the scanner', async () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /scan barcode/i }));
      await userEvent.click(screen.getByRole('button', { name: /trigger-detect/i }));
      await screen.findByText(/product not found/i);
      await userEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });
});
