import { useMemo, useState } from 'react';
import { AppHeader } from '../../components/app/app-header';
import { ErrorBanner } from '../../components/app/error-banner';
import { ListSkeleton } from '../../components/app/loading-skeleton';
import { BottomSheet } from '../../components/app/bottom-sheet';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { CatalogEntryEditor } from './catalog-entry-editor';
import {
  useAddCatalogEntry,
  useCatalog,
  useRemoveCatalogEntry,
  useUpdateCatalogEntry,
} from '../../queries/use-catalog';
import { ApiError } from '../../api/client';
import { de } from '../../i18n/de';
import type { CatalogEntry, CatalogEntryDraft } from '../../domain/food-catalog';

const t = de.catalog;

/** Same folding rule as the backend search, so the filter matches what the picker would find. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

type EditorState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; entry: CatalogEntry };

interface CatalogManagerScreenProps {
  onBack: () => void;
}

export function CatalogManagerScreen({ onBack }: CatalogManagerScreenProps) {
  const catalog = useCatalog();
  const [filter, setFilter] = useState('');
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [pendingDelete, setPendingDelete] = useState<CatalogEntry | null>(null);

  const addMutation = useAddCatalogEntry();
  const updateMutation = useUpdateCatalogEntry();
  const removeMutation = useRemoveCatalogEntry();

  const entries = useMemo(() => [...(catalog.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [catalog.data]);

  const visible = useMemo(() => {
    const q = fold(filter.trim());
    if (q.length === 0) return entries;
    return entries.filter((e) => fold(e.name).includes(q) || e.synonyms.some((synonym) => fold(synonym).includes(q)));
  }, [entries, filter]);

  const header = <AppHeader title={t.managerTitle} onBack={onBack} backAria={t.backAria} />;

  if (catalog.isLoading) {
    return (
      <>
        {header}
        <div className="space-y-3 p-4">
          <ListSkeleton rows={5} />
        </div>
      </>
    );
  }

  if (catalog.error) {
    return (
      <>
        {header}
        <div className="space-y-3 p-4">
          <ErrorBanner error={catalog.error} />
        </div>
      </>
    );
  }

  const activeMutation = editor.mode === 'edit' ? updateMutation : addMutation;
  const saveError = activeMutation.error;
  const duplicateId = saveError instanceof ApiError ? existingIdFrom(saveError) : undefined;

  function closeEditor() {
    setEditor({ mode: 'closed' });
    addMutation.reset();
    updateMutation.reset();
  }

  function save(draft: CatalogEntryDraft) {
    if (editor.mode === 'edit') {
      updateMutation.mutate({ id: editor.entry.id, entry: draft }, { onSuccess: closeEditor });
    } else {
      addMutation.mutate(draft, { onSuccess: closeEditor });
    }
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    removeMutation.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        closeEditor();
      },
    });
  }

  return (
    <>
      {header}
      <div className="flex flex-col gap-3 p-4">
        <Input
          role="searchbox"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={t.filterLabel}
          placeholder={t.filterPlaceholder}
          className="h-11 w-full appearance-none py-0"
        />

        <Button onClick={() => setEditor({ mode: 'create' })} className="h-11 w-full py-0 font-semibold">
          {t.addEntry}
        </Button>

        <p className="text-xs text-muted-foreground">{t.countLabel(entries.length)}</p>

        {entries.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
        {entries.length > 0 && visible.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.noMatches(filter.trim())}</p>
        )}

        <ul className="w-full divide-y">
          {visible.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setEditor({ mode: 'edit', entry })}
                aria-label={t.entryAria(entry.name)}
                className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.untracked === true ? t.untrackedBadge : t.kcalPer100(entry.macrosPer100.calories, entry.unit)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <BottomSheet
        open={editor.mode !== 'closed'}
        onClose={closeEditor}
        ariaLabel={editor.mode === 'edit' ? t.editorTitleEdit : t.editorTitleNew}
      >
        {editor.mode !== 'closed' && (
          <>
            <div className="shrink-0 px-4 pt-3 pb-1">
              <h2 className="truncate text-sm font-semibold">
                {editor.mode === 'edit' ? t.editorTitleEdit : t.editorTitleNew}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CatalogEntryEditor
                key={editor.mode === 'edit' ? editor.entry.id : 'create'}
                entry={editor.mode === 'edit' ? editor.entry : null}
                onSave={save}
                onCancel={closeEditor}
                onDelete={editor.mode === 'edit' ? () => setPendingDelete(editor.entry) : undefined}
                pending={activeMutation.isPending}
                error={saveError instanceof Error ? saveError.message : null}
                duplicateAction={
                  duplicateId !== undefined ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const existing = entries.find((e) => e.id === duplicateId);
                        if (existing) {
                          addMutation.reset();
                          setEditor({ mode: 'edit', entry: existing });
                        }
                      }}
                      className="self-start p-0"
                    >
                      {t.duplicateOpen}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          </>
        )}
      </BottomSheet>

      <BottomSheet
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        ariaLabel={t.deleteConfirmTitle}
      >
        {pendingDelete && (
          <div className="flex flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold">{t.deleteConfirmTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.deleteConfirmBody(pendingDelete.name)}</p>
            {removeMutation.isError && <p className="text-sm text-destructive">{t.deleteError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPendingDelete(null)} className="h-12 flex-1 py-0">
                {t.deleteCancel}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={removeMutation.isPending}
                className="h-12 flex-[1.5] py-0 font-semibold"
              >
                {t.deleteConfirm}
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

/**
 * A rejected save names the entry it collided with, so the manager can offer to
 * open that one instead of leaving the user to hunt for it.
 */
function existingIdFrom(error: ApiError): string | undefined {
  const body = error.body as { code?: string; existingId?: string } | undefined;
  return body?.code === 'catalog-entry-exists' ? body.existingId : undefined;
}
