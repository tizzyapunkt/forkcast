import { de } from '../../i18n/de';

interface ErrorBannerProps {
  error: unknown;
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  const message = error instanceof Error ? error.message : de.errors.generic;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
