import type { Locale } from '../i18n/locale';
import { buildDemoApp, seedCallFor } from './demo-app';
import { installDemoApi } from './demo-api';
import { demoOffFetch } from './demo-off-fetch';
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
 * Starts the in-page backend over IndexedDB and routes `/api` to it. A store without a complete seed
 * is cleared and seeded in `locale`.
 */
export async function startDemo({
  locale,
  factory = indexedDB,
}: {
  locale: Locale;
  factory?: IDBFactory;
}): Promise<StartedDemo> {
  const documentFor = (name: string) => new IndexedDbJsonDocument(name, factory);
  let meta = parseMeta(await documentFor(META_DOCUMENT).read());
  if (!meta) await resetDemoStore(factory);

  const app = await buildDemoApp(documentFor, demoOffFetch);
  const stop = installDemoApi(app);

  if (!meta) {
    await seedDemoWeek(seedCallFor(app), { locale });
    meta = { seededLocale: locale };
    await documentFor(META_DOCUMENT).write(JSON.stringify(meta));
  }

  return { ...meta, stop };
}
