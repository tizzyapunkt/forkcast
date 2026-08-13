import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './button';

const banner = cva('rounded-md border', {
  variants: {
    tone: {
      /** Something failed or is invalid — the user cannot proceed as they intended. */
      error: 'border-destructive/50 bg-destructive/10 text-destructive',
      /** Needs attention, nothing is broken. Body stays ink so long copy remains readable. */
      warning: 'border-warning/50 bg-warning/10 text-foreground',
      /** A completed action that keeps the user on the same screen. */
      success: 'border-success/50 bg-success/10 text-success-ink',
    },
    density: {
      md: 'p-3 text-sm',
      /** Dense surfaces (staging grids, inline lists) where a full banner would dominate. */
      sm: 'p-2 text-xs',
    },
  },
  defaultVariants: { tone: 'error', density: 'md' },
});

export interface BannerProps extends VariantProps<typeof banner> {
  /** The message: what happened, in the user's terms. */
  children: ReactNode;
  /** What to do about it. Rendered one step quieter under the message. */
  hint?: ReactNode;
  /** The recovery control, e.g. a retry button — it belongs in the banner, not elsewhere. */
  action?: ReactNode;
  /** Provide only for banners the user can safely ignore; blocking failures stay put. */
  onDismiss?: () => void;
  /** Accessible name of the dismiss control. Required whenever `onDismiss` is given. */
  dismissLabel?: string;
  /** Defaults to `alert` for the error tone and `status` otherwise. */
  role?: 'alert' | 'status';
  className?: string;
}

/**
 * A status message surface: names what happened, what to do about it, and carries its own
 * recovery control. One component for all three tones so an error, a warning and a
 * confirmation never drift apart in padding, border weight or announcement behaviour.
 */
export function Banner({
  children,
  hint,
  action,
  onDismiss,
  dismissLabel,
  role,
  tone,
  density,
  className,
}: BannerProps) {
  const announced = role ?? (tone === 'warning' || tone === 'success' ? 'status' : 'alert');

  return (
    <div role={announced} className={cn(banner({ tone, density }), className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          {/* The message only becomes a title once a hint sits under it. */}
          <div className={hint ? 'font-medium' : undefined}>{children}</div>
          {hint && <div className={density === 'sm' ? 'text-[11px]' : 'text-xs'}>{hint}</div>}
        </div>
        {onDismiss && (
          <Button
            variant="quiet"
            size="iconSm"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="-my-1 -mr-1 text-current hover:bg-black/5 hover:text-current"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        )}
      </div>
      {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
