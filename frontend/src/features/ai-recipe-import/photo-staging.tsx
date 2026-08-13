import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImageOff, X } from 'lucide-react';
import type { SupportedImageMediaType } from '../../api/import-recipe-from-photos';
import { de } from '../../i18n/de';
import { Banner } from '../../components/ui/banner';
import { Button } from '../../components/ui/button';
import { prepareImageForUpload } from './prepare-image';

export interface StagedPhoto {
  id: string;
  file: File;
  mediaType: SupportedImageMediaType;
  previewUrl: string;
  sizeBytes: number;
}

interface Props {
  photos: StagedPhoto[];
  onChange: (next: StagedPhoto[]) => void;
  maxImages: number;
  maxImageBytes: number;
  /** Combined budget the server enforces for one request. */
  maxTotalBytes?: number;
  disabled?: boolean;
}

/** Mirrors `RECIPE_IMPORT_MAX_TOTAL_BYTES` in the backend config. */
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const SUPPORTED: SupportedImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

function isSupported(type: string): type is SupportedImageMediaType {
  return (SUPPORTED as string[]).includes(type);
}

function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

export function PhotoStaging({
  photos,
  onChange,
  maxImages,
  maxImageBytes,
  maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [brokenIds, setBrokenIds] = useState<string[]>([]);

  // Object URLs outlive any single render of `photos`, so the set of live URLs is tracked
  // separately: revoking straight from a `photos` effect kills previews of photos that are
  // still staged the moment the array changes (add, reorder, remove).
  const liveUrls = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const urls = liveUrls.current;
    return () => {
      mounted.current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  function releaseUrl(url: string) {
    if (!liveUrls.current.has(url)) return;
    liveUrls.current.delete(url);
    URL.revokeObjectURL(url);
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    if (inputRef.current) inputRef.current.value = '';

    const newErrors: string[] = [];
    const accepted: StagedPhoto[] = [];

    const remaining = maxImages - photos.length;
    if (incoming.length > remaining) newErrors.push(de.aiRecipeImport.tooManyImages(maxImages));

    let totalBytes = photos.reduce((sum, p) => sum + p.sizeBytes, 0);

    setPreparing(true);
    try {
      const allowedSlice = incoming.slice(0, Math.max(0, remaining));
      for (const [idx, file] of allowedSlice.entries()) {
        const positionInSet = photos.length + idx + 1;
        if (!isSupported(file.type)) {
          newErrors.push(de.aiRecipeImport.unsupportedType(file.type || 'unknown'));
          continue;
        }

        // Sequential on purpose: decoding eight 12 MP photos at once trips mobile memory limits.
        const prepared = await prepareImageForUpload(file);
        if (!mounted.current) return;

        if (prepared.size > maxImageBytes) {
          newErrors.push(de.aiRecipeImport.imageTooLarge(positionInSet, megabytes(maxImageBytes)));
          continue;
        }
        if (totalBytes + prepared.size > maxTotalBytes) {
          newErrors.push(de.aiRecipeImport.totalTooLarge(megabytes(maxTotalBytes)));
          break;
        }
        totalBytes += prepared.size;

        const previewUrl = URL.createObjectURL(prepared);
        liveUrls.current.add(previewUrl);
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: prepared,
          mediaType: isSupported(prepared.type) ? prepared.type : file.type,
          previewUrl,
          sizeBytes: prepared.size,
        });
      }
    } finally {
      if (mounted.current) setPreparing(false);
    }

    if (!mounted.current) return;
    setErrors(newErrors);
    if (accepted.length > 0) onChange([...photos, ...accepted]);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    const tmp = next[target];
    next[target] = next[index] as StagedPhoto;
    next[index] = tmp as StagedPhoto;
    onChange(next);
  }

  function remove(index: number) {
    const removed = photos[index];
    if (removed) {
      releaseUrl(removed.previewUrl);
      setBrokenIds((prev) => prev.filter((id) => id !== removed.id));
    }
    onChange(photos.filter((_, i) => i !== index));
  }

  const totalBytes = photos.reduce((sum, p) => sum + p.sizeBytes, 0);
  const busy = disabled || preparing;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {de.aiRecipeImport.photoCount(photos.length, maxImages)}
            {photos.length > 0 && ` · ${de.aiRecipeImport.photoTotalSize(formatMegabytes(totalBytes))}`}
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            {de.aiRecipeImport.photoHint(megabytes(maxImageBytes))}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy || photos.length >= maxImages}
          aria-label={photos.length === 0 ? de.aiRecipeImport.pickPhotosAria : de.aiRecipeImport.addMore}
        >
          {photos.length === 0 ? `+ ${de.aiRecipeImport.pickPhotos}` : `+ ${de.aiRecipeImport.addMore}`}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <p aria-live="polite" className="sr-only">
        {preparing ? de.aiRecipeImport.preparingPhotos : ''}
      </p>
      {preparing && (
        <p className="text-xs text-muted-foreground" data-testid="preparing-photos">
          {de.aiRecipeImport.preparingPhotos}
        </p>
      )}

      {errors.length > 0 && (
        <Banner tone="error" density="sm" onDismiss={() => setErrors([])} dismissLabel={de.aiRecipeImport.dismissHints}>
          <ul className="space-y-1">
            {errors.map((err, idx) => (
              <li key={idx} className="break-words">
                {err}
              </li>
            ))}
          </ul>
        </Banner>
      )}

      {photos.length > 0 && (
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, idx) => (
            <li
              key={photo.id}
              className="relative overflow-hidden rounded-md border bg-card"
              data-testid={`staged-photo-${idx}`}
            >
              {brokenIds.includes(photo.id) ? (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-muted px-2 text-center">
                  <ImageOff aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{de.aiRecipeImport.photoUnavailable}</span>
                </div>
              ) : (
                <img
                  src={photo.previewUrl}
                  alt={de.aiRecipeImport.photoAlt(idx + 1)}
                  onError={() => setBrokenIds((prev) => (prev.includes(photo.id) ? prev : [...prev, photo.id]))}
                  className="aspect-square w-full object-cover"
                />
              )}
              <span className="absolute top-1 left-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
                {idx + 1}
              </span>
              <div className="absolute right-1 bottom-1 flex gap-1">
                <Button
                  variant="scrim"
                  size="icon"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label={de.aiRecipeImport.moveUp(idx + 1)}
                >
                  <ArrowUp aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                  variant="scrim"
                  size="icon"
                  onClick={() => move(idx, 1)}
                  disabled={idx === photos.length - 1}
                  aria-label={de.aiRecipeImport.moveDown(idx + 1)}
                >
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                  variant="scrim"
                  size="icon"
                  onClick={() => remove(idx)}
                  aria-label={de.aiRecipeImport.removePhoto(idx + 1)}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
