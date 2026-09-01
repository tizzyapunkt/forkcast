import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { useSearchIngredients, useSearchBarcode } from '../../queries/use-search-ingredients';
import type { IngredientSearchResult, IngredientSearchSource } from '../../domain/ingredient-search';
import { de } from '../../i18n/de';

// Lazy: @zxing/browser + @zxing/library only download once the user actually taps
// "scan", instead of shipping in every SearchPanel bundle (log drawer, recipe picker).
const BarcodeScanner = lazy(() => import('./barcode-scanner').then((m) => ({ default: m.BarcodeScanner })));
import { useLocalStorage } from '../../hooks/use-local-storage';
import { CaptureProductFlow } from '../extract-product-from-photos/capture-product-flow';
import { useProductCaptureConfigured } from '../extract-product-from-photos/use-product-capture-configured';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Banner } from '../../components/ui/banner';
import { FavoriteStar } from './favorite-star';
import { useFavorites, toFavoriteUnit } from './use-favorites';

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

/** Retired toggle keys. The catalog is always searched now, so neither may influence sources. */
const LEGACY_KEYS = ['forkcast:off-enabled', 'forkcast:foods-enabled'];
const OFF_KEY = 'forkcast:off-source-enabled';

function clearLegacyToggleKeys() {
  try {
    for (const key of LEGACY_KEYS) {
      if (localStorage.getItem(key) !== null) localStorage.removeItem(key);
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
    clearLegacyToggleKeys();
  }, []);
  const [offEnabled, setOffEnabled] = useLocalStorage<boolean>(OFF_KEY, false);
  // The user's own catalog is always searched; Open Food Facts is the opt-in extra.
  const sources: IngredientSearchSource[] = offEnabled ? ['CATALOG', 'OFF'] : ['CATALOG'];
  const { data: results, isLoading, isError } = useSearchIngredients(debouncedQuery, sources);
  const inputRef = useRef<HTMLInputElement>(null);

  const [scanState, setScanState] = useState<ScanState>({ mode: 'text' });
  const { isFavorite, toggle: toggleFavorite, error: favoriteError } = useFavorites();

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
    return (
      <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">{de.searchPanel.scannerLoading}</p>}>
        <BarcodeScanner onDetect={handleBarcodeDetected} onCancel={() => setScanState({ mode: 'text' })} />
      </Suspense>
    );
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
          <Button
            onClick={() => setScanState({ mode: 'capturing-product', barcode: notFoundBarcode })}
            aria-label={de.productCapture.ctaAria}
            className="w-full px-3"
          >
            {de.productCapture.cta}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{de.productCapture.notConfigured}</p>
        )}
        <Button variant="outline" onClick={() => setScanState({ mode: 'scanning' })} className="w-full px-3">
          {de.searchPanel.tryAgain}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex min-w-0 gap-2">
        <Input
          ref={inputRef}
          role="searchbox"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={de.searchPanel.placeholder}
          className="flex-1 appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
        />
        <Button
          variant="outline"
          aria-label={de.searchPanel.scanBarcode}
          onClick={() => setScanState({ mode: 'scanning' })}
          className="shrink-0 px-3"
        >
          📷
        </Button>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
        <input
          type="checkbox"
          checked={offEnabled}
          onChange={(e) => setOffEnabled(e.target.checked)}
          aria-label={de.searchPanel.offToggle}
          className="h-3.5 w-3.5 rounded-sm"
        />
        {de.searchPanel.offToggle}
      </label>

      {favoriteError && (
        <Banner tone="error" density="sm">
          {de.favoriteStar.failed}
        </Banner>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">{de.searchPanel.searching}</p>}

      {hasQuery && !isLoading && isError && <p className="text-sm text-destructive">{de.searchPanel.searchFailed}</p>}

      {hasQuery && !isLoading && !isError && results?.length === 0 && (
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
            <Plus aria-hidden="true" className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-primary">
              {de.aiRecipeImport.resolve.createTrigger(debouncedQuery.trim())}
            </span>
            <span className="block text-xs text-muted-foreground">{de.aiRecipeImport.resolve.createTriggerHint}</span>
          </span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
        </button>
      )}

      {results && results.length > 0 && (
        <ul className="w-full min-w-0 divide-y">
          {results.map((result) => {
            const gated = disableUntracked && result.untracked === true;
            // Gating gates the pick, never the star: favoriting a seasoning is
            // still useful for recipes.
            const favoritable = toFavoriteUnit(result.unit) !== null;
            return (
              <li
                key={`${result.source}:${result.id}`}
                className="min-w-0"
                data-untracked={result.untracked === true || undefined}
              >
                <div className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(result)}
                    disabled={gated}
                    aria-disabled={gated || undefined}
                    className={`flex min-w-0 flex-1 items-center justify-between gap-2 py-2.5 text-left text-sm ${
                      gated ? 'cursor-not-allowed text-muted-foreground' : 'hover:bg-muted/50'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{result.name}</span>
                    <span className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="rounded-sm px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                        {result.source}
                      </span>
                      {de.searchPanel.kcalPer(result.macrosPerUnit.calories, result.unit)}
                    </span>
                  </button>
                  {favoritable && (
                    <FavoriteStar
                      name={result.name}
                      favorited={isFavorite(result.name, result.unit)}
                      onToggle={() => toggleFavorite(result)}
                    />
                  )}
                </div>
                {gated && <p className="px-0 pb-2 text-[11px] text-muted-foreground">{de.searchPanel.untrackedHint}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
