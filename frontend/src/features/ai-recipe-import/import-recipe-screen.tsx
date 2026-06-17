import { useState } from 'react';
import { AppHeader } from '../../components/app/app-header';
import { ErrorBanner } from '../../components/app/error-banner';
import { ImportNotConfiguredError } from '../../api/import-recipe-from-photos';
import type { RecipeDraft } from '../../domain/recipes';
import { de } from '../../i18n/de';
import { PhotoStaging, type StagedPhoto } from './photo-staging';
import { ReviewImportScreen } from './review-import-screen';
import { useImportRecipeFromPhotos } from './use-import-recipe-from-photos';

interface Props {
  onCancel: () => void;
  onSaved: () => void;
  /** Optional limits overrides (used by tests). */
  maxImages?: number;
  maxImageBytes?: number;
}

const DEFAULT_MAX_IMAGES = 8;
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ImportRecipeScreen({ onCancel, onSaved, maxImages, maxImageBytes }: Props) {
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const importMutation = useImportRecipeFromPhotos();

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

  const error =
    importMutation.error instanceof ImportNotConfiguredError
      ? new Error(de.aiRecipeImport.notConfigured)
      : importMutation.error;

  function handleSubmit() {
    if (photos.length === 0) return;
    importMutation.mutate(photos, {
      onSuccess: (newDraft) => setDraft(newDraft),
    });
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
          disabled={importMutation.isPending}
        />

        {error && <ErrorBanner error={error} />}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={photos.length === 0 || importMutation.isPending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {importMutation.isPending ? de.aiRecipeImport.submitting : de.aiRecipeImport.submit}
        </button>
      </div>
    </>
  );
}
