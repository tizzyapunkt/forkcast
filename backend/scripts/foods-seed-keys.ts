/**
 * Hand-curated list of food keys to seed `data/foods.json`.
 * Edit this file directly to add or remove staples; then re-run `pnpm --filter @forkcast/backend build:foods`.
 *
 * IDs are stable, lowercase, ASCII kebab-case (German romanisation).
 * Re-running the build script regenerates the entries — local hand edits to `foods.json` may be overwritten.
 *
 * A plain string entry is a tracked food. An object `{ key, untracked: true }` marks the key as
 * untracked: a seasoning, herb, or spice that belongs to a recipe and the future grocery list but
 * never contributes to nutrition rollups. The build script enforces that untracked entries land
 * with `untracked: true` AND all-zero `macrosPer100` in the generated JSON.
 */
export type FoodSeedKey = string | { key: string; untracked: true };

export const FOODS_SEED_KEYS: ReadonlyArray<FoodSeedKey> = [
  // Vegetables — leafy & cruciferous
  'spinat',
  'gruenkohl',
  'rucola',
  'feldsalat',
  'eisbergsalat',
  'romanasalat',
  'mangold',
  'weisskohl',
  'rotkohl',
  'wirsing',
  'spitzkohl',
  'brokkoli',
  'blumenkohl',
  'rosenkohl',
  'pak-choi',
  'sauerkraut',

  // Vegetables — root & tuber
  'moehre',
  'pastinake',
  'sellerie-knolle',
  'rote-bete',
  'kartoffel',
  'suesskartoffel',
  'rettich',
  'radieschen',
  'topinambur',
  'kohlrabi',

  // Vegetables — alliums
  'zwiebel',
  'rote-zwiebel',
  'fruehlingszwiebel',
  'lauch',
  'schalotte',

  // Vegetables — fruiting
  'tomate',
  'cherrytomate',
  'gurke',
  'zucchini',
  'aubergine',
  'paprika-rot',
  'paprika-gelb',
  'paprika-gruen',
  'kuerbis-hokkaido',
  'kuerbis-butternut',
  'avocado',
  'olive-gruen',
  'olive-schwarz',

  // Vegetables — pods & legumes (fresh)
  'erbse',
  'zuckerschote',
  'gruene-bohne',

  // Vegetables — mushrooms
  'champignon',
  'kraeuterseitling',
  'pfifferling',
  'shiitake',

  // Vegetables — asparagus & artichoke
  'spargel-gruen',
  'spargel-weiss',
  'artischocke',
  'fenchel',

  // Fruits — pome & stone
  'apfel',
  'birne',
  'pfirsich',
  'nektarine',
  'aprikose',
  'pflaume',
  'kirsche',

  // Fruits — citrus
  'zitrone',
  'limette',
  'orange',
  'mandarine',
  'grapefruit',

  // Fruits — berry
  'erdbeere',
  'himbeere',
  'heidelbeere',
  'brombeere',
  'johannisbeere-rot',

  // Fruits — tropical & other
  'banane',
  'mango',
  'ananas',
  'kiwi',
  'wassermelone',
  'honigmelone',
  'weintraube',
  'granatapfel',
  'feige',
  'datteln',

  // Animal protein — poultry
  'huehnchenbrust',
  'huehnchenschenkel',
  'putenbrust',
  'haehnchenfluegel',

  // Animal protein — beef & pork
  'rinderhack',
  'rindfleisch-filet',
  'rindfleisch-roastbeef',
  'schweinefilet',
  'schweinekotelett',
  'schinken-gekocht',
  'salami',
  'speck',

  // Animal protein — fish & seafood
  'lachs-filet',
  'thunfisch-filet',
  'kabeljau',
  'forelle',
  'seelachs',
  'garnele',
  'thunfisch-konserve',

  // Eggs
  'huehnerei',

  // Dairy
  'milch-vollfett',
  'milch-fettarm',
  'joghurt-natur',
  'griechischer-joghurt',
  'quark-mager',
  'quark-vollfett',
  'huettenkaese',
  'frischkaese',
  'mozzarella',
  'feta',
  'parmesan',
  'gouda',
  'butter',
  'sahne',
  'creme-fraiche',
  'schmand',

  // Plant-based dairy alternatives
  'hafermilch',
  'mandelmilch',
  'sojamilch',
  'tofu-natur',
  'tempeh',

  // Grains & flours
  'haferflocken',
  'reis-weiss',
  'reis-vollkorn',
  'basmati-reis',
  'quinoa',
  'bulgur',
  'couscous',
  'dinkel-vollkorn',
  'weizenmehl-405',
  'dinkelvollkornmehl',
  'haferkleie',

  // Bread & pasta
  'vollkornbrot',
  'roggenbrot',
  'baguette',
  'spaghetti',
  'penne-vollkorn',

  // Legumes (dry/canned cooked)
  'linsen-rot',
  'linsen-gruen',
  'kichererbsen',
  'kidneybohnen',
  'weisse-bohnen',
  'edamame',

  // Nuts & seeds
  'mandel',
  'walnuss',
  'cashew',
  'haselnuss',
  'sonnenblumenkern',
  'kuerbiskern',
  'leinsamen',
  'chiasamen',
  'sesam',
  'erdnussbutter',

  // Oils & fats (ml)
  'olivenoel',
  'rapsoel',
  'kokosoel',
  'leinoel',

  // Beverages (ml)
  'wasser',

  // Seasonings, herbs & spices — untracked (no macro contribution by definition)
  { key: 'salz', untracked: true },
  { key: 'pfeffer-schwarz', untracked: true },
  { key: 'basilikum', untracked: true },
  { key: 'oregano', untracked: true },
  { key: 'thymian', untracked: true },
  { key: 'rosmarin', untracked: true },
  { key: 'paprikapulver', untracked: true },
  { key: 'kreuzkuemmel', untracked: true },
  { key: 'kurkuma', untracked: true },
  { key: 'zimt', untracked: true },
  { key: 'lorbeerblatt', untracked: true },
  { key: 'petersilie', untracked: true },
  { key: 'schnittlauch', untracked: true },
  { key: 'dill', untracked: true },
  { key: 'chiliflocken', untracked: true },
  { key: 'muskat', untracked: true },
  // Aromatics used in tiny amounts (spoons/cloves/single chillies) — nutritionally trivial, tracked
  // as untracked so they stay in recipes and the future grocery list without polluting macro rollups.
  { key: 'ingwer', untracked: true },
  { key: 'knoblauch', untracked: true },
  { key: 'chili', untracked: true },
  'rindertatar',
  'sojasauce',
  'speisestärke',
  'sushireis',
  'zuckerfreier-ahornsirup',
];

export interface NormalizedFoodSeedKey {
  key: string;
  untracked: boolean;
}

export function normalizeFoodSeedKeys(seed: ReadonlyArray<FoodSeedKey>): NormalizedFoodSeedKey[] {
  return seed.map((entry) =>
    typeof entry === 'string'
      ? { key: entry, untracked: false }
      : { key: entry.key, untracked: entry.untracked === true },
  );
}
