/**
 * Builds the in-browser demo's Open Food Facts snapshot: the most-scanned products sold in Germany,
 * the United Kingdom and the United States, as frontend/src/demo/off-snapshot.json. The demo's name
 * search runs against it, because search-a-licious sends no CORS headers and browsers block it.
 *
 *   node --experimental-transform-types scripts/demo/build-off-snapshot.mts
 *
 * Env:
 *   PER_COUNTRY   products fetched per country, in pages of 100 (default 2000; search-a-licious caps at 10000)
 *   DELAY_MS      pause between requests (default 1000), to stay well inside OFF's search rate limit
 *
 * Keeps only the fields mapOffProduct reads, drops what it would reject (no calories, no name),
 * dedupes by barcode and sorts by worldwide scan count. The data is Open Food Facts', under the
 * ODbL; the file says so. Commit the result; deploys never call OFF for it.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mapOffProduct } from '../../backend/src/domain/ingredient-search/map-off-product.ts';

const OUT = fileURLToPath(new URL('../../frontend/src/demo/off-snapshot.json', import.meta.url));
const COUNTRIES = ['en:germany', 'en:united-kingdom', 'en:united-states'];
const PER_COUNTRY = Number(process.env.PER_COUNTRY ?? 2000);
const DELAY_MS = Number(process.env.DELAY_MS ?? 1000);
const PAGE_SIZE = 100;
const FIELDS = 'code,product_name,product_name_de,product_name_en,brands,serving_size,serving_quantity,nutriments,unique_scans_n';
const NUTRIMENTS = ['energy-kcal_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g'] as const;
const USER_AGENT = 'forkcast-demo-snapshot (https://github.com/tizzyapunkt/forkcast)';

interface Hit {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  product_name_en?: string;
  brands?: string | string[];
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
  unique_scans_n?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function page(country: string, n: number): Promise<Hit[]> {
  const url = new URL('https://search.openfoodfacts.org/search');
  url.searchParams.set('q', `countries_tags:"${country}"`);
  url.searchParams.set('sort_by', '-unique_scans_n');
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('page', String(n));
  url.searchParams.set('langs', 'en,de');
  url.searchParams.set('fields', FIELDS);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return ((await res.json()) as { hits?: Hit[] }).hits ?? [];
    if (attempt === 3) throw new Error(`${country} page ${n}: ${res.status} ${res.statusText}`);
    await sleep(DELAY_MS * 5 * attempt);
  }
}

/** Only what mapOffProduct reads, and no empty fields. */
function slim(hit: Hit): Hit {
  const nutriments = Object.fromEntries(
    NUTRIMENTS.flatMap((key) => (hit.nutriments?.[key] === undefined ? [] : [[key, hit.nutriments[key]]])),
  );
  const kept: Hit = { ...hit, nutriments };
  delete kept.unique_scans_n;
  for (const key of Object.keys(kept) as (keyof Hit)[]) {
    const value = kept[key];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete kept[key];
    }
  }
  return kept;
}

const byCode = new Map<string, { product: Hit; scans: number }>();
const perCountry: Record<string, number> = {};

for (const country of COUNTRIES) {
  perCountry[country] = 0;
  for (let n = 1; n <= Math.ceil(PER_COUNTRY / PAGE_SIZE); n++) {
    const hits = await page(country, n);
    for (const hit of hits) {
      if (!hit.code || !mapOffProduct(hit, 'en') || !mapOffProduct(hit, 'de')) continue;
      perCountry[country]++;
      const scans = hit.unique_scans_n ?? 0;
      const seen = byCode.get(hit.code);
      if (!seen || seen.scans < scans) byCode.set(hit.code, { product: slim(hit), scans });
    }
    process.stdout.write(`\r${country}: page ${n}`);
    if (hits.length < PAGE_SIZE) break;
    await sleep(DELAY_MS);
  }
  process.stdout.write('\n');
}

const products = [...byCode.values()].sort((a, b) => b.scans - a.scans).map((entry) => entry.product);
const snapshot = {
  source: 'Open Food Facts, https://world.openfoodfacts.org (search.openfoodfacts.org, most-scanned products per country)',
  license:
    'Open Database License (ODbL) 1.0, https://opendatacommons.org/licenses/odbl/1-0/ (database); Database Contents License 1.0 (contents)',
  builtAt: new Date().toISOString(),
  countries: COUNTRIES,
  products,
};
const json = JSON.stringify(snapshot);
writeFileSync(OUT, json + '\n');

for (const [country, n] of Object.entries(perCountry)) console.log(`${country}: ${n} kept`);
console.log(`${products.length} products after dedupe, ${(json.length / 1_000_000).toFixed(2)} MB → ${OUT}`);
