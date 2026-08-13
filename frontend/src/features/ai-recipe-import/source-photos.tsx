import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
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
  // Create the object URLs and revoke them in the same effect so the created set
  // and the revoked set always match. Doing this in a `useMemo` with a separate
  // cleanup breaks under React StrictMode: the simulated unmount revokes the URLs
  // while the memoized strings are reused on remount, leaving freshly-mounted
  // <img> elements (e.g. the fullscreen viewer) pointing at revoked blobs.
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const created = photos.map((p) => URL.createObjectURL(p.file));
    setUrls(created);
    return () => {
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

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
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (e.key === 'ArrowRight' && index < count - 1) onIndexChange(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onIndexChange, index, count]);

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
        <Button variant="onDark" size="icon" onClick={onClose} aria-label={c.closeAria} className="-mr-1 h-11 w-11">
          <X aria-hidden="true" className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
        <img src={urls[index]} alt={c.photoAlt(index + 1, count)} className="max-h-full max-w-full object-contain" />
      </div>

      {count > 1 && (
        <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="onDark"
            size="icon"
            disabled={index === 0}
            onClick={() => onIndexChange(index - 1)}
            aria-label={c.prevAria}
            className="h-12 w-12"
          >
            <ChevronLeft aria-hidden="true" className="h-6 w-6" />
          </Button>
          <Button
            variant="onDark"
            size="icon"
            disabled={index === count - 1}
            onClick={() => onIndexChange(index + 1)}
            aria-label={c.nextAria}
            className="h-12 w-12"
          >
            <ChevronRight aria-hidden="true" className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
