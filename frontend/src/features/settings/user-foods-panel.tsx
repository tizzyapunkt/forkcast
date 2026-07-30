import { useUserFoodsOverlay, useExportUserFoods } from '../../queries/use-resolve-ingredients';
import type { UserFoodsOverlayExport } from '../../domain/food-resolution';
import { de } from '../../i18n/de';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

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
    <Card data-testid="user-foods-panel">
      <h3 className="text-sm font-semibold">{de.userFoods.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{de.userFoods.hint}</p>
      <p className="mt-2 text-xs font-medium">
        {count === 0 ? de.userFoods.countEmpty : de.userFoods.countLabel(count)}
      </p>
      <Button
        onClick={onExport}
        disabled={disabled}
        title={count === 0 ? de.userFoods.countEmpty : undefined}
        className="mt-3 w-full px-3"
      >
        {exportMutation.isPending ? de.userFoods.exporting : de.userFoods.exportButton}
      </Button>
      {exportMutation.isError && <p className="mt-2 text-xs text-destructive">{de.userFoods.exportError}</p>}
    </Card>
  );
}
