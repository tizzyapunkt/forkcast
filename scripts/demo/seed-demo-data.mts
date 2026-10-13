/**
 * Seeds a believable single-person demo week (for landing-page screenshots) through the real HTTP API.
 *
 *   LOCALE=en node scripts/demo/seed-demo-data.mts          # or LOCALE=de
 *
 * Env:
 *   LOCALE              en | de (default en). Food names, recipe names, steps and piece labels are
 *                       stored as snapshots, so they are seeded in this language.
 *   FORKCAST_API        backend base URL (default http://localhost:3000)
 *   FORKCAST_PASSWORD   backend password; falls back to AUTH_PASSWORD, then to AUTH_PASSWORD in
 *                       FORKCAST_ENV_FILE (default backend/.env)
 *   WEEK_START          YYYY-MM-DD Monday of the planned week (default: the current week)
 *
 * Run it against a backend with a fresh data dir (only catalog.json present). It refuses to seed when
 * recipes already exist, unless --force is passed. What it seeds lives in frontend/src/demo/seed-demo-week.ts,
 * shared with the in-browser demo.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedDemoWeek } from '../../frontend/src/demo/seed-demo-week.ts';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const LOCALE = (process.env.LOCALE ?? 'en') as 'de' | 'en';
if (LOCALE !== 'de' && LOCALE !== 'en') throw new Error(`LOCALE must be de or en, got ${LOCALE}`);
const API = (process.env.FORKCAST_API ?? 'http://localhost:3000').replace(/\/$/, '');
const FORCE = process.argv.includes('--force');

function passwordFromEnvFile(): string | undefined {
  const file = process.env.FORKCAST_ENV_FILE ?? REPO + 'backend/.env';
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

let cookie = '';

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0]!;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---- login, then seed -------------------------------------------------------------------------

await call('POST', '/auth/login', { password: PASSWORD });

const existing = await call<unknown[]>('GET', '/recipes');
if (existing.length > 0 && !FORCE) {
  console.error(`Backend already has ${existing.length} recipe(s). Use a fresh data dir, or pass --force.`);
  process.exit(1);
}

const { weekStart } = await seedDemoWeek(call, { locale: LOCALE, weekStart: process.env.WEEK_START });

// ---- summary --------------------------------------------------------------------------------

const weekLog = await call<{
  days: { date: string; totals: { calories: number; protein: number; carbs: number; fat: number } }[];
  averages: { calories: number; protein: number; carbs: number; fat: number };
}>('GET', `/week-log/${weekStart}`);
const f = (t: { calories: number; protein: number; carbs: number; fat: number }) =>
  `${Math.round(t.calories)} kcal  P ${Math.round(t.protein)}  C ${Math.round(t.carbs)}  F ${Math.round(t.fat)}`;
for (const d of weekLog.days) console.log(d.date, f(d.totals));
console.log('avg       ', f(weekLog.averages));
console.log(`Seeded week ${weekStart} (${LOCALE}) on ${API}.`);
