import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { SearchPanel } from './search-panel';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import type { BarcodeScannerProps } from './barcode-scanner';

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, writable: true });
});

beforeEach(() => {
  localStorage.clear();
});

vi.mock('./barcode-scanner', () => ({
  BarcodeScanner: ({ onDetect, onCancel }: BarcodeScannerProps) => (
    <>
      <button onClick={() => onDetect('4006381333931')}>trigger-detect</button>
      <button onClick={onCancel}>Abbrechen</button>
    </>
  ),
}));

const oats: IngredientSearchResult = {
  id: '1',
  source: 'CATALOG',
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

const untrackedSalt: IngredientSearchResult = {
  id: 'salz',
  source: 'CATALOG',
  name: 'Salz',
  unit: 'g',
  macrosPerUnit: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  untracked: true,
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

  it('shows calorie hint per 100g alongside each result', async () => {
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([oats])));
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'oa');
    expect(await screen.findByText('389 kcal / 100g')).toBeInTheDocument();
  });

  it('renders a source badge for each result', async () => {
    const catalogResult: IngredientSearchResult = { ...oats, source: 'CATALOG' };
    const offResult: IngredientSearchResult = {
      id: 'off-1',
      source: 'OFF',
      name: 'Packaged Oats',
      unit: 'g',
      macrosPerUnit: { calories: 3.6, protein: 0.13, carbs: 0.6, fat: 0.06 },
    };
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([catalogResult, offResult])));
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'oa');
    await screen.findByText('Oats');
    expect(screen.getByText('CATALOG')).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('renders two rows without key collision when OFF and FOODS share the same id', async () => {
    const catalogResult: IngredientSearchResult = {
      id: 'same',
      source: 'CATALOG',
      name: 'Katalog-Food',
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
    server.use(http.get('/api/search-ingredients', () => HttpResponse.json([catalogResult, offResult])));
    renderWithProviders(<SearchPanel onSelect={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'fo');
    expect(await screen.findByText('Katalog-Food')).toBeInTheDocument();
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
    expect(await screen.findByText(/keine treffer für/i)).toBeInTheDocument();
  });

  describe('untracked gating (log drawer flow)', () => {
    it('renders an untracked result with the log button disabled and the inline hint', async () => {
      server.use(http.get('/api/search-ingredients', () => HttpResponse.json([untrackedSalt])));
      const onSelect = vi.fn<(r: IngredientSearchResult) => void>();
      renderWithProviders(<SearchPanel onSelect={onSelect} disableUntracked />);
      await userEvent.type(screen.getByRole('searchbox'), 'salz');
      const button = await screen.findByRole('button', { name: /salz/i });
      expect(button).toBeDisabled();
      expect(screen.getByText(/würzmittel.*nicht getrackt/i)).toBeInTheDocument();
      // Clicking the disabled button does not invoke onSelect
      await userEvent.click(button);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('does not gate tracked results in the same query', async () => {
      const tracked: IngredientSearchResult = {
        id: 'huehnchenbrust',
        source: 'CATALOG',
        name: 'Hähnchenbrust',
        unit: 'g',
        macrosPerUnit: { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.04 },
      };
      server.use(http.get('/api/search-ingredients', () => HttpResponse.json([tracked, untrackedSalt])));
      const onSelect = vi.fn<(r: IngredientSearchResult) => void>();
      renderWithProviders(<SearchPanel onSelect={onSelect} disableUntracked />);
      await userEvent.type(screen.getByRole('searchbox'), 'mix');
      await screen.findByText('Hähnchenbrust');
      const trackedBtn = screen.getByRole('button', { name: /hähnchenbrust/i });
      expect(trackedBtn).not.toBeDisabled();
      await userEvent.click(trackedBtn);
      expect(onSelect).toHaveBeenCalledWith(tracked);
    });

    it('does NOT gate untracked results when disableUntracked is false (recipe-form flow)', async () => {
      server.use(http.get('/api/search-ingredients', () => HttpResponse.json([untrackedSalt])));
      const onSelect = vi.fn<(r: IngredientSearchResult) => void>();
      renderWithProviders(<SearchPanel onSelect={onSelect} />);
      await userEvent.type(screen.getByRole('searchbox'), 'salz');
      const button = await screen.findByRole('button', { name: /salz/i });
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
      expect(onSelect).toHaveBeenCalledWith(untrackedSalt);
    });
  });

  describe('source toggle', () => {
    it('offers no control to disable the catalog', () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      expect(screen.queryByRole('checkbox', { name: /^foods$/i })).not.toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    });

    it('renders the Open Food Facts toggle unchecked by default', () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      expect(screen.getByRole('checkbox', { name: /open food facts/i })).not.toBeChecked();
    });

    it('searches the catalog only while the toggle is off', async () => {
      let capturedUrl = '';
      server.use(
        http.get('/api/search-ingredients', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json([oats]);
        }),
      );
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.type(screen.getByRole('searchbox'), 'oa');
      await screen.findByText('Oats');
      expect(new URL(capturedUrl).searchParams.get('sources')).toBe('catalog');
    });

    it('adds Open Food Facts when the toggle is enabled', async () => {
      let capturedUrl = '';
      server.use(
        http.get('/api/search-ingredients', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json([oats]);
        }),
      );
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('checkbox', { name: /open food facts/i }));
      await userEvent.type(screen.getByRole('searchbox'), 'oa');
      await screen.findByText('Oats');
      expect(new URL(capturedUrl).searchParams.get('sources')).toBe('catalog,off');
    });

    it('persists the toggle across remounts', async () => {
      const { unmount } = renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('checkbox', { name: /open food facts/i }));
      unmount();

      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      expect(screen.getByRole('checkbox', { name: /open food facts/i })).toBeChecked();
    });

    it('clears the retired foods preference on mount and still searches the catalog', async () => {
      localStorage.setItem('forkcast:foods-enabled', 'false');
      let capturedUrl = '';
      server.use(
        http.get('/api/search-ingredients', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json([oats]);
        }),
      );
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.type(screen.getByRole('searchbox'), 'oa');
      await screen.findByText('Oats');

      expect(localStorage.getItem('forkcast:foods-enabled')).toBeNull();
      expect(new URL(capturedUrl).searchParams.get('sources')).toBe('catalog');
    });

    it('removes the legacy forkcast:off-enabled key on mount (one-shot migration)', () => {
      localStorage.setItem('forkcast:off-enabled', 'true');
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      expect(localStorage.getItem('forkcast:off-enabled')).toBeNull();
    });
  });

  describe('barcode scanning', () => {
    it('shows a scan barcode button in the default text mode', () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      expect(screen.getByRole('button', { name: /barcode scannen/i })).toBeInTheDocument();
    });

    it('clicking scan barcode shows the scanner and hides the search input', async () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /barcode scannen/i }));
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /abbrechen/i })).toBeInTheDocument();
    });

    it('cancelling the scanner returns to the text search input', async () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /barcode scannen/i }));
      await userEvent.click(screen.getByRole('button', { name: /abbrechen/i }));
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('calls onSelect with the product when barcode is found', async () => {
      server.use(http.get('/api/search-ingredients/barcode/:barcode', () => HttpResponse.json(scannedProduct)));
      const onSelect = vi.fn<(r: IngredientSearchResult) => void>();
      renderWithProviders(<SearchPanel onSelect={onSelect} />);
      await userEvent.click(screen.getByRole('button', { name: /barcode scannen/i }));
      await userEvent.click(screen.getByRole('button', { name: /trigger-detect/i }));
      expect(await screen.findByText(/barcode wird gesucht/i)).toBeInTheDocument();
      // Wait for onSelect to be called after the query resolves
      await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(scannedProduct));
    });

    it('shows "Product not found" when barcode lookup returns 404', async () => {
      // default MSW handler returns 404 for barcode lookup
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /barcode scannen/i }));
      await userEvent.click(screen.getByRole('button', { name: /trigger-detect/i }));
      expect(await screen.findByText(/produkt nicht gefunden/i)).toBeInTheDocument();
    });

    it('shows "Product not found" when barcode lookup returns a server error', async () => {
      server.use(
        http.get('/api/search-ingredients/barcode/:barcode', () =>
          HttpResponse.json({ error: 'internal server error' }, { status: 500 }),
        ),
      );
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /barcode scannen/i }));
      await userEvent.click(screen.getByRole('button', { name: /trigger-detect/i }));
      expect(await screen.findByText(/produkt nicht gefunden/i)).toBeInTheDocument();
    });

    it('clicking "Try again" after not-found re-shows the scanner', async () => {
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: /barcode scannen/i }));
      await userEvent.click(screen.getByRole('button', { name: /trigger-detect/i }));
      await screen.findByText(/produkt nicht gefunden/i);
      await userEvent.click(screen.getByRole('button', { name: /erneut versuchen/i }));
      expect(screen.getByRole('button', { name: /abbrechen/i })).toBeInTheDocument();
    });
  });

  describe('packaging capture after barcode not-found', () => {
    async function reachNotFound() {
      await userEvent.click(screen.getByRole('button', { name: /barcode scannen/i }));
      await userEvent.click(screen.getByRole('button', { name: /trigger-detect/i }));
      await screen.findByText(/produkt nicht gefunden/i);
    }

    it('offers the packaging-capture action when AI capture is configured', async () => {
      // default extract handler returns 400 for the empty-barcode probe → configured
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await reachNotFound();
      expect(await screen.findByRole('button', { name: /verpackung erfassen/i })).toBeInTheDocument();
    });

    it('hides the capture action and shows a hint when capture is not configured (503)', async () => {
      server.use(
        http.post('/api/extract-product-from-photos', () =>
          HttpResponse.json({ error: 'ai-import-not-configured' }, { status: 503 }),
        ),
      );
      renderWithProviders(<SearchPanel onSelect={() => {}} />);
      await reachNotFound();
      expect(await screen.findByText(/nicht aktiviert/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /verpackung erfassen/i })).not.toBeInTheDocument();
    });

    it('captures a product: photograph → extract → edit → save → onSelect with edited values', async () => {
      let savedBody: { barcode: string; name: string; macrosPer100: { calories: number } } | null = null;
      server.use(
        http.post('/api/extract-product-from-photos', async ({ request }) => {
          const body = (await request.json()) as { barcode?: string };
          if (!body.barcode) return HttpResponse.json({ error: 'barcode is required' }, { status: 400 });
          return HttpResponse.json({
            barcode: body.barcode,
            name: 'Himbeer-Heidelbeer-Mix',
            unit: 'g',
            macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
          });
        }),
        http.post('/api/save-scanned-product', async ({ request }) => {
          savedBody = (await request.json()) as typeof savedBody;
          const m = savedBody!.macrosPer100;
          return HttpResponse.json({
            id: savedBody!.barcode,
            source: 'SCAN',
            name: savedBody!.name,
            unit: 'g',
            macrosPerUnit: { calories: m.calories / 100, protein: 0.009, carbs: 0.084, fat: 0.007 },
          });
        }),
      );

      const onSelect = vi.fn<(r: IngredientSearchResult) => void>();
      renderWithProviders(<SearchPanel onSelect={onSelect} />);
      await reachNotFound();

      await userEvent.click(await screen.findByRole('button', { name: /verpackung erfassen/i }));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([new Uint8Array(100)], 'back.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await userEvent.click(screen.getByRole('button', { name: /nährwerte auslesen/i }));

      const caloriesInput = (await screen.findByLabelText(/kalorien/i)) as HTMLInputElement;
      expect(caloriesInput.value).toBe('54');
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Himbeer-Heidelbeer-Mix');

      await userEvent.clear(caloriesInput);
      await userEvent.type(caloriesInput, '52');

      await userEvent.click(screen.getByRole('button', { name: /speichern & übernehmen/i }));

      await vi.waitFor(() => expect(onSelect).toHaveBeenCalled());
      expect(savedBody!.macrosPer100.calories).toBe(52);
      const result = onSelect.mock.calls[0]![0];
      expect(result.source).toBe('SCAN');
      expect(result.id).toBe('4006381333931');
    });
  });
});
