import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchIngredients, useSearchBarcode } from '../../queries/use-search-ingredients';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import { BarcodeScanner } from './barcode-scanner';
import { de } from '../../i18n/de';
import { useLocalStorage } from '../../hooks/use-local-storage';
import { CaptureProductFlow } from '../extract-product-from-photos/capture-product-flow';
import { useProductCaptureConfigured } from '../extract-product-from-photos/use-product-capture-configured';

interface SearchPanelProps {
  onSelect: (result: IngredientSearchResult) => void;
  /** When true (log drawer flow), untracked search results render disabled with an inline hint
   * because logging an untracked item makes no sense. The recipe-form picker leaves this off so
   * users can still pick untracked ingredients into a recipe. */
  disableUntracked?: boolean;
  /** When provided, a "create with AI" trigger appears once the query is ≥2 chars, letting the
   * user create a missing food. The host owns the create sheet (see CreateFoodSheet). */
  onCreate?: (query: string) => void;
}

type ScanState =
  | { mode: 'text' }
  | { mode: 'scanning' }
  | { mode: 'barcode-loading'; barcode: string }
  | { mode: 'barcode-not-found'; barcode: string }
  | { mode: 'capturing-product'; barcode: string };

const LEGACY_OFF_KEY = 'forkcast:off-enabled';
const FOODS_KEY = 'forkcast:foods-enabled';

function clearLegacyToggleKey() {
  try {
    if (localStorage.getItem(LEGACY_OFF_KEY) !== null) {
      localStorage.removeItem(LEGACY_OFF_KEY);
    }
  } catch {
    // ignore quota or access errors
  }
}

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function SearchPanel({ onSelect, disableUntracked = false, onCreate }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  useEffect(() => {
    clearLegacyToggleKey();
  }, []);
  const [foodsEnabled, setFoodsEnabled] = useLocalStorage<boolean>(FOODS_KEY, false);
  const sources: Array<'FOODS' | 'OFF'> = foodsEnabled ? ['FOODS', 'OFF'] : ['OFF'];
  const { data: results, isLoading } = useSearchIngredients(debouncedQuery, sources);
  const inputRef = useRef<HTMLInputElement>(null);

  const [scanState, setScanState] = useState<ScanState>({ mode: 'text' });

  const barcodeToLookup = scanState.mode === 'barcode-loading' ? scanState.barcode : '';
  const {
    data: barcodeResult,
    isLoading: barcodeLoading,
    isSuccess: barcodeSuccess,
    isError: barcodeError,
  } = useSearchBarcode(barcodeToLookup);

  const captureRelevant = scanState.mode === 'barcode-not-found' || scanState.mode === 'capturing-product';
  const { data: captureConfigured } = useProductCaptureConfigured(captureRelevant);

  useEffect(() => {
    if (scanState.mode !== 'barcode-loading') return;
    if (barcodeLoading) return;
    if (barcodeError) {
      setScanState({ mode: 'barcode-not-found', barcode: scanState.barcode });
      return;
    }
    if (!barcodeSuccess) return;
    if (barcodeResult) {
      onSelect(barcodeResult);
    } else {
      setScanState({ mode: 'barcode-not-found', barcode: scanState.barcode });
    }
  }, [barcodeLoading, barcodeSuccess, barcodeError, barcodeResult, scanState, onSelect]);

  useEffect(() => {
    if (scanState.mode === 'text') {
      inputRef.current?.focus();
    }
  }, [scanState.mode]);

  const handleBarcodeDetected = useCallback((barcode: string) => {
    setScanState({ mode: 'barcode-loading', barcode });
  }, []);

  const hasQuery = debouncedQuery.trim().length >= 2;

  if (scanState.mode === 'scanning') {
    return <BarcodeScanner onDetect={handleBarcodeDetected} onCancel={() => setScanState({ mode: 'text' })} />;
  }

  if (scanState.mode === 'barcode-loading') {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted-foreground">{de.searchPanel.lookingUp}</p>
      </div>
    );
  }

  if (scanState.mode === 'capturing-product') {
    return (
      <CaptureProductFlow
        barcode={scanState.barcode}
        onCancel={() => setScanState({ mode: 'text' })}
        onCaptured={(result) => onSelect(result)}
      />
    );
  }

  if (scanState.mode === 'barcode-not-found') {
    const notFoundBarcode = scanState.barcode;
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-destructive">{de.searchPanel.notFound}</p>
        {captureConfigured !== false ? (
          <button
            type="button"
            onClick={() => setScanState({ mode: 'capturing-product', barcode: notFoundBarcode })}
            aria-label={de.productCapture.ctaAria}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            {de.productCapture.cta}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">{de.productCapture.notConfigured}</p>
        )}
        <button
          type="button"
          onClick={() => setScanState({ mode: 'scanning' })}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          {de.searchPanel.tryAgain}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex min-w-0 gap-2">
        <input
          ref={inputRef}
          role="searchbox"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={de.searchPanel.placeholder}
          className="min-w-0 flex-1 appearance-none rounded-md border px-3 py-2 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        />
        <button
          type="button"
          aria-label={de.searchPanel.scanBarcode}
          onClick={() => setScanState({ mode: 'scanning' })}
          className="shrink-0 rounded-md border px-3 py-2 text-sm"
        >
          📷
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
        <input
          type="checkbox"
          checked={foodsEnabled}
          onChange={(e) => setFoodsEnabled(e.target.checked)}
          aria-label="Foods"
          className="h-3.5 w-3.5 rounded"
        />
        Foods
      </label>

      {isLoading && <p className="text-sm text-muted-foreground">{de.searchPanel.searching}</p>}

      {hasQuery && !isLoading && results?.length === 0 && (
        <p className="text-sm text-muted-foreground">{de.searchPanel.noResults(debouncedQuery)}</p>
      )}

      {onCreate && hasQuery && (
        <button
          type="button"
          onClick={() => onCreate(debouncedQuery.trim())}
          aria-label={de.aiRecipeImport.resolve.createTriggerAria(debouncedQuery.trim())}
          className="flex w-full items-center gap-3 rounded-md border border-dashed border-primary/60 bg-accent/40 px-3 py-3 text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-primary">
            +
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-primary">
              {de.aiRecipeImport.resolve.createTrigger(debouncedQuery.trim())}
            </span>
            <span className="block text-xs text-muted-foreground">{de.aiRecipeImport.resolve.createTriggerHint}</span>
          </span>
          <span aria-hidden="true" className="text-primary">
            ›
          </span>
        </button>
      )}

      {results && results.length > 0 && (
        <ul className="w-full min-w-0 divide-y">
          {results.map((result) => {
            const gated = disableUntracked && result.untracked === true;
            return (
              <li
                key={`${result.source}:${result.id}`}
                className="min-w-0"
                data-untracked={result.untracked === true || undefined}
              >
                <button
                  type="button"
                  onClick={() => onSelect(result)}
                  disabled={gated}
                  aria-disabled={gated || undefined}
                  className={`flex w-full min-w-0 items-center justify-between gap-2 py-2.5 text-left text-sm ${
                    gated ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-muted/50'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{result.name}</span>
                  <span className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                      {result.source}
                    </span>
                    {de.searchPanel.kcalPer(result.macrosPerUnit.calories, result.unit)}
                  </span>
                </button>
                {gated && <p className="px-0 pb-2 text-[11px] text-muted-foreground">{de.searchPanel.untrackedHint}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
