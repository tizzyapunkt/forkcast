import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
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
            <Button
              variant="onDark"
              size="iconSm"
              onClick={onBack}
              aria-label={backAria ?? de.recipeForm.backAria}
              // -my-1 keeps the 36px tap target without making the row taller than the
              // title's first line, so the chevron centers on the title rather than sitting low.
              className="-my-1 -ml-2 text-white"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            {/* leading-7 (28px) gives the title's first line the same height as the back
                button's tap target, so its text centers level with the chevron. */}
            <h1 className="text-lg font-semibold leading-7 [overflow-wrap:break-word]">{title ?? de.appTitle}</h1>
            {subtitle && <p className="-mt-0.5 text-xs font-medium text-white/70">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
      {bottom}
    </header>
  );
}
