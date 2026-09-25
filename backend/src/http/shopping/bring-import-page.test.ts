import { describe, it, expect } from 'vitest';
import { renderBringImportPage, ingredientLine, weekRange } from './bring-import-page.ts';
import type { GroceryItem } from '../../domain/shopping/types.ts';

function item(name: string, amount: number, unit: GroceryItem['unit'] = 'g'): GroceryItem {
  return { name, unit, amount, untracked: false, dates: ['2026-09-29'] };
}

/** Pull the microdata back out the way a parser would: itemprop → text, in document order. */
function props(html: string, prop: string): string[] {
  return [...html.matchAll(new RegExp(`itemprop="${prop}"[^>]*>([^<]*)<`, 'g'))].map((m) => m[1]!);
}

describe('ingredientLine', () => {
  it.each([
    [item('Zwiebel', 380), '380 g Zwiebel'],
    [item('Milch', 1200, 'ml'), '1200 ml Milch'],
    [item('Ei', 6, 'piece'), '6 Stück Ei'],
    [item('Senf', 2, 'tbsp'), '2 EL Senf'],
    [item('Zimt', 1, 'tsp'), '1 TL Zimt'],
    [item('Mehl', 1, 'cup'), '1 Tasse Mehl'],
    [item('Pfeffer', 0), 'Pfeffer'],
  ])('%o → %s', (input, line) => {
    expect(ingredientLine(input)).toBe(line);
  });
});

describe('weekRange', () => {
  it('formats a week in German short dates across a month boundary', () => {
    expect(weekRange('2026-09-28')).toBe('28.9.–4.10.');
  });
});

describe('renderBringImportPage', () => {
  const page = renderBringImportPage('2026-09-28', [item('Hähnchenbrust', 800), item('Zwiebel', 380)]);

  it('is a German HTML page with one schema.org Recipe in microdata', () => {
    expect(page).toMatch(/^<!doctype html>/i);
    expect(page).toContain('<html lang="de">');
    expect(page).toMatch(
      /itemscope[^>]*itemtype="http:\/\/schema\.org\/Recipe"|itemtype="http:\/\/schema\.org\/Recipe"[^>]*itemscope/,
    );
    expect(page.match(/schema\.org\/Recipe/g)).toHaveLength(1);
  });

  it('names the week and yields 1', () => {
    expect(props(page, 'name')).toEqual(['forkcast Einkaufsliste 28.9.–4.10.']);
    expect(props(page, 'yield')).toEqual(['1']);
  });

  it('has one ingredient line per item, in list order', () => {
    expect(props(page, 'ingredients')).toEqual(['800 g Hähnchenbrust', '380 g Zwiebel']);
  });

  it('escapes names so a food name cannot inject markup', () => {
    const html = renderBringImportPage('2026-09-28', [item('Äpfel & <b>Birnen</b> "bio"', 500)]);

    expect(props(html, 'ingredients')).toEqual(['500 g Äpfel &amp; &lt;b&gt;Birnen&lt;/b&gt; &quot;bio&quot;']);
    expect(html).not.toContain('<b>');
  });

  it('renders no ingredient lines for an empty list', () => {
    expect(props(renderBringImportPage('2026-09-28', []), 'ingredients')).toEqual([]);
  });
});
