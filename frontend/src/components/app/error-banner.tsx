import { Banner } from '../ui/banner';
import { t } from '../../i18n';

interface ErrorBannerProps {
  error: unknown;
}

/**
 * The catch-all failure surface: turns an unknown thrown value into the app's error
 * `Banner`. Features that can say something more useful than `error.message` — naming the
 * cause and the recovery — should build their own `Banner` instead of routing through here.
 */
export function ErrorBanner({ error }: ErrorBannerProps) {
  const message = error instanceof Error ? error.message : t.errors.generic;
  return <Banner tone="error">{message}</Banner>;
}
