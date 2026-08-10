import { useState } from 'react';
import { exportCatalog } from '../../api/catalog';
import { useCatalog } from '../../queries/use-catalog';
import type { CatalogEntry } from '../../domain/food-catalog';
import { de } from '../../i18n/de';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

const t = de.catalog;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function buildFilename(now: Date): string {
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  return `catalog-${stamp}.json`;
}

function download(entries: CatalogEntry[], now: Date): void {
  const blob = new Blob([JSON.stringify(entries, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFilename(now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface CatalogPanelProps {
  onManage: () => void;
}

/**
 * Settings entry point for the food catalog: how many entries it holds, a way
 * into the manager, and a snapshot download. The snapshot is a copy — unlike the
 * overlay export it replaces, it never drains the catalog.
 */
export function CatalogPanel({ onManage }: CatalogPanelProps) {
  const catalog = useCatalog();
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);

  const count = catalog.data?.length ?? 0;

  async function onExport() {
    setExporting(true);
    setFailed(false);
    try {
      download(await exportCatalog(), new Date());
    } catch {
      setFailed(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card data-testid="catalog-panel">
      <h3 className="text-sm font-semibold">{t.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <p className="mt-2 text-xs font-medium">{t.countLabel(count)}</p>

      <Button variant="outline" onClick={onManage} className="mt-3 w-full justify-between px-3 text-left">
        <span className="font-medium">{t.manageLink}</span>
        <span aria-hidden="true">→</span>
      </Button>

      <Button variant="outline" onClick={() => void onExport()} disabled={exporting} className="mt-2 w-full px-3">
        {t.exportButton}
      </Button>
      <p className="mt-1 text-[11px] text-muted-foreground">{t.exportHint}</p>
      {failed && <p className="mt-2 text-xs text-destructive">{t.exportError}</p>}
    </Card>
  );
}
