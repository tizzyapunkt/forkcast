import { useState } from 'react';
import { Check, Copy, ShoppingBasket } from 'lucide-react';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { Button } from '../../components/ui/button';
import { useGroceryList } from '../../queries/use-grocery-list';
import { mintBringImportToken } from '../../api/bring-import-token';
import { groceryItemKey, type GroceryItem } from '../../domain/grocery-list';
import { de } from '../../i18n/de';

interface GroceryListSheetProps {
  startDate: string;
  rangeLabel: string;
  onClose: () => void;
  /** Injected in tests; the browser clipboard otherwise. */
  writeClipboard?: (text: string) => Promise<void>;
  /** Injected in tests; a same-tab navigation otherwise (a popup after an await would be blocked). */
  openUrl?: (url: string) => void;
}

function defaultWriteClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function defaultOpenUrl(url: string): void {
  window.location.assign(url);
}

const BRING_DEEPLINK = 'https://api.getbring.com/rest/bringrecipes/deeplink';

/**
 * Bring!'s servers fetch the import page from the origin the app is opened on (the public tunnel
 * domain). forkcast has already scaled every amount, so both quantities are 1.
 */
function bringDeeplink(token: string): string {
  const params = new URLSearchParams({
    url: `${window.location.origin}/api/bring-import/${token}`,
    source: 'web',
    baseQuantity: '1',
    requestedQuantity: '1',
  });
  return `${BRING_DEEPLINK}?${params.toString()}`;
}

function quantity(item: GroceryItem): string | null {
  if (item.amount <= 0) return null;
  const amount = `${item.amount} ${de.groceryList.units[item.unit]}`;
  return item.pieceHint ? `${amount} · ${de.groceryList.pieceHint(item.pieceHint.count)}` : amount;
}

/** One clipboard line: "Zwiebel — 380 g (≈ 3 Stück)", or just the name when there is no amount. */
function clipboardLine(item: GroceryItem): string {
  if (item.amount <= 0) return item.name;
  const line = `${item.name} — ${item.amount} ${de.groceryList.units[item.unit]}`;
  return item.pieceHint ? `${line} (${de.groceryList.pieceHint(item.pieceHint.count)})` : line;
}

function weekdays(dates: string[]): string {
  return dates
    .map((iso) => {
      const jsDay = new Date(iso + 'T00:00:00').getDay(); // 0 = Sunday
      return de.planner.weekdays[jsDay === 0 ? 6 : jsDay - 1];
    })
    .join(', ');
}

/**
 * The week's grocery list for review before shopping. Every item starts checked; unticking what is
 * already at home lives only as long as the sheet — nothing is stored.
 */
export function GroceryListSheet({
  startDate,
  rangeLabel,
  onClose,
  writeClipboard = defaultWriteClipboard,
  openUrl = defaultOpenUrl,
}: GroceryListSheetProps) {
  const { data: list, isLoading, error } = useGroceryList(startDate);
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [bringState, setBringState] = useState<'idle' | 'pending' | 'failed'>('idle');

  const items = list?.items ?? [];
  const checked = items.filter((item) => !unticked.has(groceryItemKey(item)));
  const tracked = items.filter((item) => !item.untracked);
  const untracked = items.filter((item) => item.untracked);

  function toggle(item: GroceryItem) {
    const key = groceryItemKey(item);
    setCopyState('idle');
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function copy() {
    try {
      await writeClipboard(checked.map(clipboardLine).join('\n'));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  async function sendToBring() {
    setBringState('pending');
    try {
      const { token } = await mintBringImportToken({ startDate, excluded: [...unticked] });
      openUrl(bringDeeplink(token));
      setBringState('idle');
    } catch {
      setBringState('failed');
    }
  }

  function renderItem(item: GroceryItem) {
    const key = groceryItemKey(item);
    const amount = quantity(item);
    return (
      <li key={key}>
        <label className="flex cursor-pointer items-start gap-3 py-2.5">
          <input
            type="checkbox"
            checked={!unticked.has(key)}
            onChange={() => toggle(item)}
            aria-label={de.groceryList.itemAria(item.name)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-baseline justify-between gap-2">
              <span data-name className="min-w-0 truncate text-sm font-medium">
                {item.name}
              </span>
              {amount && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{amount}</span>}
            </span>
            <span className="text-xs text-muted-foreground">{weekdays(item.dates)}</span>
          </span>
        </label>
      </li>
    );
  }

  const title = de.groceryList.title(rangeLabel);

  return (
    <BottomSheet open onClose={onClose} ariaLabel={de.groceryList.dialogAria}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
        >
          {de.groceryList.close}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {error && <ErrorBanner error={error} />}
        {isLoading && <ListSkeleton />}
        {list && items.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{de.groceryList.empty}</p>
        )}
        {tracked.length > 0 && <ul className="divide-y">{tracked.map(renderItem)}</ul>}
        {untracked.length > 0 && (
          <section className="pt-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {de.groceryList.untrackedHeading}
            </h3>
            <ul className="divide-y">{untracked.map(renderItem)}</ul>
          </section>
        )}
        {list && list.skippedQuickEntries > 0 && (
          <p className="py-3 text-xs text-muted-foreground">{de.groceryList.skippedQuick(list.skippedQuickEntries)}</p>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t px-4 pt-3 pb-4">
        {copyState === 'copied' && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-success-ink">
            <Check size={14} aria-hidden="true" />
            {de.groceryList.copied}
          </p>
        )}
        {copyState === 'failed' && (
          <p role="alert" className="text-xs text-destructive">
            {de.groceryList.copyFailed}
          </p>
        )}
        {bringState === 'failed' && (
          <p role="alert" className="text-xs text-destructive">
            {de.groceryList.bringFailed}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={copy} disabled={checked.length === 0} className="shrink-0">
            <Copy size={16} aria-hidden="true" />
            {de.groceryList.copy}
          </Button>
          <Button
            onClick={sendToBring}
            disabled={checked.length === 0 || bringState === 'pending'}
            className="min-w-0 flex-1"
          >
            <ShoppingBasket size={16} aria-hidden="true" />
            {bringState === 'pending' ? de.groceryList.sendingToBring : de.groceryList.sendToBring}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
