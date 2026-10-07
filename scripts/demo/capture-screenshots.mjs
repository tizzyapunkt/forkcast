/**
 * Captures the landing-page screenshots from a running, seeded app (see seed-demo-data.mts).
 *
 *   LOCALE=en npx -y -p playwright-core@1.63 node scripts/demo/capture-screenshots.mjs [name]
 *
 * playwright-core is not a repo dependency; `npx -p` provides it and this script resolves it from there.
 * Pass a shot name (week-plan, daily-log, grocery-list, recipe, food-search, week-plan-desktop) to
 * capture only that one. Each shot is written as PNG and, when `cwebp` is on PATH, as a q85 WebP plus a
 * smaller WebP for the page's srcset (`<name>-600.webp` for phone shots, `<name>-1440.webp` for the
 * desktop shot). With `ffmpeg` on PATH the desktop shot also yields `og.jpg` (1200x630, top crop), the
 * page's link-preview image.
 *
 * Env:
 *   LOCALE              en | de (default en) — browser locale and the app's stored UI language
 *   FORKCAST_URL        frontend URL (default https://localhost:5173)
 *   FORKCAST_PASSWORD   login password; falls back to AUTH_PASSWORD, then to AUTH_PASSWORD in
 *                       FORKCAST_ENV_FILE (default backend/.env)
 *   OUT                 output dir (default scripts/demo/out/<locale>, gitignored)
 *   CHROME_PATH         Chrome/Chromium binary; default is playwright-core's own browser
 *                       (install once with `npx -y playwright-core@1.63 install chromium-headless-shell`)
 *   RECIPE              recipe to open for the `recipe` shot (default: the chicken rice bowl)
 *   QUERY               food-search query, with Open Food Facts on (default "greek yogurt" / "skyr")
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const LOCALE = process.env.LOCALE ?? 'en';
if (LOCALE !== 'de' && LOCALE !== 'en') throw new Error(`LOCALE must be de or en, got ${LOCALE}`);
const BASE = (process.env.FORKCAST_URL ?? 'https://localhost:5173').replace(/\/$/, '');
const OUT = process.env.OUT ?? join(REPO, 'scripts/demo/out', LOCALE);
const only = process.argv[2];

function passwordFromEnvFile() {
  const file = process.env.FORKCAST_ENV_FILE ?? join(REPO, 'backend/.env');
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('AUTH_PASSWORD='));
  return line?.slice('AUTH_PASSWORD='.length).trim() || undefined;
}
const PASSWORD = process.env.FORKCAST_PASSWORD ?? process.env.AUTH_PASSWORD ?? passwordFromEnvFile();
if (!PASSWORD) {
  console.error('Set FORKCAST_PASSWORD (or AUTH_PASSWORD, or put it in backend/.env).');
  process.exit(1);
}

/** UI strings the script clicks on, per locale (mirrors frontend/src/i18n). */
const UI = {
  de: {
    browserLocale: 'de-DE',
    log: 'Tagebuch',
    plan: 'Planen',
    recipes: 'Rezepte',
    groceryList: /Einkaufsliste/,
    add: 'Hinzufügen',
    search: 'Zutaten suchen…',
    recipe: 'Hähnchen-Reis-Bowl',
    query: 'skyr',
  },
  en: {
    browserLocale: 'en-GB',
    log: 'Log',
    plan: 'Plan',
    recipes: 'Recipes',
    groceryList: /Grocery list/,
    add: 'Add',
    search: 'Search ingredients…',
    recipe: 'Chicken Rice Bowl',
    query: 'greek yogurt',
  },
}[LOCALE];

/** playwright-core from node_modules, or from the `npx -p playwright-core` install on PATH. */
async function loadPlaywright() {
  try {
    return await import('playwright-core');
  } catch {
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
      if (!dir.endsWith(join('node_modules', '.bin'))) continue;
      const entry = join(dirname(dir), 'playwright-core', 'index.mjs');
      if (existsSync(entry)) return import(pathToFileURL(entry).href);
    }
    throw new Error('playwright-core not found — run via `npx -y -p playwright-core@1.63 node …` (see header).');
  }
}

const { chromium } = await loadPlaywright();
mkdirSync(OUT, { recursive: true });
const hasCwebp = (() => {
  try {
    execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function session(viewport, deviceScaleFactor) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor,
    colorScheme: 'light',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
    locale: UI.browserLocale,
    reducedMotion: 'reduce',
  });
  // Pin the app's UI language for this device, as the Settings switch would.
  await ctx.addInitScript((l) => localStorage.setItem('forkcast:locale', l), LOCALE);
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.fill('#password', PASSWORD);
  await page.keyboard.press('Enter');
  await nav(page, UI.plan).waitFor();
  await settle(page);
  return { ctx, page };
}
const nav = (page, name) => page.getByRole('button', { name, exact: true });
async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(ms);
  await page.mouse.move(0, 0);
}
async function collapseExpandedDay(page) {
  const expanded = page.locator('button[aria-expanded="true"]').first();
  if (await expanded.count()) await expanded.click();
  await settle(page);
}
async function shot(page, name, smallWidth = 600) {
  await settle(page);
  const png = join(OUT, `${name}.png`);
  await page.screenshot({ path: png });
  if (hasCwebp) {
    execFileSync('cwebp', ['-quiet', '-q', '85', png, '-o', join(OUT, `${name}.webp`)]);
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '85',
      '-resize',
      String(smallWidth),
      '0',
      png,
      '-o',
      join(OUT, `${name}-${smallWidth}.webp`),
    ]);
  }
  console.log('saved', png);
}
function ogImage(png) {
  try {
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      png,
      '-vf',
      'scale=1200:-1,crop=1200:630:0:0',
      '-q:v',
      '3',
      join(OUT, 'og.jpg'),
    ]);
  } catch {
    console.warn('ffmpeg not found, skipped og.jpg');
  }
}
const want = (n) => !only || only === n;

// phone
if (['daily-log', 'week-plan', 'grocery-list', 'recipe', 'food-search'].some(want)) {
  const { ctx, page } = await session({ width: 390, height: 844 }, 3);
  if (want('daily-log')) await shot(page, 'daily-log');

  if (want('week-plan') || want('grocery-list')) {
    await nav(page, UI.plan).click();
    await settle(page);
    // collapse today's expanded day so the whole week is visible
    await collapseExpandedDay(page);
    if (want('week-plan')) await shot(page, 'week-plan');
    if (want('grocery-list')) {
      await page.getByRole('button', { name: UI.groceryList }).first().click();
      await shot(page, 'grocery-list');
      await page.reload();
      await nav(page, UI.plan).waitFor();
      await settle(page);
    }
  }

  if (want('recipe')) {
    await nav(page, UI.recipes).click();
    await settle(page);
    await page
      .getByText(process.env.RECIPE ?? UI.recipe)
      .first()
      .click();
    await shot(page, 'recipe');
  }

  if (want('food-search')) {
    await page.reload();
    await nav(page, UI.log).waitFor();
    await nav(page, UI.log).click();
    await settle(page);
    await page.getByRole('button', { name: UI.add, exact: true }).nth(3).click(); // Snack
    await settle(page);
    const off = page.getByRole('checkbox', { name: 'Open Food Facts' });
    if (!(await off.isChecked())) await off.check();
    await page.getByPlaceholder(UI.search).fill(process.env.QUERY ?? UI.query);
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.activeElement?.blur());
    await shot(page, 'food-search');
  }
  await ctx.close();
}

// desktop, days collapsed
if (want('week-plan-desktop')) {
  const { ctx, page } = await session({ width: 1440, height: 900 }, 2);
  await nav(page, UI.plan).click();
  await settle(page);
  await collapseExpandedDay(page);
  await shot(page, 'week-plan-desktop', 1440);
  ogImage(join(OUT, 'week-plan-desktop.png'));
  await ctx.close();
}
await browser.close();
