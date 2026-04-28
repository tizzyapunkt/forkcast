import type { LogEntry } from '../../domain/meal-log';
import { useScrollLock } from '../../hooks/use-scroll-lock';
import { useRemoveLogEntry } from '../../queries/use-remove-log-entry';
import { ErrorBanner } from '../../components/app/error-banner';

interface RemoveEntryConfirmProps {
  entry: LogEntry;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveEntryConfirm({ entry, onConfirm, onCancel }: RemoveEntryConfirmProps) {
  useScrollLock(true);
  const { mutate, isPending, error } = useRemoveLogEntry();

  const label = entry.ingredient.type === 'quick' ? entry.ingredient.label : entry.ingredient.name;

  function handleRemove() {
    mutate({ id: entry.id, date: entry.date }, { onSuccess: onConfirm });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Remove entry"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-background p-6 shadow-lg space-y-4">
        {error && <ErrorBanner error={error} />}
        <div>
          <h2 className="font-semibold">Remove entry?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Remove <span className="font-medium">{label}</span> from your log?
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="flex-1 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
          >
            {isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
