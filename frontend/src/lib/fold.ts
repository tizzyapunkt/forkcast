/** Same folding rule as the backend search, so client-side comparisons match what the picker would find. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
