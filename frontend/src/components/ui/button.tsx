import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium disabled:opacity-50 disabled:pointer-events-none ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
  {
    variants: {
      variant: {
        /** The single primary action of a screen or sheet. */
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        /** Secondary actions that sit next to a primary one (cancel, alternative paths). */
        outline: 'border border-input bg-background hover:bg-muted',
        /** Confirming a removal — the committing button of a delete dialog. */
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        /** Opening a removal (asks for confirmation first), so it stays quieter than `destructive`. */
        destructiveOutline: 'border border-destructive text-destructive hover:bg-destructive/10',
        /** Inline, link-like actions inside dense lists and cards. */
        ghost: 'text-primary hover:text-primary/80',
        /** Icon actions that must not compete with the row they sit in (reorder, edit, close). */
        quiet: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        /** Icon actions that remove something — neutral at rest, red on approach. */
        quietDestructive: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
        /** Chrome on the indigo header, the planner header or another dark plane. */
        onDark: 'text-white/90 hover:bg-white/10',
        /**
         * The "add something here" affordance that repeats per slot on the diary and planner:
         * a periwinkle-tinted plate with indigo glyph. Louder than `quiet`, quieter than
         * `primary` — a screen has many of these, so it must not read as the primary action.
         */
        accent: 'bg-accent/10 text-primary hover:bg-accent/20',
        /** Controls sitting on user photography — a scrim, never a shadow (The Scrim-Over-Photo Rule). */
        scrim: 'bg-black/60 text-white backdrop-blur-sm hover:bg-black/75 disabled:hover:bg-black/60',
      },
      size: {
        /** Comfortable default; clears the 44px tap target with the app's line height. */
        md: 'px-4 py-2 text-sm',
        /** Dense rows and inline actions. */
        sm: 'px-3 py-1 text-xs',
        /** Icon-only buttons — square, no text padding. */
        icon: 'h-10 w-10 shrink-0',
        /** Icon-only in a dense row, where 40px would grow the row. The floor for a tap target. */
        iconSm: 'h-9 w-9 shrink-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

/**
 * The app's button. Defaults to `type="button"` — an unqualified `<button>` inside a form
 * submits it, which has bitten the recipe and body-profile forms before; opt into
 * submitting explicitly with `type="submit"`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...rest },
  ref,
) {
  return <button {...rest} ref={ref} type={type} className={cn(button({ variant, size }), className)} />;
});
