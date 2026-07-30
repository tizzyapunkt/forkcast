import { useEffect, useRef, useState } from 'react';
import type { SupportedImageMediaType } from '../../api/import-recipe-from-photos';
import { de } from '../../i18n/de';
import { Button } from '../../components/ui/button';

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
  disabled?: boolean;
}

const SUPPORTED: SupportedImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

function isSupported(type: string): type is SupportedImageMediaType {
  return (SUPPORTED as string[]).includes(type);
}

export function PhotoStaging({ photos, onChange, maxImages, maxImageBytes, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [photos]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    const newErrors: string[] = [];
    const accepted: StagedPhoto[] = [];

    const remaining = maxImages - photos.length;
    if (incoming.length > remaining) {
      newErrors.push(de.aiRecipeImport.tooManyImages(maxImages));
    }
    const allowedSlice = incoming.slice(0, remaining);

    allowedSlice.forEach((file, idx) => {
      const idxAcrossSet = photos.length + idx + 1;
      if (!isSupported(file.type)) {
        newErrors.push(de.aiRecipeImport.unsupportedType(file.type || 'unknown'));
        return;
      }
      if (file.size > maxImageBytes) {
        newErrors.push(de.aiRecipeImport.imageTooLarge(idxAcrossSet, Math.round(maxImageBytes / (1024 * 1024))));
        return;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        mediaType: file.type,
        previewUrl: URL.createObjectURL(file),
        sizeBytes: file.size,
      });
    });

    setErrors(newErrors);
    if (accepted.length > 0) onChange([...photos, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
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
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{de.aiRecipeImport.photoCount(photos.length, maxImages)}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || photos.length >= maxImages}
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
        onChange={(e) => handleFiles(e.target.files)}
      />

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-md border border-destructive bg-destructive/5 p-2 text-xs text-destructive">
          {errors.map((err, idx) => (
            <li key={idx}>{err}</li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, idx) => (
            <li
              key={photo.id}
              className="relative overflow-hidden rounded-md border bg-card"
              data-testid={`staged-photo-${idx}`}
            >
              <img src={photo.previewUrl} alt="" className="aspect-square w-full object-cover" />
              <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {idx + 1}
              </span>
              <div className="absolute right-1 bottom-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label={de.aiRecipeImport.moveUp(idx + 1)}
                  className="rounded bg-black/60 px-1.5 text-[10px] text-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === photos.length - 1}
                  aria-label={de.aiRecipeImport.moveDown(idx + 1)}
                  className="rounded bg-black/60 px-1.5 text-[10px] text-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label={de.aiRecipeImport.removePhoto(idx + 1)}
                  className="rounded bg-black/60 px-1.5 text-[10px] text-white"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
