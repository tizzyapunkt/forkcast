import type { de } from './de';

/**
 * Turns the literal types `as const` gives the German copy into their plain primitives,
 * keeping every key, nesting level and function signature. `en` is typed against this, so a
 * missing key or a wrong argument shape is a compile error rather than a runtime fallback.
 */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends (...args: infer A) => infer R
        ? (...args: A) => Widen<R>
        : T extends readonly (infer U)[]
          ? readonly Widen<U>[]
          : T extends object
            ? { readonly [K in keyof T]: Widen<T[K]> }
            : T;

/** The shape every locale's message set must provide. */
export type Messages = Widen<typeof de>;
