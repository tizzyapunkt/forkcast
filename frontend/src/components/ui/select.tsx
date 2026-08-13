import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';
import { useFieldControl } from './field';

const select = cva(
  // Same base as `Input`, including the 16px mobile size that keeps iOS Safari from
  // zooming the viewport when the control takes focus.
  'w-full rounded-md border border-input bg-background text-base sm:text-sm',
  {
    variants: {
      size: {
        md: 'px-3 py-2',
        /** Dense inline rows, matching `Input`'s `sm`. */
        sm: 'px-2 py-1',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & VariantProps<typeof select>;

/**
 * The app's native `<select>`. Inside a `Field` it picks up the generated id and the
 * `aria-describedby` / `aria-invalid` wiring automatically; standalone it behaves like a
 * plain `<select>`. Kept native on purpose — the platform picker is faster to operate on a
 * phone than any custom listbox, which is the point of this app.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, size, id, 'aria-describedby': describedBy, 'aria-invalid': invalid, children, ...rest },
  ref,
) {
  const field = useFieldControl();

  return (
    <select
      {...rest}
      ref={ref}
      id={id ?? field?.id}
      aria-describedby={describedBy ?? field?.describedBy}
      aria-invalid={invalid ?? (field?.invalid ? true : undefined)}
      className={cn(select({ size }), className)}
    >
      {children}
    </select>
  );
});
