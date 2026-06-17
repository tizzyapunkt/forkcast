import { useState } from 'react';
import type { WeightEntry } from '../../domain/weight-log';
import { useLogWeight } from '../../queries/use-log-weight';
import { useRemoveWeight } from '../../queries/use-remove-weight';
import { de } from '../../i18n/de';
import { parseDecimal } from '../../lib/decimal';

interface WeightHistoryListProps {
  entries: WeightEntry[];
}

export function WeightHistoryList({ entries }: WeightHistoryListProps) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section aria-label={de.weightLog.historyTitle} className="space-y-2">
      <h3 className="text-sm font-semibold">{de.weightLog.historyTitle}</h3>
      {sorted.length === 0 ? (
        <p className="rounded-md border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
          {de.weightLog.historyEmpty}
        </p>
      ) : (
        <ul className="divide-y rounded-md border border-input">
          {sorted.map((entry) => (
            <HistoryRow key={entry.date} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({ entry }: { entry: WeightEntry }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view');
  const [draft, setDraft] = useState(entry.weightKg.toString());
  const logMutation = useLogWeight();
  const removeMutation = useRemoveWeight();

  function commitEdit() {
    const parsed = parseDecimal(draft);
    if (parsed === null || parsed <= 0) {
      setMode('view');
      return;
    }
    logMutation.mutate({ date: entry.date, weightKg: parsed }, { onSuccess: () => setMode('view') });
  }

  function confirmDelete() {
    removeMutation.mutate(entry.date, { onSuccess: () => setMode('view') });
  }

  if (mode === 'edit') {
    return (
      <li className="flex items-center gap-2 p-2">
        <span className="w-28 text-sm tabular-nums text-muted-foreground">{entry.date}</span>
        <input
          aria-label={de.weightLog.historyEditAria(entry.date)}
          type="text"
          inputMode="decimal"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded-md border border-input px-2 py-1 text-base sm:text-sm"
        />
        <button
          type="button"
          onClick={commitEdit}
          disabled={logMutation.isPending}
          className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {de.weightLog.historySave}
        </button>
        <button type="button" onClick={() => setMode('view')} className="rounded-md border px-2 py-1 text-xs">
          {de.weightLog.historyCancel}
        </button>
      </li>
    );
  }

  if (mode === 'confirm-delete') {
    return (
      <li className="flex items-center gap-2 p-2">
        <span className="w-28 text-sm tabular-nums text-muted-foreground">{entry.date}</span>
        <span className="flex-1 text-sm">{de.weightLog.historyDeleteConfirm}</span>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={removeMutation.isPending}
          className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50"
        >
          {de.weightLog.historyConfirmDelete}
        </button>
        <button type="button" onClick={() => setMode('view')} className="rounded-md border px-2 py-1 text-xs">
          {de.weightLog.historyCancel}
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 p-2">
      <span className="w-28 text-sm tabular-nums text-muted-foreground">{entry.date}</span>
      <span className="flex-1 text-sm font-medium tabular-nums">{entry.weightKg.toFixed(1)} kg</span>
      <button
        type="button"
        aria-label={de.weightLog.historyEditAria(entry.date)}
        onClick={() => {
          setDraft(entry.weightKg.toString());
          setMode('edit');
        }}
        className="rounded-md border px-2 py-1 text-xs"
      >
        {de.weightLog.cardEdit}
      </button>
      <button
        type="button"
        aria-label={de.weightLog.historyDeleteAria(entry.date)}
        onClick={() => setMode('confirm-delete')}
        className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive"
      >
        {de.weightLog.historyConfirmDelete}
      </button>
    </li>
  );
}
