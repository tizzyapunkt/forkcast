import type { Locale } from '../i18n/locale';
import { buildDemoApp, seedCallFor } from './demo-app';
import { installDemoApi } from './demo-api';
import { demoOffFetch } from './demo-off-fetch';
import { SnapshotOffSearch, type OffSnapshot } from './snapshot-off-search';
import { OpenFoodFactsService } from '../../../backend/src/infrastructure/ingredient-search/open-food-facts.service.ts';
import type { IngredientSearchService } from '../../../backend/src/domain/ingredient-search/ingredient-search.service.ts';
import { IndexedDbJsonDocument, resetDemoStore } from './indexeddb-json-document';
import { seedDemoWeek } from './seed-demo-week';

/** Written last, after a complete seed: a store without it is empty or was left half-seeded. */
const META_DOCUMENT = 'demo-meta';

interface DemoMeta {
  seededLocale: Locale;
}

function parseMeta(text: string | null): DemoMeta | null {
  if (text === null) return null;
  try {
    const meta = JSON.parse(text) as Partial<DemoMeta>;
    return meta.seededLocale === 'de' || meta.seededLocale === 'en' ? { seededLocale: meta.seededLocale } : null;
  } catch {
    return null;
  }
}

export interface StartedDemo extends DemoMeta {
  /** Puts the real `fetch` back (tests only; the demo serves `/api` for the page's lifetime). */
  stop: () => void;
}

/**
 * Names come from the bundled snapshot, loaded on the first search (its own chunk); barcodes go to
 * Open Food Facts live, which allows any origin.
 */
function demoOpenFoodFacts(): IngredientSearchService {
  return new SnapshotOffSearch(
    () => import('./off-snapshot.json').then((m) => m.default as OffSnapshot),
    new OpenFoodFactsService(demoOffFetch),
  );
}

/**
 * Starts the in-page backend over IndexedDB and routes `/api` to it. A store without a complete seed
 * is cleared and seeded in `locale`.
 */
export async function startDemo({
  locale,
  factory = indexedDB,
  openFoodFacts = demoOpenFoodFacts(),
}: {
  locale: Locale;
  factory?: IDBFactory;
  openFoodFacts?: IngredientSearchService;
}): Promise<StartedDemo> {
  const documentFor = (name: string) => new IndexedDbJsonDocument(name, factory);
  let meta = parseMeta(await documentFor(META_DOCUMENT).read());
  if (!meta) await resetDemoStore(factory);

  const app = await buildDemoApp(documentFor, openFoodFacts);
  const stop = installDemoApi(app);

  if (!meta) {
    await seedDemoWeek(seedCallFor(app), { locale });
    meta = { seededLocale: locale };
    await documentFor(META_DOCUMENT).write(JSON.stringify(meta));
  }

  return { ...meta, stop };
}
