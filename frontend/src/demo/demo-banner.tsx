import { Banner } from '../components/ui/banner';
import { Button } from '../components/ui/button';
import { locale, t, type Locale } from '../i18n';
import { resetDemo } from './reset-demo';

/**
 * A strip above every screen of the demo: says it is a demo and offers a reset. After a language
 * switch it also offers to reset in the new language, since the sample data keeps the old one.
 */
export function DemoBanner({ seededLocale }: { seededLocale: Locale }) {
  const otherLanguage = seededLocale !== locale;
  const reset = () => void resetDemo();

  return (
    <Banner
      tone="warning"
      density="sm"
      role="status"
      // Full-width strip whose content lines up with the app's centred column (max-w-2xl) on wide screens.
      className="rounded-none border-x-0 border-t-0 px-[max(0.5rem,calc((100%_-_42rem)/2_+_1rem))]"
      hint={otherLanguage ? t.demo.seededInOtherLanguage : undefined}
      action={
        <>
          {otherLanguage && (
            <Button size="sm" onClick={reset}>
              {t.demo.resetInActiveLanguage}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={reset}>
            {t.demo.reset}
          </Button>
        </>
      }
    >
      {t.demo.banner}
    </Banner>
  );
}
