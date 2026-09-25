import { addDaysIso } from '../../domain/meal-log/date-range.ts';
import type { MeasurementUnit } from '../../domain/meal-log/types.ts';
import type { GroceryItem } from '../../domain/shopping/types.ts';

/** How Bring!'s German parser expects quantities to read. */
const UNIT_LABELS: Record<MeasurementUnit, string> = {
  g: 'g',
  ml: 'ml',
  oz: 'oz',
  cup: 'Tasse',
  tbsp: 'EL',
  tsp: 'TL',
  piece: 'Stück',
};

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** "380 g Zwiebel" — German recipe order; just the name when there is no amount. */
export function ingredientLine(item: GroceryItem): string {
  return item.amount > 0 ? `${item.amount} ${UNIT_LABELS[item.unit]} ${item.name}` : item.name;
}

/** "28.9.–4.10." */
export function weekRange(startDate: string): string {
  const short = (iso: string) => {
    const [, m, d] = iso.split('-').map(Number);
    return `${d}.${m}.`;
  };
  return `${short(startDate)}–${short(addDaysIso(startDate, 6))}`;
}

/**
 * The page Bring!'s import deeplink fetches: one schema.org Recipe in microdata whose ingredients are
 * the week's grocery items. forkcast has already scaled everything, so the yield is 1.
 */
export function renderBringImportPage(startDate: string, items: GroceryItem[]): string {
  const name = escapeHtml(`forkcast Einkaufsliste ${weekRange(startDate)}`);
  const lines = items
    .map((item) => `      <li itemprop="ingredients">${escapeHtml(ingredientLine(item))}</li>`)
    .join('\n');
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>${name}</title>
</head>
<body>
  <div itemscope itemtype="http://schema.org/Recipe">
    <h1 itemprop="name">${name}</h1>
    <p>Portionen: <span itemprop="yield">1</span></p>
    <ul>
${lines}
    </ul>
  </div>
</body>
</html>
`;
}
