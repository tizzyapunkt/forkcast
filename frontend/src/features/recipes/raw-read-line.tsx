import { de } from '../../i18n/de';
import { cn } from '../../lib/cn';

interface Props {
  /** The formatted read, from `formatRawIngredient`. */
  text: string;
  /** The row's current ingredient name, for the accessible label. */
  name: string;
  className?: string;
  testId?: string;
}

/**
 * What the photo said for an imported ingredient, set quietly under the row. Clamped to two lines
 * rather than truncated: the verbatim line carries size words and prep modifiers at its tail, which
 * is exactly the part a truncation would hide.
 */
export function RawReadLine({ text, name, className, testId }: Props) {
  return (
    <p
      data-testid={testId}
      aria-label={de.recipeIngredientEditor.provenance.rawLineAria(name)}
      title={text}
      className={cn('line-clamp-2 break-words text-xs text-muted-foreground/80', className)}
    >
      {de.recipeIngredientEditor.provenance.rawLine(text)}
    </p>
  );
}
