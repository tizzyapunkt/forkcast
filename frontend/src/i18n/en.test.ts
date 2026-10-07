import { describe, expect, it } from 'vite-plus/test';
import { de } from './de';
import { en } from './en';

type Tree = { readonly [key: string]: unknown };

/** Every leaf path of a message tree, with its runtime kind (`string`, `function`, `array:7`, …). */
function shape(node: unknown, path = ''): Record<string, string> {
  if (Array.isArray(node)) return { [path]: `array:${node.length}` };
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node as Tree).reduce<Record<string, string>>(
      (acc, [key, child]) => ({ ...acc, ...shape(child, path ? `${path}.${key}` : key) }),
      {},
    );
  }
  return { [path]: typeof node };
}

function functions(node: unknown, path = ''): [string, (...args: unknown[]) => unknown][] {
  if (typeof node === 'function') return [[path, node as (...args: unknown[]) => unknown]];
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return [];
  return Object.entries(node as Tree).flatMap(([key, child]) => functions(child, path ? `${path}.${key}` : key));
}

/** First argument of the unit-taking messages (`perUnit`, `kcalPer`, …); a string elsewhere is just copy. */
const SAMPLE_UNIT = 'g';

describe('en message set', () => {
  it('covers exactly the keys of the German set, with the same kinds and array lengths', () => {
    expect(shape(en)).toEqual(shape(de));
  });

  it('calls every parameterised message with sample arguments without throwing', () => {
    const results = functions(en).map(([path, fn]) => {
      const args = Array.from({ length: fn.length }, (_, i) => (i === 0 ? SAMPLE_UNIT : 2));
      const numeric = Array.from({ length: fn.length }, () => 1);
      try {
        return [path, typeof fn(...args), typeof fn(...numeric)];
      } catch (err) {
        return [path, `threw: ${String(err)}`];
      }
    });
    expect(results.filter(([, a, b]) => a !== 'string' || b !== 'string')).toEqual([]);
  });
});

describe('en.formatMacroTriplet', () => {
  it('labels carbs C', () => {
    expect(en.formatMacroTriplet(52, 0, 30)).toBe('52 P · 0 C · 30 F');
  });

  it('rounds each value to the nearest integer', () => {
    expect(en.formatMacroTriplet(31.4, 59.6, 7.2)).toBe('31 P · 60 C · 7 F');
  });
});

describe('en.dailyLog.macroInline', () => {
  it('renders the per-entry macro suffix with the English triplet', () => {
    expect(`500${en.dailyLog.kcalSuffix} ${en.dailyLog.macroInline(52, 0, 30)}`).toBe('500 kcal · 52 P · 0 C · 30 F');
  });
});

describe('en per-unit lines', () => {
  it('uses the English triplet in the picker rows', () => {
    expect(en.fullEntry.perUnit('g', 3.7, 0.13, 0.66, 0.07)).toBe('370 kcal / 100g · 13 P · 66 C · 7 F');
    expect(en.recipeIngredientPicker.perUnit('piece', 80, 4, 12, 2)).toBe('80 kcal / piece · 4 P · 12 C · 2 F');
  });
});
