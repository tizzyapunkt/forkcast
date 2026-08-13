import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppHeader } from '../../components/app/app-header';
import type { RecipeDraft } from '../../domain/recipes';
import { de } from '../../i18n/de';
import { describeImportFailure, ImportCancelledError, ImportTimeoutError } from './import-failure';
import { PhotoStaging, type StagedPhoto } from './photo-staging';
import { ReviewImportScreen } from './review-import-screen';
import { IMPORT_TIMEOUT_MS, useImportRecipeFromPhotos } from './use-import-recipe-from-photos';
import { Banner } from '../../components/ui/banner';
import { Button } from '../../components/ui/button';

interface Props {
  onCancel: () => void;
  onSaved: () => void;
  /** Optional limits overrides (used by tests). */
  maxImages?: number;
  maxImageBytes?: number;
  maxTotalBytes?: number;
}

// Mirrors the server defaults in `backend/src/config/app-config.ts`; the server stays the
// authority, these keep the user from waiting through an upload it will reject.
const DEFAULT_MAX_IMAGES = 8;
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export function ImportRecipeScreen({ onCancel, onSaved, maxImages, maxImageBytes, maxTotalBytes }: Props) {
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const importMutation = useImportRecipeFromPhotos();
  const controllerRef = useRef<AbortController | null>(null);

  // Abort the request when the screen goes away — an orphaned vision call otherwise keeps
  // the tab's connection open and resolves into an unmounted component.
  useEffect(() => {
    return () => controllerRef.current?.abort(new ImportCancelledError());
  }, []);

  if (draft) {
    return (
      <ReviewImportScreen
        draft={draft}
        photos={photos}
        onSaved={onSaved}
        onCancel={() => {
          setDraft(null);
          setPhotos([]);
        }}
      />
    );
  }

  const isPending = importMutation.isPending;
  const failure =
    importMutation.error && !(importMutation.error instanceof ImportCancelledError)
      ? describeImportFailure(importMutation.error)
      : null;

  function startImport() {
    if (photos.length === 0 || isPending) return;
    controllerRef.current?.abort(new ImportCancelledError());

    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(new ImportTimeoutError()), IMPORT_TIMEOUT_MS);

    importMutation.mutate(
      { photos, signal: controller.signal },
      {
        onSuccess: (newDraft) => setDraft(newDraft),
        onSettled: () => {
          window.clearTimeout(timer);
          if (controllerRef.current === controller) controllerRef.current = null;
        },
      },
    );
  }

  function cancelImport() {
    controllerRef.current?.abort(new ImportCancelledError());
    controllerRef.current = null;
    importMutation.reset();
  }

  return (
    <>
      <AppHeader title={de.aiRecipeImport.screenTitle} onBack={onCancel} backAria={de.aiRecipeImport.back} />
      <div className="space-y-4 p-4">
        <PhotoStaging
          photos={photos}
          onChange={setPhotos}
          maxImages={maxImages ?? DEFAULT_MAX_IMAGES}
          maxImageBytes={maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES}
          maxTotalBytes={maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES}
          disabled={isPending}
        />

        {failure && (
          <Banner
            tone="error"
            hint={failure.hint}
            action={
              failure.canRetry ? (
                <Button variant="outline" size="sm" onClick={startImport} disabled={photos.length === 0}>
                  {de.aiRecipeImport.failure.retry}
                </Button>
              ) : undefined
            }
          >
            {failure.message}
          </Banner>
        )}

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button onClick={startImport} disabled={photos.length === 0 || isPending} className="flex-1">
              {isPending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {isPending ? de.aiRecipeImport.submitting : de.aiRecipeImport.submit}
            </Button>
            {isPending && (
              <Button variant="outline" onClick={cancelImport} aria-label={de.aiRecipeImport.cancelImport}>
                {de.aiRecipeImport.cancel}
              </Button>
            )}
          </div>
          {isPending && (
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {de.aiRecipeImport.submitHint}
            </p>
          )}
          {!isPending && photos.length === 0 && (
            <p className="text-xs text-muted-foreground">{de.aiRecipeImport.emptySelection}</p>
          )}
        </div>
      </div>
    </>
  );
}
