import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchIngredients, useSearchBarcode } from '../../queries/use-search-ingredients';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import { BarcodeScanner } from './barcode-scanner';
import { de } from '../../i18n/de';

interface SearchPanelProps {
  onSelect: (result: IngredientSearchResult) => void;
}

type ScanState =
  | { mode: 'text' }
  | { mode: 'scanning' }
  | { mode: 'barcode-loading'; barcode: string }
  | { mode: 'barcode-not-found' };

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function SearchPanel({ onSelect }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: results, isLoading } = useSearchIngredients(debouncedQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const [scanState, setScanState] = useState<ScanState>({ mode: 'text' });

  const barcodeToLookup = scanState.mode === 'barcode-loading' ? scanState.barcode : '';
  const {
    data: barcodeResult,
    isLoading: barcodeLoading,
    isSuccess: barcodeSuccess,
  } = useSearchBarcode(barcodeToLookup);

  useEffect(() => {
    if (scanState.mode !== 'barcode-loading') return;
    if (barcodeLoading) return;
    if (!barcodeSuccess) return;
    if (barcodeResult) {
      onSelect(barcodeResult);
    } else {
      setScanState({ mode: 'barcode-not-found' });
    }
  }, [barcodeLoading, barcodeSuccess, barcodeResult, scanState.mode, onSelect]);

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

  if (scanState.mode === 'barcode-not-found') {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-destructive">{de.searchPanel.notFound}</p>
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

      {isLoading && <p className="text-sm text-muted-foreground">{de.searchPanel.searching}</p>}

      {hasQuery && !isLoading && results?.length === 0 && (
        <p className="text-sm text-muted-foreground">{de.searchPanel.noResults(debouncedQuery)}</p>
      )}

      {results && results.length > 0 && (
        <ul className="w-full min-w-0 divide-y">
          {results.map((result) => (
            <li key={`${result.source}:${result.id}`} className="min-w-0">
              <button
                onClick={() => onSelect(result)}
                className="flex w-full min-w-0 items-center justify-between gap-2 py-2.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{result.name}</span>
                <span className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                    {result.source}
                  </span>
                  {de.searchPanel.kcalPer(result.macrosPerUnit.calories, result.unit)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
