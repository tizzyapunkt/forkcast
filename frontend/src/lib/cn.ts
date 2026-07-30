import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins conditional class names and resolves Tailwind conflicts, so a caller-supplied
 * class always wins over a component's default (`<Button className="bg-warning">` drops
 * the variant's `bg-primary` instead of racing it in the stylesheet).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
