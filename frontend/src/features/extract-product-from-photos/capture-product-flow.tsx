import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';
import type { IngredientSearchResult } from '../../domain/ingredient-search';
import { PhotoStaging, type StagedPhoto } from '../ai-recipe-import/photo-staging';
import { ProductCaptureNotConfiguredError, type ProductDraft } from '../../api/extract-product-from-photos';
import { ProductReviewForm } from './product-review-form';
import { useExtractProduct } from './use-extract-product';
import { useSaveScannedProduct } from './use-save-scanned-product';
import { Button } from '../../components/ui/button';

interface Props {
  barcode: string;
  onCancel: () => void;
  onCaptured: (result: IngredientSearchResult) => void;
  maxImages?: number;
  maxImageBytes?: number;
}

const DEFAULT_MAX_IMAGES = 8;
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Capture flow shown after a barcode miss: stage packaging photos → extract a
 * product draft via AI → review/edit → save and hand the result to the caller
 * for logging.
 */
export function CaptureProductFlow({ barcode, onCancel, onCaptured, maxImages, maxImageBytes }: Props) {
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const extractMutation = useExtractProduct();
  const saveMutation = useSaveScannedProduct();

  if (draft) {
    return (
      <ProductReviewForm
        draft={draft}
        isSaving={saveMutation.isPending}
        error={saveMutation.error}
        onBack={() => {
          setDraft(null);
          saveMutation.reset();
        }}
        onConfirm={(edited) => {
          saveMutation.mutate(
            { barcode: edited.barcode, name: edited.name, unit: edited.unit, macrosPer100: edited.macrosPer100 },
            { onSuccess: (result) => onCaptured(result) },
          );
        }}
      />
    );
  }

  const extractError =
    extractMutation.error instanceof ProductCaptureNotConfiguredError
      ? new Error(de.productCapture.notConfigured)
      : extractMutation.error;

  function handleExtract() {
    if (photos.length === 0) return;
    extractMutation.mutate({ barcode, photos }, { onSuccess: (d) => setDraft(d) });
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="-ml-2 flex items-center gap-1 rounded-md py-2 pr-2 pl-1 text-sm text-muted-foreground hover:text-foreground"
          aria-label={de.productCapture.back}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {de.productCapture.back}
        </button>
        <span className="w-12" />
      </div>

      <p className="text-sm text-muted-foreground">{de.productCapture.intro}</p>

      <PhotoStaging
        photos={photos}
        onChange={setPhotos}
        maxImages={maxImages ?? DEFAULT_MAX_IMAGES}
        maxImageBytes={maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES}
        disabled={extractMutation.isPending}
      />

      {extractError && <ErrorBanner error={extractError} />}

      <Button onClick={handleExtract} disabled={photos.length === 0 || extractMutation.isPending} className="w-full">
        {extractMutation.isPending ? de.productCapture.extracting : de.productCapture.extract}
      </Button>
    </div>
  );
}
