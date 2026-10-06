import { Card } from '../../components/ui/card';
import { SegmentedControl } from '../../components/ui/segmented-control';
import { type Locale, locale, setLocale, t } from '../../i18n';

/**
 * The device's UI language. Sits outside every form: choosing reloads the app, which would
 * otherwise discard unsaved input.
 */
export function LanguageControl() {
  const options = [
    { value: 'de', label: t.settings.languageGerman },
    { value: 'en', label: t.settings.languageEnglish },
  ] as const satisfies readonly { value: Locale; label: string }[];

  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold">{t.settings.languageLabel}</h3>
      <SegmentedControl
        label={t.settings.languageLabel}
        value={locale}
        onChange={(next) => {
          if (next !== locale) setLocale(next);
        }}
        options={options}
      />
    </Card>
  );
}
