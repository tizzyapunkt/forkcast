import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const card = cva('rounded-lg border bg-card', {
  variants: {
    padding: {
      md: 'p-4',
      sm: 'p-3',
      /** For cards whose children own the edges — divided lists, media, sticky rows. */
      none: '',
    },
  },
  defaultVariants: { padding: 'md' },
});

export type CardProps = HTMLAttributes<HTMLElement> & VariantProps<typeof card>;

/**
 * The app's surface primitive. Renders a `<section>`, so passing `aria-label` turns it into
 * a named region; without one it stays semantically neutral.
 */
export function Card({ className, padding, ...rest }: CardProps) {
  return <section {...rest} className={cn(card({ padding }), className)} />;
}
