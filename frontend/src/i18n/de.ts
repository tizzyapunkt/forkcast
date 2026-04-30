import type { MealSlot } from '../domain/meal-log';

export const slotLabelsDe: Record<MealSlot, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
};

/** German UI copy for the forkcast frontend. */
export const de = {
  appTitle: 'forkcast',

  nav: {
    primary: 'Hauptnavigation',
    log: 'Tagebuch',
    recipes: 'Rezepte',
    settings: 'Einstellungen',
  },

  dateNav: {
    prev: 'Vorheriger Tag',
    next: 'Nächster Tag',
    today: 'Heute',
  },

  dayTotals: {
    protein: 'Eiweiß',
    carbs: 'KH',
    fat: 'Fett',
    kcalOpen: (diff: number) => `${diff} kcal offen`,
    kcalOver: (diff: number) => `${diff} kcal über Ziel`,
    reached: '✓ erreicht',
  },

  dailyLog: {
    nothingLogged: 'Noch nichts erfasst',
    add: 'Hinzufügen',
    kcalSuffix: ' kcal',
    macroInline: (p: number, c: number, f: number) =>
      `· ${Math.round(p)}g P · ${Math.round(c)}g K · ${Math.round(f)}g F`,
  },

  entryRow: {
    fromRecipe: (name: string) => `aus ${name}`,
    edit: 'Bearbeiten',
    editAria: 'Eintrag bearbeiten',
    removeAria: 'Eintrag entfernen',
    amountFor: (name: string) => `Menge für ${name}`,
  },

  errors: {
    generic: 'Etwas ist schiefgelaufen',
  },

  settings: {
    title: 'Ernährungsziel',
  },

  nutritionGoal: {
    loading: 'Laden…',
    saved: 'Gespeichert',
    calories: 'Kalorien (kcal)',
    protein: 'Eiweiß (g)',
    carbs: 'Kohlenhydrate (g)',
    fat: 'Fett (g)',
    save: 'Ziel speichern',
    saving: 'Speichern…',
    validation: {
      caloriesNumber: 'Kalorien müssen eine Zahl sein',
      caloriesPositive: 'Kalorien müssen positiv sein',
      proteinNumber: 'Eiweiß muss eine Zahl sein',
      proteinNonneg: 'Eiweiß muss ≥ 0 sein',
      carbsNumber: 'Kohlenhydrate müssen eine Zahl sein',
      carbsNonneg: 'Kohlenhydrate müssen ≥ 0 sein',
      fatNumber: 'Fett muss eine Zahl sein',
      fatNonneg: 'Fett muss ≥ 0 sein',
    },
  },

  editEntry: {
    dialogAria: 'Eintrag bearbeiten',
    title: 'Eintrag bearbeiten',
    cancel: 'Abbrechen',
    caloriesLabel: 'Kalorien (kcal)',
    macroLabel: (macro: string) => `${macro} (g)`,
    save: 'Änderungen speichern',
    saving: 'Speichern…',
    validation: {
      caloriesPositive: 'Kalorien müssen positiv sein',
    },
  },

  macros: {
    protein: 'Eiweiß',
    carbs: 'Kohlenhydrate',
    fat: 'Fett',
  },

  removeEntry: {
    dialogAria: 'Eintrag entfernen',
    title: 'Eintrag entfernen?',
    descriptionAfterLabel: ' aus dem Tagebuch entfernen?',
    cancel: 'Abbrechen',
    remove: 'Entfernen',
    removing: 'Wird entfernt…',
  },

  logIngredient: {
    dialogAria: 'Lebensmittel erfassen',
    addToSlot: (slotLabel: string) => `Zu ${slotLabel} hinzufügen`,
    cancel: 'Abbrechen',
    search: 'Suche',
    recent: 'Zuletzt',
    recipesTab: 'Rezepte',
    quick: 'Schnell',
  },

  quickEntry: {
    label: 'Bezeichnung',
    labelPlaceholder: 'z. B. Kaffee, Banane…',
    calories: 'Kalorien (kcal)',
    validation: {
      labelRequired: 'Bezeichnung ist erforderlich',
      caloriesRequired: 'Kalorien sind erforderlich',
    },
    addEntry: 'Eintrag hinzufügen',
    saveChanges: 'Änderungen speichern',
    saving: 'Speichern…',
  },

  fullEntry: {
    perUnit: (unit: string, cals: number, p: number, cb: number, f: number) =>
      `pro ${unit} — ${cals} kcal · ${p}g P · ${cb}g K · ${f}g F`,
    totalIntro: (amount: number, unit: string) => `${amount} ${unit} gesamt — `,
    macroKcal: 'kcal',
    macroProtein: 'Eiweiß',
    macroCarbs: 'KH',
    macroFat: 'Fett',
    amount: (unit: string) => `Menge (${unit})`,
    amountPlaceholder: 'z. B. 100',
    back: 'Zurück',
    log: 'Erfassen',
    saving: 'Speichern…',
    validation: {
      amountNumber: 'Menge muss eine Zahl sein',
      amountPositive: 'Menge muss größer als 0 sein',
    },
  },

  recipeConfirm: {
    summaryLine: (yield_: number, ingCount: number) =>
      `Rezept ergibt ${yield_} Portion${yield_ === 1 ? '' : 'en'} · ${ingCount} Zutat${ingCount === 1 ? '' : 'en'}`,
    totalLine: (cals: number, p: number, cb: number, f: number) =>
      `Gesamt: ${Math.round(cals)} kcal · ${Math.round(p)}g P · ${Math.round(cb)}g K · ${Math.round(f)}g F`,
    portionsLabel: 'Zu erfassende Portionen',
    willLogHeading: (n: number) => `Es werden ${n} Zutat${n === 1 ? '' : 'en'} erfasst:`,
    back: 'Zurück',
    log: 'Erfassen',
    logging: 'Wird erfasst…',
    validation: {
      portionsNumber: 'Portionen müssen eine Zahl sein',
      portionsPositive: 'Portionen müssen größer als 0 sein',
    },
  },

  searchPanel: {
    lookingUp: 'Barcode wird gesucht…',
    notFound: 'Produkt nicht gefunden',
    tryAgain: 'Erneut versuchen',
    placeholder: 'Zutaten suchen…',
    scanBarcode: 'Barcode scannen',
    searching: 'Suche läuft…',
    noResults: (q: string) => `Keine Treffer für „${q}“`,
    kcalPer: (kcal: number, unit: string) => `${kcal} kcal / ${unit}`,
  },

  recentPanel: {
    placeholder: 'Zuletzt verwendet filtern…',
    loading: 'Laden…',
    empty: 'Noch keine Zutaten — erfasse eine über die Suche, dann erscheint sie hier.',
    noMatches: (q: string) => `Keine Treffer für „${q}“`,
    kcalPer: (kcal: number, unit: string) => `${kcal} kcal / ${unit}`,
  },

  recipePanel: {
    placeholder: 'Rezepte filtern…',
    loading: 'Laden…',
    empty: 'Noch keine Rezepte — lege eines unter „Rezepte“ in der unteren Navigation an.',
    noMatches: (q: string) => `Keine Treffer für „${q}“`,
    meta: (ingCount: number, yield_: number) => `${ingCount} Zut. · ${yield_} Port.`,
  },

  barcodeScanner: {
    cameraDenied:
      'Kamerazugriff wurde verweigert. Bitte erlaube den Kamerazugriff in den Browsereinstellungen.',
    cameraUnavailable: 'Kamera nicht erreichbar.',
    cancel: 'Abbrechen',
  },

  recipes: {
    screenTitle: 'Rezepte',
    newRecipe: 'Neues Rezept',
    newRecipeAria: 'Neues Rezept',
    empty: 'Noch keine Rezepte — lege eines an, um loszulegen.',
    listMeta: (ingCount: number, yield_: number) =>
      `${ingCount} Zutat${ingCount === 1 ? '' : 'en'} · ${yield_} Port.`,
    loading: 'Laden…',
    back: 'Zurück',
    backAria: 'Zurück zu Rezepten',
    edit: 'Bearbeiten',
    editAria: 'Rezept bearbeiten',
    delete: 'Löschen',
    deleteAria: 'Rezept löschen',
    yields: (n: number) => `Ergibt ${n} Portion${n === 1 ? '' : 'en'}`,
    ingredients: 'Zutaten',
    steps: 'Schritte',
    noSteps: 'Keine Schritte erfasst.',
    deleteConfirm: (name: string) => `„${name}“ löschen?`,
    deleteBtn: 'Löschen',
    deleting: 'Wird gelöscht…',
    save: 'Speichern',
    create: 'Anlegen',
  },

  recipeForm: {
    nameRequired: 'Name ist erforderlich',
    yieldMin: 'Ergibt mindestens 1 Portion',
    minOneIngredient: 'Mindestens eine Zutat hinzufügen',
    name: 'Name',
    namePlaceholder: 'Bolognese',
    yield: 'Ergibt (Portionen)',
    steps: 'Schritte',
    addStep: '+ Schritt',
    noStepsOptional: 'Noch keine Schritte (optional).',
    stepAria: (n: number) => `Schritt ${n}`,
    moveStepUp: (n: number) => `Schritt ${n} nach oben`,
    moveStepDown: (n: number) => `Schritt ${n} nach unten`,
    removeStep: (n: number) => `Schritt ${n} entfernen`,
    cancel: 'Abbrechen',
    saving: 'Speichern…',
  },

  recipeIngredientEditor: {
    title: 'Zutaten',
    add: '+ Hinzufügen',
    addAria: 'Zutat hinzufügen',
    empty: 'Noch keine Zutaten.',
    amountFor: (name: string) => `Menge für ${name}`,
    remove: (name: string) => `${name} entfernen`,
  },

  recipeIngredientPicker: {
    dialogAria: 'Zutat zum Rezept hinzufügen',
    titlePick: 'Zutat hinzufügen',
    titleAmount: (name: string) => `Menge — ${name}`,
    cancel: 'Abbrechen',
    search: 'Suche',
    recent: 'Zuletzt',
    perUnit: (unit: string, cals: number, p: number, cb: number, f: number) =>
      `pro ${unit} — ${cals} kcal · ${p}g P · ${cb}g K · ${f}g F`,
    amountLabel: (unit: string) => `Menge pro Rezept (${unit})`,
    amountPlaceholder: 'z. B. 100',
    back: 'Zurück',
    add: 'Hinzufügen',
    validation: {
      amountNumber: 'Menge muss eine Zahl sein',
      amountPositive: 'Menge muss größer als 0 sein',
    },
  },
} as const;
