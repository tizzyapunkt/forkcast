import { useState } from 'react';
import { exportCatalog } from '../../api/catalog';
import { useCatalog } from '../../queries/use-catalog';
import type { CatalogEntry } from '../../domain/food-catalog';
import { de } from '../../i18n/de';

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
    <section data-testid="catalog-panel" className="rounded-md border border-input bg-card p-4">
      <h3 className="text-sm font-semibold">{t.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <p className="mt-2 text-xs font-medium">{t.countLabel(count)}</p>

      <button
        type="button"
        onClick={onManage}
        className="mt-3 flex w-full items-center justify-between rounded-md border border-input px-3 py-2 text-left text-sm hover:bg-accent"
      >
        <span className="font-medium">{t.manageLink}</span>
        <span aria-hidden="true">→</span>
      </button>

      <button
        type="button"
        onClick={() => void onExport()}
        disabled={exporting}
        className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {t.exportButton}
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">{t.exportHint}</p>
      {failed && <p className="mt-2 text-xs text-destructive">{t.exportError}</p>}
    </section>
  );
}
