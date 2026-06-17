import { useEffect, useMemo, useState } from 'react';
import { de } from '../../i18n/de';
import type { StagedPhoto } from './photo-staging';

interface Props {
  photos: StagedPhoto[];
}

const c = de.aiRecipeImport.sourcePhotos;

/**
 * Surfaces the imported recipe's source photos on the review screen so the user
 * can compare the AI-extracted draft against the originals. It derives and owns
 * its own object URLs from each {@link StagedPhoto.file} — it deliberately does
 * NOT reuse `previewUrl`, which the staging screen revokes when it unmounts on
 * the staging→review transition.
 */
export function SourcePhotos({ photos }: Props) {
  const urls = useMemo(() => photos.map((p) => URL.createObjectURL(p.file)), [photos]);

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{c.heading}</p>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo, idx) => (
          <li key={photo.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setOpenIndex(idx)}
              aria-label={c.openPhotoAria(idx + 1)}
              data-testid={`source-photo-${idx}`}
              className="block overflow-hidden rounded-md border bg-card"
            >
              <img src={urls[idx]} alt="" className="h-20 w-20 object-cover" />
            </button>
          </li>
        ))}
      </ol>

      {openIndex !== null && (
        <PhotoViewer urls={urls} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </div>
  );
}

interface ViewerProps {
  urls: string[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}

function PhotoViewer({ urls, index, onIndexChange, onClose }: ViewerProps) {
  const count = urls.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={c.viewerAria}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
    >
      <div className="flex items-center justify-between p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm tabular-nums">{c.position(index + 1, count)}</span>
        <button type="button" onClick={onClose} aria-label={c.closeAria} className="rounded p-2 text-lg leading-none">
          ✕
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
        <img src={urls[index]} alt="" className="max-h-full max-w-full object-contain" />
      </div>

      {count > 1 && (
        <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onIndexChange(index - 1)}
            aria-label={c.prevAria}
            className="rounded px-5 py-2 text-2xl leading-none disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={index === count - 1}
            onClick={() => onIndexChange(index + 1)}
            aria-label={c.nextAria}
            className="rounded px-5 py-2 text-2xl leading-none disabled:opacity-40"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
