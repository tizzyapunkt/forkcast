import { useState } from 'react';
import { useClearUnmatchedIngredients, useUnmatchedIngredients } from '../../queries/use-unmatched-ingredients';
import type { UnmatchedIngredientEntry } from '../../api/unmatched-ingredients';
import { de } from '../../i18n/de';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function buildFilename(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mi = pad2(now.getMinutes());
  return `unmatched-ingredients-${yyyy}${mm}${dd}-${hh}${mi}.json`;
}

function downloadEntries(entries: UnmatchedIngredientEntry[], now: Date): void {
  const blob = new Blob([JSON.stringify({ entries }, null, 2) + '\n'], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFilename(now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function UnmatchedIngredientsPanel() {
  const query = useUnmatchedIngredients();
  const clearMutation = useClearUnmatchedIngredients();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const entries = query.data ?? [];
  const count = entries.length;
  const disabled = count === 0;

  const onExport = (): void => {
    if (disabled) return;
    downloadEntries(entries, new Date());
  };

  const onClearClick = (): void => {
    if (disabled) return;
    setConfirmOpen(true);
  };

  const onConfirmClear = async (): Promise<void> => {
    await clearMutation.mutateAsync();
    setConfirmOpen(false);
  };

  const countLabel = count === 0 ? de.unmatchedIngredients.countEmpty : de.unmatchedIngredients.countLabel(count);

  return (
    <section data-testid="unmatched-ingredients-panel" className="rounded-md border border-input bg-card p-4">
      <h3 className="text-sm font-semibold">{de.unmatchedIngredients.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{de.unmatchedIngredients.hint}</p>
      <p className="mt-2 text-sm" aria-live="polite">
        {countLabel}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={disabled}
          title={disabled ? de.unmatchedIngredients.exportTooltipEmpty : undefined}
          className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {de.unmatchedIngredients.exportButton}
        </button>
        <button
          type="button"
          onClick={onClearClick}
          disabled={disabled || clearMutation.isPending}
          title={disabled ? de.unmatchedIngredients.clearTooltipEmpty : undefined}
          className="rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {de.unmatchedIngredients.clearButton}
        </button>
      </div>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unmatched-confirm-title"
          data-testid="unmatched-ingredients-confirm"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="w-full max-w-sm rounded-md bg-card p-4 shadow-lg">
            <h4 id="unmatched-confirm-title" className="text-sm font-semibold">
              {de.unmatchedIngredients.confirmTitle}
            </h4>
            <p className="mt-2 text-sm text-muted-foreground">{de.unmatchedIngredients.confirmBody(count)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={clearMutation.isPending}
                className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
              >
                {de.unmatchedIngredients.confirmCancel}
              </button>
              <button
                type="button"
                onClick={() => void onConfirmClear()}
                disabled={clearMutation.isPending}
                className="rounded-md border border-destructive bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                {de.unmatchedIngredients.confirmConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
