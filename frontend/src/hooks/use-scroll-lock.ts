import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;

type StyleSnapshot = {
  rootPosition: string;
  rootTop: string;
  rootLeft: string;
  rootRight: string;
  rootWidth: string;
  rootOverflow: string;
  bodyOverflow: string;
  htmlOverflow: string;
};

let snapshot: StyleSnapshot | null = null;

/**
 * The scroll lock freezes the app shell (`#root`), NOT `<body>`.
 *
 * iOS Safari/WebKit treats a `position: fixed` element as the containing block
 * for its `position: fixed` descendants (Chrome follows the spec and does not).
 * If we froze `<body>` — an ancestor of every overlay — the bottom drawers
 * (`position: fixed`) would anchor to the body's content box instead of the
 * viewport: opened while scrolled, they appeared at the page bottom and the
 * background scrolled. Freezing `#root` and rendering overlays through a
 * `Portal` into `<body>` (a sibling of `#root`, outside the frozen subtree)
 * keeps overlays viewport-anchored on iOS while still pinning the background.
 */
function lockTarget(): HTMLElement {
  return document.getElementById('root') ?? document.body;
}

function acquire() {
  if (lockCount === 0) {
    const root = lockTarget();
    savedScrollY = window.scrollY;
    snapshot = {
      rootPosition: root.style.position,
      rootTop: root.style.top,
      rootLeft: root.style.left,
      rootRight: root.style.right,
      rootWidth: root.style.width,
      rootOverflow: root.style.overflow,
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
    };
    root.style.position = 'fixed';
    root.style.top = `-${savedScrollY}px`;
    root.style.left = '0';
    root.style.right = '0';
    root.style.width = '100%';
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function release() {
  lockCount -= 1;
  if (lockCount > 0) return;
  if (lockCount < 0) lockCount = 0;
  if (!snapshot) return;

  const root = lockTarget();
  root.style.position = snapshot.rootPosition;
  root.style.top = snapshot.rootTop;
  root.style.left = snapshot.rootLeft;
  root.style.right = snapshot.rootRight;
  root.style.width = snapshot.rootWidth;
  root.style.overflow = snapshot.rootOverflow;
  document.body.style.overflow = snapshot.bodyOverflow;
  document.documentElement.style.overflow = snapshot.htmlOverflow;
  snapshot = null;

  window.scrollTo(0, savedScrollY);
}

/**
 * Freezes page scroll while overlays are open. Locks the `#root` app shell with
 * `position: fixed` so background scrolling stays disabled on iOS Safari (not
 * only `overflow: hidden`). Overlays must render through `Portal` so they live
 * outside the frozen shell and stay anchored to the viewport on iOS. Nested
 * overlays are supported via an internal counter.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    acquire();
    return () => release();
  }, [active]);
}
