import { useUserFoodsOverlay, useExportUserFoods } from '../../queries/use-resolve-ingredients';
import type { UserFoodsOverlayExport } from '../../domain/food-resolution';
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
  return `user-foods-${yyyy}${mm}${dd}-${hh}${mi}.json`;
}

function download(content: UserFoodsOverlayExport, now: Date): void {
  const blob = new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFilename(now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function UserFoodsPanel() {
  const overlay = useUserFoodsOverlay();
  const exportMutation = useExportUserFoods();

  const count = overlay.data ? overlay.data.foods.length + overlay.data.synonyms.length : 0;
  const disabled = count === 0 || exportMutation.isPending;

  const onExport = (): void => {
    if (count === 0) return;
    exportMutation.mutate(undefined, {
      onSuccess: (content) => download(content, new Date()),
    });
  };

  return (
    <section data-testid="user-foods-panel" className="rounded-md border border-input bg-card p-4">
      <h3 className="text-sm font-semibold">{de.userFoods.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{de.userFoods.hint}</p>
      <p className="mt-2 text-xs font-medium">
        {count === 0 ? de.userFoods.countEmpty : de.userFoods.countLabel(count)}
      </p>
      <button
        type="button"
        onClick={onExport}
        disabled={disabled}
        title={count === 0 ? de.userFoods.countEmpty : undefined}
        className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {exportMutation.isPending ? de.userFoods.exporting : de.userFoods.exportButton}
      </button>
      {exportMutation.isError && <p className="mt-2 text-xs text-destructive">{de.userFoods.exportError}</p>}
    </section>
  );
}
