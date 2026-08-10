import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group — what the options are choosing between. */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  disabled?: boolean;
  className?: string;
}

/**
 * Picks exactly one of a handful of mutually exclusive options, all visible at once.
 *
 * Built on native radios (visually hidden, wrapped in their label) rather than buttons with
 * `aria-pressed`: this is a single-select, not a set of independent toggles, and the native
 * element carries the group semantics and arrow-key navigation for free. Each instance gets
 * its own generated `name`, so two controls on one screen never deselect each other.
 *
 * For more options than fit on a phone's width, use a `<select>` instead.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-2', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex-1 rounded-md border px-3 py-2 text-center text-sm',
              selected ? 'border-primary bg-primary/10 font-medium' : 'border-input',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
