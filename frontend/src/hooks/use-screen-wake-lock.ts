import { useEffect, useState } from 'react';

/**
 * Keeps the screen on while `active` and the page is visible, where the browser supports the Screen Wake
 * Lock API. Browsers drop the lock whenever the page is hidden, so it is requested again each time the page
 * becomes visible. Returns whether a lock is currently held; without support it stays `false`.
 */
export function useScreenWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const wakeLock = typeof navigator !== 'undefined' ? navigator.wakeLock : undefined;
    if (!active || !wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    async function acquire() {
      if (disposed || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const next = await wakeLock!.request('screen');
        if (disposed) {
          await next.release();
          return;
        }
        sentinel = next;
        setHeld(true);
        next.addEventListener('release', () => {
          if (!disposed) setHeld(false);
        });
      } catch {
        // Refused (battery saver, permissions policy): the view works without it.
        setHeld(false);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      setHeld(false);
      void sentinel?.release();
    };
  }, [active]);

  return held;
}
