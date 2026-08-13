/**
 * The public surface of the design system.
 *
 * The app imports the primitives from their own modules (`components/ui/button`), so this
 * barrel exists for the packaged build (`pnpm build:ui`) that `/design-sync` consumes — it
 * is what defines "the components", and the generated `.d.ts` for it is the prop contract
 * a design agent codes against.
 *
 * Exports here carry no domain knowledge. Anything that knows about meals, recipes or
 * logging belongs in `components/app/` or a feature folder, not in this list.
 */

export { Banner, type BannerProps } from './banner';
export { Button, type ButtonProps } from './button';
export { Card, type CardProps } from './card';
export { DecimalInput } from './decimal-input';
export { Field, useFieldControl } from './field';
export { Input, type InputProps } from './input';
export { SegmentedControl, type SegmentedControlOption, type SegmentedControlProps } from './segmented-control';
export { Select, type SelectProps } from './select';
