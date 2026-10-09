import { Minus, Plus } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { Button } from './button';
import { cn } from '../../lib/cn';

const group = cva('flex shrink-0 items-center rounded-md border border-input bg-background', {
  variants: {
    size: {
      /** Inline in a dense header or row, next to a label. */
      sm: 'gap-1 px-1 py-0.5',
      /** Full-screen working surfaces used with busy hands: 44px steps. */
      touch: '',
    },
  },
  defaultVariants: { size: 'sm' },
});

export interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Accessible name of the value, e.g. "Portionen". */
  label: string;
  decrementLabel: string;
  incrementLabel: string;
  min?: number;
  max?: number;
  step?: number;
  size?: 'sm' | 'touch';
  className?: string;
}

/**
 * A whole-number count changed one step at a time: [−] value [+]. The value is a read-only number input,
 * so it reads as a labelled value to assistive tech and to tests. The minus step disables at `min`, the
 * plus step at `max`.
 */
export function Stepper({
  value,
  onChange,
  label,
  decrementLabel,
  incrementLabel,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  size = 'sm',
  className,
}: StepperProps) {
  const touch = size === 'touch';
  const iconSize = touch ? 16 : 14;

  return (
    <div className={cn(group({ size }), className)}>
      <Button
        variant="quiet"
        size={touch ? 'touch' : undefined}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label={decrementLabel}
        className={touch ? undefined : 'h-6 w-7 px-0 py-0'}
      >
        <Minus size={iconSize} aria-hidden="true" />
      </Button>
      <input
        type="number"
        readOnly
        value={value}
        aria-label={label}
        className={cn(
          'bg-transparent text-center tabular-nums focus:outline-hidden [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          touch ? 'w-8 text-base font-semibold' : 'w-8 text-sm',
        )}
      />
      <Button
        variant="quiet"
        size={touch ? 'touch' : undefined}
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        aria-label={incrementLabel}
        className={touch ? undefined : 'h-6 w-7 px-0 py-0'}
      >
        <Plus size={iconSize} aria-hidden="true" />
      </Button>
    </div>
  );
}
