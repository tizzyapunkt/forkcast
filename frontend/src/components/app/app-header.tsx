import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { de } from '../../i18n/de';

interface AppHeaderProps {
  /**
   * The header names where you are (the ONE header rule): tab screens pass their screen
   * name, sub-screens pass the entity title. Omitted → the "forkcast" wordmark (Tagebuch).
   */
  title?: string;
  /** Optional line under the title, e.g. "Ergibt 4 Portionen" on the recipe detail. */
  subtitle?: string;
  /** When given, renders a white back-arrow icon button left of the title. */
  onBack?: () => void;
  /** Accessible label for the back arrow; defaults to "Zurück". */
  backAria?: string;
  children?: ReactNode;
  bottom?: ReactNode;
}

export function AppHeader({ title, subtitle, onBack, backAria, children, bottom }: AppHeaderProps) {
  return (
    <header className="bg-header sticky top-0 z-30 border-b border-black/10 px-4 py-3 text-white shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={backAria ?? de.recipeForm.backAria}
              className="-ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center text-white"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="text-lg font-semibold leading-tight [overflow-wrap:break-word]">{title ?? de.appTitle}</h1>
            {subtitle && <p className="mt-0.5 text-xs font-medium text-white/70">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
      {bottom}
    </header>
  );
}
