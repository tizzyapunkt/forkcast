import { useState } from 'react';
import { BottomSheet } from '../components/app/bottom-sheet';
import { Button } from '../components/ui/button';
import { t } from '../i18n';

/** Kept outside the demo's IndexedDB on purpose: a reset must not show the intro again. */
export const INTRO_SEEN_KEY = 'forkcast-demo:intro-seen';

function seen(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Without storage the intro just shows again next visit.
  }
}

/** The first-visit disclaimer: the demo runs in this browser, and what is turned off and why. */
export function DemoIntro() {
  const [open, setOpen] = useState(() => !seen());

  function dismiss() {
    markSeen();
    setOpen(false);
  }

  return (
    <BottomSheet open={open} onClose={dismiss} ariaLabel={t.demo.introTitle} heightClassName="max-h-[82dvh]">
      <div className="space-y-3 overflow-y-auto px-4 pt-3 pb-4 text-sm">
        <h2 className="text-lg font-semibold">{t.demo.introTitle}</h2>
        <p>{t.demo.introLocal}</p>
        <p>{t.demo.introData}</p>
        <div>
          <p className="font-medium">{t.demo.introOffTitle}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {t.demo.introOff.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          {t.demo.introSnapshot}{' '}
          <a href="https://world.openfoodfacts.org" className="underline underline-offset-2">
            Open Food Facts
          </a>{' '}
          (
          <a href="https://opendatacommons.org/licenses/odbl/1-0/" className="underline underline-offset-2">
            ODbL
          </a>
          ).
        </p>
        <Button onClick={dismiss} className="w-full">
          {t.demo.introDismiss}
        </Button>
      </div>
    </BottomSheet>
  );
}
