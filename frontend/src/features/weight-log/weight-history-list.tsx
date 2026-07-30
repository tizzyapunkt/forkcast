import { useState } from 'react';
import type { WeightEntry } from '../../domain/weight-log';
import { useLogWeight } from '../../queries/use-log-weight';
import { useRemoveWeight } from '../../queries/use-remove-weight';
import { de } from '../../i18n/de';
import { parseDecimal } from '../../lib/decimal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

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
        <Input
          aria-label={de.weightLog.historyEditAria(entry.date)}
          type="text"
          inputMode="decimal"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          size="sm"
          className="flex-1"
        />
        <Button size="sm" onClick={commitEdit} disabled={logMutation.isPending} className="px-2">
          {de.weightLog.historySave}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMode('view')} className="px-2">
          {de.weightLog.historyCancel}
        </Button>
      </li>
    );
  }

  if (mode === 'confirm-delete') {
    return (
      <li className="flex items-center gap-2 p-2">
        <span className="w-28 text-sm tabular-nums text-muted-foreground">{entry.date}</span>
        <span className="flex-1 text-sm">{de.weightLog.historyDeleteConfirm}</span>
        <Button
          variant="destructive"
          size="sm"
          onClick={confirmDelete}
          disabled={removeMutation.isPending}
          className="px-2"
        >
          {de.weightLog.historyConfirmDelete}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMode('view')} className="px-2">
          {de.weightLog.historyCancel}
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 p-2">
      <span className="w-28 text-sm tabular-nums text-muted-foreground">{entry.date}</span>
      <span className="flex-1 text-sm font-medium tabular-nums">{entry.weightKg.toFixed(1)} kg</span>
      <Button
        variant="outline"
        size="sm"
        aria-label={de.weightLog.historyEditAria(entry.date)}
        onClick={() => {
          setDraft(entry.weightKg.toString());
          setMode('edit');
        }}
        className="px-2"
      >
        {de.weightLog.cardEdit}
      </Button>
      <Button
        variant="destructiveOutline"
        size="sm"
        aria-label={de.weightLog.historyDeleteAria(entry.date)}
        onClick={() => setMode('confirm-delete')}
        className="border-destructive/50 px-2"
      >
        {de.weightLog.historyConfirmDelete}
      </Button>
    </li>
  );
}
