import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;

type StyleSnapshot = {
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverflow: string;
  htmlOverflow: string;
};

let snapshot: StyleSnapshot | null = null;

function acquire() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    snapshot = {
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width,
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
    };
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
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

  document.body.style.position = snapshot.bodyPosition;
  document.body.style.top = snapshot.bodyTop;
  document.body.style.left = snapshot.bodyLeft;
  document.body.style.right = snapshot.bodyRight;
  document.body.style.width = snapshot.bodyWidth;
  document.body.style.overflow = snapshot.bodyOverflow;
  document.documentElement.style.overflow = snapshot.htmlOverflow;
  snapshot = null;

  window.scrollTo(0, savedScrollY);
}

/**
 * Freezes page scroll while overlays are open. Uses `position: fixed` on `body` so
 * background scrolling stays disabled on iOS Safari, not only `overflow: hidden`.
 * Nested overlays are supported via an internal counter.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    acquire();
    return () => release();
  }, [active]);
}
