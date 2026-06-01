import { Portal } from './portal';
import { useScrollLock } from '../../hooks/use-scroll-lock';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  /**
   * Tailwind height class for the sheet. Defaults to a fixed `h-[82dvh]` so the
   * list/search sheets all share the same height. Pass a `max-h-…` class for
   * content-sized sheets (e.g. small forms) that should hug their content.
   */
  heightClassName?: string;
  children: React.ReactNode;
}

/**
 * Bottom sheet drawer chrome shared by every drawer: backdrop, the fixed
 * bottom-anchored panel, the drag handle, and the scroll lock.
 *
 * Renders through `Portal` (into `<body>`) on purpose — the scroll lock freezes
 * the `#root` app shell with `position: fixed`, and on iOS Safari a fixed
 * ancestor becomes the containing block for fixed descendants. A sheet nested
 * inside `#root` would therefore anchor to the frozen shell instead of the
 * viewport (it appeared at the page bottom while the background scrolled).
 * Centralizing the portal + lock here keeps the fix in one place so every
 * drawer inherits it.
 *
 * Children supply the sheet contents. For a fixed-height sheet, use a
 * `shrink-0` header followed by a `min-h-0 flex-1 overflow-y-auto` body so the
 * header stays put and only the body scrolls.
 */
export function BottomSheet({ open, onClose, ariaLabel, heightClassName = 'h-[82dvh]', children }: BottomSheetProps) {
  useScrollLock(open);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-xl bg-background shadow-lg transition-[height] duration-200 ${heightClassName}`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted" />
        {children}
      </div>
    </Portal>
  );
}
