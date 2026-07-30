import type { LogEntry } from '../../domain/meal-log';
import { useScrollLock } from '../../hooks/use-scroll-lock';
import { Portal } from '../../components/app/portal';
import { useRemoveLogEntry } from '../../queries/use-remove-log-entry';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';
import { Button } from '../../components/ui/button';

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
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={de.removeEntry.dialogAria}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="fixed inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
        <div className="relative z-10 w-full max-w-sm rounded-xl bg-background p-6 shadow-lg space-y-4">
          {error && <ErrorBanner error={error} />}
          <div>
            <h2 className="font-semibold">{de.removeEntry.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium">„{label}“</span>
              {de.removeEntry.descriptionAfterLabel}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              {de.removeEntry.cancel}
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={isPending} className="flex-1">
              {isPending ? de.removeEntry.removing : de.removeEntry.remove}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
