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
 * recipes already exist, unless --force is passed. Foods are looked up in GET /catalog by their German
 * name (the catalog's stable key); macros come from the catalog so logged values match the app.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

/** Picks the German or English text for the seeded locale. */
const L = (de: string, en: string): string => (LOCALE === 'en' ? en : de);

type Unit = 'g' | 'ml';
type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
interface CatalogEntry {
  name: string;
  nameEn?: string;
  unit: Unit;
  macrosPer100: { calories: number; protein: number; carbs: number; fat: number };
  pieces?: { label: string; grams: number }[];
}
interface Ingredient {
  name: string;
  unit: Unit;
  macrosPerUnit: { calories: number; protein: number; carbs: number; fat: number };
  amount: number;
  pieceQuantity?: { amount: number; unitLabel: string; gramsPerPiece: number };
  untracked?: boolean;
  displayQuantity?: { amount?: number; unitLabel: string };
  note?: string;
}

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

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
function mondayOf(iso: string): string {
  const day = new Date(iso + 'T00:00:00').getDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

// ---- login + catalog -------------------------------------------------------------------------

await call('POST', '/auth/login', { password: PASSWORD });

const existing = await call<unknown[]>('GET', '/recipes');
if (existing.length > 0 && !FORCE) {
  console.error(`Backend already has ${existing.length} recipe(s). Use a fresh data dir, or pass --force.`);
  process.exit(1);
}

const { entries: catalog } = await call<{ entries: CatalogEntry[] }>('GET', '/catalog');
const byName = new Map(catalog.map((e) => [e.name, e]));

function food(name: string): CatalogEntry {
  const entry = byName.get(name);
  if (!entry) throw new Error(`Not in catalog: ${name}`);
  return entry;
}

/** The food's name as the seeded locale shows it (English falls back to German). */
function localName(f: CatalogEntry): string {
  return LOCALE === 'en' ? (f.nameEn ?? f.name) : f.name;
}

/** Catalog piece labels are German; recipes store the label as typed, so English recipes get English ones. */
const PIECE_LABELS_EN: Record<string, string> = {
  klein: 'small',
  mittel: 'medium',
  gross: 'large',
  Kopf: 'head',
  Stange: 'stalk',
  Scheibe: 'slice',
  M: 'M',
  'Filet gross': 'large fillet',
};

/** A catalog food by weight/volume. */
function ing(name: string, amount: number, extra: Partial<Ingredient> = {}): Ingredient {
  const f = food(name);
  const m = f.macrosPer100;
  return {
    name: localName(f),
    unit: f.unit,
    macrosPerUnit: { calories: m.calories / 100, protein: m.protein / 100, carbs: m.carbs / 100, fat: m.fat / 100 },
    amount,
    ...extra,
  };
}

/** A catalog food counted in pieces ("2 mittel" / "2 medium"), using the catalog's piece weight. */
function pcs(name: string, count: number, label: string, extra: Partial<Ingredient> = {}): Ingredient {
  const piece = food(name).pieces?.find((p) => p.label === label);
  if (!piece) throw new Error(`No piece "${label}" for ${name}`);
  const en = PIECE_LABELS_EN[label] ?? label;
  const unitLabel = LOCALE === 'en' ? (count > 1 && /^(head|stalk|slice)$/.test(en) ? en + 's' : en) : label;
  return ing(name, count * piece.grams, {
    pieceQuantity: { amount: count, unitLabel, gramsPerPiece: piece.grams },
    ...extra,
  });
}

/** A food that isn't in the catalog (a branded product, a takeaway), with its label's macros per 100. */
function offCatalog(
  de: string,
  en: string,
  unit: Unit,
  per100: { calories: number; protein: number; carbs: number; fat: number },
  amount: number,
): Ingredient {
  const m = per100;
  return {
    name: L(de, en),
    unit,
    macrosPerUnit: { calories: m.calories / 100, protein: m.protein / 100, carbs: m.carbs / 100, fat: m.fat / 100 },
    amount,
  };
}

/**
 * Salt, spices — on the recipe and grocery list, not in the nutrition totals. Without a unit the app
 * shows its own "to taste" / "nach Geschmack".
 */
function untracked(name: string, unitLabel?: string, amount?: number): Ingredient {
  if (unitLabel === undefined) return ing(name, 0, { untracked: true });
  return ing(name, 0, {
    untracked: true,
    displayQuantity: amount === undefined ? { unitLabel } : { amount, unitLabel },
  });
}

// ---- goal, body weight ----------------------------------------------------------------------

await call('PUT', '/nutrition-goal', { calories: 2400, protein: 180, carbs: 250, fat: 75 });

const todayIso = isoDate(new Date());
const weights = [82.4, 82.6, 82.1, 81.9, 82.0, 81.7, 81.5, 81.6, 81.2, 81.3, 81.0, 80.8];
// Every ~1–2 days over the last ~3 weeks, ending today.
const weightOffsets = [-20, -18, -17, -15, -13, -11, -10, -8, -6, -4, -2, 0];
for (let i = 0; i < weights.length; i++) {
  await call('POST', '/weight-log', { date: addDays(todayIso, weightOffsets[i]!), weightKg: weights[i] });
}

// ---- recipes --------------------------------------------------------------------------------

async function addRecipe(name: string, yieldPortions: number, ingredients: Ingredient[], steps: string[]) {
  return call<{ id: string }>('POST', '/add-recipe', { name, yield: yieldPortions, ingredients, steps });
}

const oats = await addRecipe(
  'Overnight Oats',
  1,
  [
    ing('Haferflocken', 70),
    ing('Fettarme Milch (1,5 % Fett)', 200),
    ing('Magerquark', 200),
    ing('Mandel', 15),
    ing('Chiasamen', 10),
    ing('Heidelbeere', 80),
    untracked('Zimt', L('Prise', 'pinch'), 1),
  ],
  [
    L(
      'Haferflocken, Chiasamen, Milch und Quark in einem Glas verrühren.',
      'Stir the oats, chia seeds, milk and quark together in a jar.',
    ),
    L('Abgedeckt über Nacht in den Kühlschrank stellen.', 'Cover and leave in the fridge overnight.'),
    L(
      'Morgens mit Heidelbeeren und einer Prise Zimt toppen.',
      'In the morning, top with blueberries and a pinch of cinnamon.',
    ),
  ],
);

const bowl = await addRecipe(
  L('Hähnchen-Reis-Bowl', 'Chicken Rice Bowl'),
  4,
  [
    ing('Hähnchenbrust', 720),
    ing('Basmatireis', 280),
    pcs('Brokkoli', 1, 'Kopf'),
    pcs('Paprika rot', 2, 'mittel'),
    pcs('Frühlingszwiebel', 4, 'Stange'),
    ing('Sojasauce', 40),
    ing('Rapsöl', 40),
    ing('Sesam', 20),
    untracked('Salz'),
  ],
  [
    L('Reis nach Packungsanleitung garen.', 'Cook the rice according to the packet.'),
    L(
      'Hähnchen in Würfel schneiden und im Öl rundum anbraten, mit Sojasauce ablöschen.',
      'Dice the chicken, brown it all over in the oil and deglaze with soy sauce.',
    ),
    L(
      'Brokkoli und Paprika kurz mitbraten, bis sie noch Biss haben.',
      'Add the broccoli and pepper and fry briefly so they keep their bite.',
    ),
    L(
      'Auf vier Boxen verteilen, mit Frühlingszwiebeln und Sesam bestreuen.',
      'Divide between four boxes and sprinkle with spring onions and sesame.',
    ),
  ],
);

const dal = await addRecipe(
  L('Linsen-Dal', 'Red Lentil Dal'),
  4,
  [
    ing('Rote Linsen', 300),
    ing('Zwiebel', 120),
    ing('Knoblauch', 12),
    ing('Ingwer', 16),
    pcs('Tomate', 3, 'mittel'),
    ing('Kokosöl', 20),
    ing('Spinat', 200),
    ing('Basmatireis', 200),
    untracked('Kurkuma', L('TL', 'tsp'), 1),
    untracked('Kreuzkümmel', L('TL', 'tsp'), 1),
    untracked('Salz'),
  ],
  [
    L(
      'Zwiebel, Knoblauch und Ingwer im Kokosöl anschwitzen, Gewürze kurz mitrösten.',
      'Soften the onion, garlic and ginger in the coconut oil, then toast the spices briefly.',
    ),
    L(
      'Linsen, gewürfelte Tomaten und 800 ml Wasser zugeben, 20 Minuten köcheln.',
      'Add the lentils, diced tomatoes and 800 ml water and simmer for 20 minutes.',
    ),
    L('Spinat unterheben, salzen. Mit Reis servieren.', 'Fold in the spinach and season with salt. Serve with rice.'),
  ],
);

const salmon = await addRecipe(
  L('Lachs mit Kartoffeln', 'Salmon with Roast Potatoes'),
  2,
  [
    pcs('Lachsfilet', 2, 'mittel'),
    ing('Kartoffel', 600),
    ing('Grüne Bohne', 300),
    ing('Olivenöl', 15),
    ing('Dill', 5),
    untracked('Zitrone', L('Stück', 'piece'), 1),
    untracked('Salz'),
  ],
  [
    L(
      'Kartoffeln halbieren, mit der Hälfte des Öls bei 200 °C 30 Minuten rösten.',
      'Halve the potatoes and roast with half the oil at 200 °C for 30 minutes.',
    ),
    L(
      'Lachs salzen und die letzten 12 Minuten mit aufs Blech legen.',
      'Salt the salmon and add it to the tray for the last 12 minutes.',
    ),
    L(
      'Bohnen 6 Minuten blanchieren, alles mit Dill und Zitrone servieren.',
      'Blanch the beans for 6 minutes and serve everything with dill and lemon.',
    ),
  ],
);

const quark = await addRecipe(
  L('Quark mit Beeren', 'Quark with Berries'),
  1,
  [
    ing('Magerquark', 300),
    ing('Himbeere', 80),
    ing('Heidelbeere', 50),
    ing('Walnuss', 15),
    ing('Zuckerfreier Ahornsirup', 10),
  ],
  [
    L(
      'Quark glatt rühren, Beeren und gehackte Walnüsse darüber, mit Ahornsirup beträufeln.',
      'Stir the quark smooth, top with the berries and chopped walnuts and drizzle with maple syrup.',
    ),
  ],
);

// ---- the week -------------------------------------------------------------------------------

const weekStart = process.env.WEEK_START ?? mondayOf(todayIso);

type Planned = { recipe: { id: string }; portions?: number } | Ingredient;
const R = (recipe: { id: string }, portions = 1): Planned => ({ recipe, portions });

const scrambledEggs = () => [
  pcs('Hühnerei', 3, 'M'),
  pcs('Vollkornbrot', 2, 'Scheibe'),
  ing('Butter', 10),
  pcs('Kochschinken', 2, 'Scheibe'),
  pcs('Tomate', 1, 'mittel'),
];
const greekYogurt = () => ing('Griechischer Joghurt (10 % Fett)', 150);

// Nobody hits the goal every day: Wednesday's snack is skipped (under), Friday turns into pizza and beer
// and Saturday gets a bag of crisps (both over), so the week plan shows every day tone.
const frozenPizza = () =>
  offCatalog(
    'Tiefkühlpizza Margherita',
    'Frozen pizza margherita',
    'g',
    { calories: 235, protein: 9.5, carbs: 29, fat: 8.5 },
    350,
  );
const beer = (ml: number) => offCatalog('Pils', 'Lager', 'ml', { calories: 42, protein: 0.5, carbs: 3, fat: 0 }, ml);
const crisps = (g: number) =>
  offCatalog('Kartoffelchips', 'Potato crisps', 'g', { calories: 536, protein: 6.5, carbs: 50, fat: 34 }, g);

const week: Partial<Record<Slot, Planned[]>>[] = [
  // Mon
  {
    breakfast: [R(oats), pcs('Hühnerei', 1, 'M')],
    lunch: [R(bowl)],
    dinner: [R(dal), greekYogurt()],
    snack: [R(quark)],
  },
  // Tue
  {
    breakfast: scrambledEggs(),
    lunch: [R(bowl)],
    dinner: [R(salmon)],
    snack: [R(quark), pcs('Banane', 1, 'mittel')],
  },
  // Wed
  {
    breakfast: [R(oats)],
    lunch: [R(dal)],
    dinner: [
      ing('Spaghetti', 100),
      ing('Rinderhack', 200),
      pcs('Tomate', 2, 'mittel'),
      pcs('Zwiebel', 1, 'klein'),
      ing('Olivenöl', 10),
      ing('Parmesan', 15),
    ],
  },
  // Thu
  {
    breakfast: [R(oats)],
    lunch: [R(bowl)],
    dinner: [pcs('Putenbrust', 1, 'klein'), pcs('Süßkartoffel', 1, 'gross'), ing('Brokkoli', 200), ing('Olivenöl', 15)],
    snack: [R(quark), pcs('Banane', 1, 'mittel')],
  },
  // Fri
  {
    breakfast: scrambledEggs(),
    lunch: [R(dal)],
    dinner: [frozenPizza(), beer(1000)],
    snack: [R(quark), ing('Hüttenkäse', 200)],
  },
  // Sat
  {
    breakfast: [
      pcs('Roggenbrot', 3, 'Scheibe'),
      ing('Frischkäse (Doppelrahmstufe)', 30),
      pcs('Kochschinken', 3, 'Scheibe'),
      pcs('Hühnerei', 2, 'M'),
      ing('Gurke', 100),
    ],
    lunch: [R(dal), greekYogurt()],
    dinner: [ing('Schweinefilet', 250), ing('Kartoffel', 300), ing('Grüne Bohne', 200), ing('Butter', 10)],
    snack: [ing('Hüttenkäse', 250), pcs('Banane', 1, 'mittel'), ing('Erdnussbutter', 15), crisps(75)],
  },
  // Sun
  {
    breakfast: [R(oats)],
    lunch: [R(bowl)],
    dinner: [
      pcs('Kabeljau', 1, 'Filet gross'),
      ing('Basmatireis', 70),
      pcs('Zucchini', 1, 'mittel'),
      ing('Olivenöl', 10),
    ],
    snack: [R(quark), pcs('Apfel', 1, 'mittel')],
  },
];

for (let i = 0; i < week.length; i++) {
  const date = addDays(weekStart, i);
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as Slot[]) {
    for (const item of week[i]![slot] ?? []) {
      if ('recipe' in item) {
        await call('POST', '/log-recipe', { recipeId: item.recipe.id, portions: item.portions ?? 1, date, slot });
      } else {
        const { name, unit, macrosPerUnit, amount } = item;
        await call('POST', '/log-ingredient', {
          date,
          slot,
          ingredient: { type: 'full', name, unit, macrosPerUnit, amount },
        });
      }
    }
  }
}

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
