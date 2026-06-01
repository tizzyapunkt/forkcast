import { createPortal } from 'react-dom';

/**
 * Renders children into `<body>`, outside the `#root` app shell.
 *
 * Overlays (drawers, dialogs) must portal here so they sit as siblings of
 * `#root` rather than descendants of it. The scroll lock (see `useScrollLock`)
 * freezes `#root` with `position: fixed`; on iOS Safari a `position: fixed`
 * ancestor becomes the containing block for `position: fixed` descendants, so
 * an overlay nested inside `#root` would anchor to the frozen shell instead of
 * the viewport. Portaling into `<body>` keeps it viewport-anchored.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}
