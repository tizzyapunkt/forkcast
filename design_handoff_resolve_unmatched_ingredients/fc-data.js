/* forkcast prototype data — modelled on the real screenshots & domain.
   Macros stored per-100 (g/ml) so quantities recompute like the real app. */
(function () {
  const GOAL = { calories: 2919, protein: 152, carbs: 396, fat: 81 };

  // catalog: per-100 values. unit g|ml. untracked = seasoning (not counted).
  const FOODS = {
    rindertatar:   { name: 'Rindertatar', unit: 'g', per100: { kcal: 137, p: 21.6, c: 0, f: 5.6 } },
    haferflocken:  { name: 'Haferflocken', unit: 'g', per100: { kcal: 370, p: 13, c: 59, f: 7 } },
    ei:            { name: 'Hühnerei', unit: 'g', per100: { kcal: 144, p: 12.6, c: 0.7, f: 10 } },
    salz:          { name: 'Salz', unit: 'g', untracked: true, per100: { kcal: 0, p: 0, c: 0, f: 0 } },
    pfeffer:       { name: 'Schwarzer Pfeffer', unit: 'g', untracked: true, per100: { kcal: 0, p: 0, c: 0, f: 0 } },
    sojasauce:     { name: 'Sojasauce', unit: 'ml', per100: { kcal: 60, p: 8, c: 5, f: 0 } },
    wasser:        { name: 'Wasser', unit: 'ml', untracked: true, per100: { kcal: 0, p: 0, c: 0, f: 0 } },
    ahornsirup:    { name: 'Zuckerfreier Ahornsirup', unit: 'ml', per100: { kcal: 30, p: 0, c: 60, f: 0 } },
    ingwer:        { name: 'Ingwer', unit: 'g', per100: { kcal: 80, p: 1.8, c: 18, f: 0.8 } },
    speisestaerke: { name: 'Speisestärke', unit: 'g', per100: { kcal: 380, p: 0.3, c: 91, f: 0.1 } },
    knoblauch:     { name: 'Knoblauch', unit: 'g', per100: { kcal: 149, p: 6.4, c: 33, f: 0.5 } },
    sushireis:     { name: 'Sushireis', unit: 'g', per100: { kcal: 350, p: 6.5, c: 78, f: 0.6 } },
    brokkoli:      { name: 'Brokkoli', unit: 'g', per100: { kcal: 34, p: 2.8, c: 7, f: 0.4 } },
    sesam:         { name: 'Sesam', unit: 'g', per100: { kcal: 573, p: 17, c: 23, f: 50 } },
    olivenoel:     { name: 'Olivenöl', unit: 'ml', per100: { kcal: 884, p: 0, c: 0, f: 100 } },
    wassermelone:  { name: 'Wassermelone', unit: 'g', per100: { kcal: 326, p: 4, c: 79, f: 0 } },
    thunfisch:     { name: 'Thunfisch Filets in Sonnenblumenöl', unit: 'g', per100: { kcal: 166, p: 25, c: 0, f: 7 } },
    // ---- catalog foods used by the Foto-Import draft (Griechische Hähnchen-Gyros-Pfanne) ----
    haehnchenbrust:{ name: 'Hähnchenbrust', unit: 'g', per100: { kcal: 165, p: 31, c: 0, f: 3.6 } },
    zucchini:      { name: 'Zucchini', unit: 'g', per100: { kcal: 17, p: 1.2, c: 3.1, f: 0.3 } },
    zwiebel:       { name: 'Zwiebel', unit: 'g', per100: { kcal: 40, p: 1.1, c: 9, f: 0.1 } },
    paprika:       { name: 'Paprika, rot', unit: 'g', per100: { kcal: 31, p: 1, c: 6, f: 0.3 } },
    feta:          { name: 'Feta', unit: 'g', per100: { kcal: 264, p: 14, c: 4, f: 21 } },
    joghurt:       { name: 'Griechischer Joghurt 10%', unit: 'g', per100: { kcal: 115, p: 6, c: 4, f: 9 } },
    reis:          { name: 'Reis, gekocht', unit: 'g', per100: { kcal: 130, p: 2.7, c: 28, f: 0.3 } },
    zitrone:       { name: 'Zitronensaft', unit: 'ml', per100: { kcal: 22, p: 0.4, c: 6.9, f: 0.2 } },
    petersilie:    { name: 'Petersilie', unit: 'g', untracked: true, per100: { kcal: 0, p: 0, c: 0, f: 0 } },
    oregano:       { name: 'Oregano, getrocknet', unit: 'g', untracked: true, per100: { kcal: 0, p: 0, c: 0, f: 0 } },
    tomate:        { name: 'Tomate', unit: 'g', per100: { kcal: 18, p: 0.9, c: 3.9, f: 0.2 } },
    acetobalsamico:{ name: 'Aceto Balsamico', unit: 'ml', per100: { kcal: 88, p: 0.5, c: 17, f: 0.05 } },
  };

  // recently used (from the "Zuletzt" screenshot) — per 100 g/ml
  const RECENT = [
    { name: 'Corona extra', unit: 'ml', kcal: 42, p: 0.4, c: 3.5, f: 0 },
    { name: 'Fitline Natur 0,2% Fett', unit: 'g', kcal: 62, p: 10, c: 4, f: 0.2 },
    { name: 'fumagalli', unit: 'g', kcal: 335, p: 22, c: 1, f: 27 },
    { name: 'IceTea Sirup Pfirsich', unit: 'ml', kcal: 27, p: 0, c: 6.5, f: 0 },
    { name: 'Vollmilch (3,5 % Fett)', unit: 'ml', kcal: 64, p: 3.4, c: 4.8, f: 3.5 },
    { name: 'Roggenbrot', unit: 'g', kcal: 207, p: 6.5, c: 41, f: 1.1 },
    { name: 'Herta Hähnchenbrust mit Geflügelbouillon', unit: 'g', kcal: 104, p: 22, c: 1, f: 1.5 },
    { name: 'Gemüseaufstrich Paprika Walnuss', unit: 'g', kcal: 186, p: 3, c: 9, f: 15 },
    { name: 'Sesamöl nativ', unit: 'ml', kcal: 828, p: 0, c: 0, f: 92 },
    { name: 'Chili Sin Carne', unit: 'g', kcal: 102, p: 6, c: 13, f: 2.5 },
    { name: 'Pizza-Pizza Bratfilets', unit: 'g', kcal: 191, p: 14, c: 9, f: 11 },
    { name: 'Krunchy Very Berry Müsli', unit: 'g', kcal: 450, p: 8, c: 65, f: 16 },
  ];

  // search results for "Brot" (Open Food Facts), with OFF tag
  const SEARCH_BROT = [
    { name: 'Glutenfreies Brot', off: true, kcal: 263, unit: 'g', p: 5, c: 48, f: 5 },
    { name: 'Vollkorn Brot', off: true, kcal: 214, unit: 'g', p: 9, c: 39, f: 3 },
    { name: 'Vital Brot', off: true, kcal: 268, unit: 'g', p: 11, c: 40, f: 6 },
    { name: 'Glutenfreies Brot', off: true, kcal: 254, unit: 'g', p: 4, c: 50, f: 4 },
    { name: 'Mein Brot', off: true, kcal: 237, unit: 'g', p: 8, c: 44, f: 3 },
    { name: 'Arabische brot', off: true, kcal: 279, unit: 'g', p: 9, c: 55, f: 2 },
    { name: 'Block House Brot Kräuterpesto Baguette', off: true, kcal: 325, unit: 'g', p: 8, c: 42, f: 13 },
    { name: 'Pita-Brot', off: true, kcal: 256, unit: 'g', p: 9, c: 48, f: 2 },
    { name: 'Brot Chips Salz & Pfeffer (Bio)', off: true, kcal: 440, unit: 'g', p: 10, c: 60, f: 17 },
    { name: 'Fladenbrot', off: true, kcal: 247, unit: 'g', p: 8, c: 47, f: 2 },
    { name: 'Roggenmischbrot', off: true, kcal: 250, unit: 'g', p: 7, c: 48, f: 1.5 },
  ];

  // the recipe from the screenshots
  const RECIPE = {
    id: 'r1',
    name: 'Rinderhackbällchen mit Teriyaki Sauce',
    servings: 4,
    ingredients: [
      { key: 'rindertatar', amount: 500 },
      { key: 'haferflocken', amount: 5 },
      { key: 'ei', amount: 50, piece: { count: 1, label: 'großes Ei', gramsPer: 50, estimate: true } },
      { key: 'salz', amount: 5, displayQty: '1 TL' },
      { key: 'pfeffer', amount: 5, displayQty: '1 TL' },
      { key: 'sojasauce', amount: 100 },
      { key: 'wasser', amount: 150 },
      { key: 'ahornsirup', amount: 100, note: 'zuckerfreier' },
      { key: 'ingwer', amount: 5, note: 'fein gehackt' },
      { key: 'speisestaerke', amount: 5 },
      { key: 'knoblauch', amount: 10, note: 'fein gehackt', piece: { count: 2, label: 'Knoblauchzehe', gramsPer: 5 } },
      { key: 'sushireis', amount: 200 },
      { key: 'brokkoli', amount: 500 },
      { key: 'sesam', amount: 5 },
      { key: 'olivenoel', amount: 5 },
    ],
    steps: [
      'Sushireis nach Packungsanweisung kochen.',
      'Rindertatar, Haferflocken und Ei in eine große Schüssel geben, mit Salz und Pfeffer würzen und gründlich vermischen.',
      'Aus der Masse gleich große Bällchen formen.',
      'Stielbrokkoli kurz in heißem Wasser dünsten, auch der Reis sollte fertig sein.',
      'Bällchen in Olivenöl rundum anbraten, herausnehmen.',
      'Sojasauce, Wasser, Ahornsirup, Ingwer und Knoblauch aufkochen, mit Speisestärke binden und die Bällchen darin schwenken. Mit Sesam bestreuen.',
    ],
  };

  const RECIPES = [RECIPE];

  // ───────────────── Foto-Import draft (the "Rezept prüfen" screen) ─────────────────
  // An AI-parsed recipe from photos: most ingredients matched the catalog, three did not.
  // Each unmatched item carries the AI proposal the resolve flow shows for confirmation.
  // Row shape mirrors the editor's IngredientRow model so matched rows render directly.
  const mk = (key, amount, extra = {}) => ({
    key, name: FOODS[key].name, unit: FOODS[key].unit, per100: FOODS[key].per100,
    amount, note: '', untracked: !!FOODS[key].untracked, piece: null, free: null, source: 'FOODS', ...extra,
  });
  const IMPORT_DRAFT = {
    name: 'Griechische Hähnchen-Gyros-Pfanne',
    servings: 2,
    photos: 2,
    matched: [
      mk('haehnchenbrust', 300, { note: 'in Streifen' }),
      mk('knoblauch', 6, { piece: { count: 2, label: 'Zehe', gramsPer: 3 } }),
      mk('zwiebel', 80, { piece: { count: 1, label: 'Zwiebel', gramsPer: 80 } }),
      mk('zucchini', 150),
      mk('paprika', 120),
      mk('feta', 100),
      mk('joghurt', 100),
      mk('reis', 250),
      mk('zitrone', 15, { note: 'frisch gepresst' }),
      mk('olivenoel', 15),
      mk('petersilie', 0, { free: { qty: '1', unit: 'Handvoll' } }),
      mk('oregano', 0, { free: { qty: '1', unit: 'TL' } }),
    ],
    unmatched: [
      { id: 'u1', name: 'Tomaten', amount: 30, unit: 'g', note: 'getrocknet in Öl',
        proposal: { verdict: 'new-food', confidence: 0.82,
          entry: { name: 'Getrocknete Tomaten in Öl', unit: 'g', untracked: false, per100: { kcal: 213, p: 5.4, c: 11, f: 16 } } } },
      { id: 'u2', name: 'Kirschtomaten', amount: 50, unit: 'g', note: '',
        proposal: { verdict: 'new-food', confidence: 0.90,
          entry: { name: 'Kirschtomaten', unit: 'g', untracked: false, per100: { kcal: 18, p: 0.9, c: 3.9, f: 0.2 } } } },
      { id: 'u3', name: 'Balsamicoessig', amount: 5, unit: 'ml', note: '',
        proposal: { verdict: 'synonym-of', confidence: 0.86, foodKey: 'acetobalsamico', synonym: 'Balsamicoessig' } },
    ],
    steps: [
      'Hähnchenbrust in Streifen schneiden, mit Olivenöl, Knoblauch, Oregano und etwas Zitronensaft marinieren.',
      'Zwiebel und Paprika in Spalten, Zucchini in Halbmonde schneiden.',
      'Hähnchen in einer heißen Pfanne scharf anbraten, herausnehmen.',
      'Gemüse in derselben Pfanne anbraten, Hähnchen zurückgeben, mit Balsamicoessig ablöschen.',
      'Mit Feta, getrockneten und Kirschtomaten, Petersilie und einem Klecks Joghurt servieren. Dazu Reis.',
    ],
  };

  // catalog search for the manual-match picker (curated FOODS only, per the import cascade)
  function matchSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const all = Object.keys(FOODS).map((key) => ({ key, ...FOODS[key] }));
    const list = q ? all.filter((f) => { const n = f.name.toLowerCase(); return n.includes(q) || (q.length >= 4 && q.includes(n)); }) : all;
    return list.slice(0, 12).map((f) => ({ key: f.key, name: f.name, unit: f.unit, per100: f.per100, kcal: f.per100.kcal, untracked: !!f.untracked }));
  }

  // helper: macros for an amount of a catalog food
  function macrosFor(key, amount) {
    const fd = FOODS[key];
    const m = fd.per100;
    const factor = (fd.unit === 'g' || fd.unit === 'ml') ? amount / 100 : amount;
    return {
      kcal: Math.round(m.kcal * factor),
      p: m.p * factor, c: m.c * factor, f: m.f * factor,
      unit: fd.unit, name: fd.name, untracked: !!fd.untracked,
    };
  }

  function recipeTotals(recipe) {
    let kcal = 0, p = 0, c = 0, f = 0;
    for (const ing of recipe.ingredients) {
      const fd = FOODS[ing.key];
      if (fd.untracked) continue;
      const m = macrosFor(ing.key, ing.amount);
      kcal += m.kcal; p += m.p; c += m.c; f += m.f;
    }
    return { kcal, p, c, f };
  }

  // today's log (matches the "with food" screenshot: breakfast has 2 entries).
  // Lunch is a recipe-based meal so the diary shows a grouped recipe example too.
  function makeLog() {
    return {
      breakfast: [
        { id: 'e1', key: 'wassermelone', amount: 100 },
        { id: 'e2', key: 'thunfisch', amount: 100 },
      ],
      lunch: expandRecipe('r1', 1),
      dinner: [],
      snack: [],
    };
  }

  // ---- weekly plan (Mon–Sun) ----
  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  function makeWeek() {
    // anchor: week containing Di 2. Juni -> Mon 1. Juni
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push({ dow: i, date: 1 + i, month: 'Juni', meals: { breakfast: [], lunch: [], dinner: [], snack: [] } });
    }
    // pre-plan a couple of days to show the value
    days[0].meals.breakfast = [{ id: nextId(), key: 'wassermelone', amount: 200 }, { id: nextId(), key: 'haferflocken', amount: 60 }];
    days[0].meals.lunch = expandRecipe('r1', 1);
    days[0].meals.dinner = [{ id: nextId(), key: 'thunfisch', amount: 120 }, { id: nextId(), key: 'brokkoli', amount: 200 }];
    days[1].meals.breakfast = [{ id: nextId(), key: 'wassermelone', amount: 100 }, { id: nextId(), key: 'thunfisch', amount: 100 }];
    days[1].meals.lunch = expandRecipe('r1', 1);
    days[2].meals.dinner = expandRecipe('r1', 2);
    days[3].meals.lunch = [{ id: nextId(), key: 'sushireis', amount: 150 }, { id: nextId(), key: 'brokkoli', amount: 250 }];
    return days;
  }

  // expand a recipe into individual ingredient entries, scaled to `portions`,
  // each flagged with recipeRef so the planner can group & identify them.
  function expandRecipe(recipeId, portions) {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return [];
    const factor = portions / r.servings;
    const round = (n) => Math.round(n * 10) / 10;
    return r.ingredients.map((ing) => ({
      id: nextId(), key: ing.key, amount: round(ing.amount * factor),
      recipeRef: { id: r.id, name: r.name, portions },
    }));
  }

  function planEntryMacros(entry) {
    if (entry.recipe) {
      const r = RECIPES.find((x) => x.id === entry.recipe);
      const t = recipeTotals(r);
      const per = entry.portions / r.servings;
      return { kcal: Math.round(t.kcal * per), p: t.p * per, c: t.c * per, f: t.f * per, name: r.name, isRecipe: true, portions: entry.portions };
    }
    return macrosFor(entry.key, entry.amount);
  }

  // Resolve any log-entry shape to display macros.
  //  - { key, amount }                          catalog food (per-100), editable grams
  //  - { name, unit, per100, amount }           generic catalog (search/recent), editable grams
  //  - { name, kcal, p, c, f, quick:true }      quick add (fixed)
  //  - { name, recipe:'r1', portions }          recipe portions
  function entryMacros(e) {
    if (e.recipe) {
      const r = RECIPES.find((x) => x.id === e.recipe);
      const t = recipeTotals(r);
      const per = e.portions / r.servings;
      return { name: r.name, kind: 'recipe', portions: e.portions,
        kcal: Math.round(t.kcal * per), p: t.p * per, c: t.c * per, f: t.f * per };
    }
    if (e.quick) return { name: e.name, kind: 'quick', kcal: e.kcal, p: e.p || 0, c: e.c || 0, f: e.f || 0 };
    if (e.key) { const m = macrosFor(e.key, e.amount); return { ...m, kind: 'food', amount: e.amount }; }
    // generic per100
    const factor = e.amount / 100;
    return { name: e.name, unit: e.unit, kind: 'food', amount: e.amount,
      kcal: Math.round(e.per100.kcal * factor), p: e.per100.p * factor, c: e.per100.c * factor, f: e.per100.f * factor };
  }

  let _id = 100;
  const nextId = () => 'e' + (++_id);

  window.FC_DATA = {
    GOAL, FOODS, RECENT, SEARCH_BROT, RECIPES, RECIPE, IMPORT_DRAFT, matchSearch, entryMacros, nextId,
    WEEKDAYS, WEEKDAYS_LONG,
    macrosFor, recipeTotals, planEntryMacros, makeLog, makeWeek, expandRecipe,
    SLOTS: ['breakfast', 'lunch', 'dinner', 'snack'],
    SLOT_LABEL: { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snack' },
  };
})();
