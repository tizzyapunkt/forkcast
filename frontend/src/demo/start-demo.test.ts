import { IDBFactory } from 'fake-indexeddb';
import { startDemo } from './start-demo';
import { IndexedDbJsonDocument, resetDemoStore } from './indexeddb-json-document';

async function recipeNames(): Promise<string[]> {
  const recipes = (await (await fetch('/api/recipes')).json()) as { name: string }[];
  return recipes.map((r) => r.name);
}

describe('startDemo', () => {
  let factory: IDBFactory;
  let stop: (() => void) | undefined;

  beforeEach(() => {
    factory = new IDBFactory();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => stop?.());

  const noOpenFoodFacts = { searchByName: async () => [], searchByBarcode: async () => null };

  /** `demoOff` keeps the demo's own Open Food Facts wiring: the bundled snapshot, live barcodes. */
  async function start(locale: 'de' | 'en', { demoOff = false } = {}) {
    const started = await startDemo({ locale, factory, ...(demoOff ? {} : { openFoodFacts: noOpenFoodFacts }) });
    stop = started.stop;
    return started;
  }

  it('seeds the first visit in the active locale and serves /api from the page', async () => {
    const { seededLocale } = await start('en');

    expect(seededLocale).toBe('en');
    expect(await recipeNames()).toContain('Red Lentil Dal');
  });

  it('keeps the data on a later start instead of seeding again', async () => {
    (await start('en')).stop();
    const { seededLocale } = await start('de');

    expect(seededLocale).toBe('en');
    expect(await recipeNames()).toHaveLength(5);
  });

  it('seeds again after a reset', async () => {
    (await start('en')).stop();
    await resetDemoStore(factory);
    const { seededLocale } = await start('de');

    expect(seededLocale).toBe('de');
    expect(await recipeNames()).toContain('Linsen-Dal');
  });

  it('starts over when a seed was interrupted', async () => {
    await new IndexedDbJsonDocument('recipes', factory).write(JSON.stringify([]));
    await new IndexedDbJsonDocument('weight-log', factory).write('not json from a half-done seed');

    await start('en');

    expect(await recipeNames()).toHaveLength(5);
  });
  it('answers Open Food Facts name searches from the bundled snapshot, without the network', async () => {
    const realFetch = globalThis.fetch;
    const network = vi.fn<typeof fetch>(async () => new Response('{}'));
    globalThis.fetch = network;
    try {
      await start('en', { demoOff: true });
      const results = (await (
        await fetch('/api/search-ingredients?q=peanut%20butter&sources=catalog,off&locale=en')
      ).json()) as { source: string; name: string }[];

      expect(results.filter((r) => r.source === 'OFF').length).toBeGreaterThan(5);
      expect(results.filter((r) => r.source === 'OFF').every((r) => /peanut butter/i.test(r.name))).toBe(true);
      expect(network).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
