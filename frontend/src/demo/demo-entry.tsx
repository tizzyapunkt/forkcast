import type { ReactNode } from 'react';
import type { Locale } from '../i18n/locale';
import { DemoBanner } from './demo-banner';
import { DemoIntro } from './demo-intro';

export { startDemo } from './start-demo';

/** The demo's frame around the app: the banner above it, the first-visit intro over it. No login. */
export function DemoShell({ seededLocale, children }: { seededLocale: Locale; children: ReactNode }) {
  return (
    <>
      <DemoBanner seededLocale={seededLocale} />
      {children}
      <DemoIntro />
    </>
  );
}
