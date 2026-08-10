import { createContext, useContext, useId, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const fieldLabel = cva('font-medium', {
  variants: {
    size: {
      md: 'text-sm',
      /** Dense grids where the value carries the meaning and the label only tags it. */
      sm: 'text-xs text-muted-foreground',
    },
  },
  defaultVariants: { size: 'md' },
});

interface FieldControl {
  /** The id the wrapped control must carry so the label points at it. */
  id: string;
  /** Space-separated ids of the hint and error text, for `aria-describedby`. */
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldControl | null>(null);

/**
 * Read the wiring a surrounding `Field` provides. Returns `null` for controls rendered
 * outside a `Field`, which then behave like plain inputs.
 */
export function useFieldControl(): FieldControl | null {
  return useContext(FieldContext);
}

interface FieldProps extends VariantProps<typeof fieldLabel> {
  label: ReactNode;
  /** Explicit control id. Omit it and the field generates one and hands it to the control. */
  htmlFor?: string;
  /** Static guidance shown under the control (units, expected format). */
  hint?: ReactNode;
  /** Validation message. Its presence marks the control invalid. */
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A labelled form row: label, control, and its hint/error text — wired together so screen
 * readers announce the message with the control instead of leaving it as loose text next to it.
 */
export function Field({ label, htmlFor, hint, error, size, children, className }: FieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn('space-y-1', className)}>
        <label htmlFor={id} className={fieldLabel({ size })}>
          {label}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
