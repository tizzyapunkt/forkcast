import { forwardRef, type InputHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';
import { useFieldControl } from './field';

const input = cva(
  // `text-base` (16px) on mobile is load-bearing: anything smaller makes iOS Safari zoom the
  // viewport when the field takes focus. `sm:text-sm` restores the denser desktop size.
  'rounded-md border border-input bg-background text-base sm:text-sm',
  {
    variants: {
      size: {
        md: 'px-3 py-2',
        /** Dense inline fields — ingredient amounts, table-like rows. */
        sm: 'px-2 py-1',
      },
      numeric: {
        true: 'text-right tabular-nums',
        false: '',
      },
    },
    defaultVariants: { size: 'md', numeric: false },
  },
);

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & VariantProps<typeof input>;

/**
 * The app's text input. Inside a `Field` it picks up the generated id and the
 * `aria-describedby` / `aria-invalid` wiring automatically; standalone it behaves like a
 * plain `<input>`.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size, numeric, id, 'aria-describedby': describedBy, 'aria-invalid': invalid, ...rest },
  ref,
) {
  const field = useFieldControl();

  return (
    <input
      {...rest}
      ref={ref}
      id={id ?? field?.id}
      aria-describedby={describedBy ?? field?.describedBy}
      aria-invalid={invalid ?? (field?.invalid ? true : undefined)}
      className={cn(input({ size, numeric }), className)}
    />
  );
});
