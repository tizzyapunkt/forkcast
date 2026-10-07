## Context

- All frontend copy lives in one object, `de`, in `frontend/src/i18n/de.ts` (~890 lines, 36 top-level sections). Next to it sit helpers such as `slotLabelsDe` and `formatMacroTriplet`. About 59 modules import `de` directly. Most are components, but some are plain modules: `ai-recipe-import/import-failure.ts`, `recipes/ingredient-provenance.ts`, `diagnostics/build-bundle.ts`.
- Several literal types in `de` are narrowed with `as const` (e.g. `logIngredient.units`).
- Formatting hard-codes `'de-DE'` in `photo-staging.tsx`, `date-nav.tsx`, `diagnostics-screen.tsx` and `build-bundle.ts`. `lib/decimal.ts#formatDecimal` defaults to `navigator.language`.
- Tests run in jsdom (`src/test/setup.ts`). There `navigator.language` is `en-US`, and existing tests assert German copy.
- Backend `FoodEntry` (`domain/foods/types.ts`) has one `name` plus `synonyms`, which already mix German and English. The indexed form (`FoodIndexedEntry`) folds `name` and `synonyms`. Ranking lives in `domain/foods/rank-food-entries.ts`.
- Logged entries, recipe ingredients and grocery lines snapshot the food `name` at the time it is chosen. They do not reference a catalog id.
- The grocery list's piece-size lookup (`build-grocery-list.use-case.ts`) is keyed by folded name and synonyms.

## Goals / Non-Goals

**Goals:**
- Every screen renders fully in English, with no runtime missing-key fallback.
- Catalog food names follow the locale wherever a food is picked from search.
- Existing German behavior and existing data files stay unchanged.

**Non-Goals:**
- More than two locales, or a translation-management tool or library.
- Translating names already snapshotted in logs, recipes or grocery lists.
- Localizing recipe photo import, the Bring! export, Open Food Facts market selection, piece labels (`mittel`, …) or backend error strings. Backend errors are mapped to localized copy in the frontend already.
- Syncing the locale choice across devices.

## Decisions

### 1. One message type, two plain objects, no i18n library

`i18n/messages.ts` defines `Messages` as `Widen<typeof de>`, a small mapped type that turns string literal types into `string` and keeps function signatures. `en.ts` exports `en: Messages`. The compiler then rejects a missing key or a wrong argument shape. Locale-specific helpers move into the message objects, so each locale owns its formatting: `slotLabels`, `formatMacroTriplet` and `KH` vs `C`.

*Alternatives:* i18next or FormatJS. Both are rejected because the app has two locales, no plural-heavy copy, and messages are already typed functions. A library would add string keys and lose the type safety the current objects give for free.

### 2. Locale is resolved once at startup; switching reloads

`i18n/index.ts` resolves the locale once, at module load: the stored choice in `localStorage` if present, otherwise `navigator.language` (`de*` → `de`, else `en`). It exports `t` (the active `Messages`), `locale` and `setLocale(l)`. `setLocale` stores the choice and calls `location.reload()`. Call sites change from `import { de } from '…/i18n/de'` to `import { t } from '…/i18n'`, which is a mechanical rename. `main.tsx` sets `document.documentElement.lang`.

*Alternative:* a React context with `useMessages()`. It is rejected because it touches the call structure of ~59 modules, and it cannot reach the plain non-component modules without threading parameters. A locale switch is a rare, deliberate action. A reload also drops React Query caches that hold locale-dependent search results, so nothing stale survives.

### 3. Tests pin German

`src/test/setup.ts` stores `de` before any module imports `i18n`, so the existing German assertions keep passing. English is covered by dedicated tests that load `en` directly: key parity, `formatMacroTriplet`, and locale resolution with stubbed storage and `navigator.language`.

### 4. Locale-aware formatting through one helper

`i18n/format.ts` exposes `intlLocale` (`de-DE` / `en-GB`) and replaces the hard-coded `'de-DE'` arguments. `formatDecimal` defaults to `intlLocale`. `en-GB` is chosen over `en-US` for the `Mon 5 Oct` day-month order and 24-hour times, which suit a meal planner and match the scenarios. `parseDecimal` already accepts both separators. It is kept as is and covered by a test.

### 5. `nameEn?: string` on `FoodEntry`

A single optional field next to the canonical `name`. The canonical German name keeps deriving the `id` and stays the key for AI matching prompts. The index gains `nameEnFolded?`. Ranking scores `nameEnFolded` with canonical tier values. The tie-break uses the display name for the requested locale. `CatalogSearchService.searchByName` receives the locale, and `GET /search-ingredients` parses `locale` (`de` | `en`, anything else → `de`).

*Alternative:* a `names: Record<Locale, string>` map. It is rejected because, with two locales and a German canonical name that other code depends on, a map adds a migration and indirection for no extra behavior.

Validation (`validate-food-entry.ts`) rejects a blank `nameEn`. The duplicate check (`catalog.handlers.ts` fold compare) also compares `nameEn`.

### 6. Grocery piece lookup indexes `nameEn`

`pieceSizeLookup` adds `nameEnFolded` to its keys, so an English-named log entry still gets its `≈ n Stück` / `≈ n pcs` hint.

### 7. AI drafting and resolution produce `nameEn`

`food-entry-schema.ts` and `resolution-tool.ts` add a required `nameEn` (a common English name, title case) to the tool schema and prompt. The canonical name stays German. Normalisation (`normalize-drafted-entry.ts`) passes the field through.

### 8. Seed translation is a data task with a guard test

English names for the ~190 entries in `backend/data/catalog.json` are written once and reviewed by hand. A backend test asserts that every seed entry has a non-blank `nameEn` and that no two entries share a folded `nameEn`.

## Risks / Trade-offs

- [Snapshotted names mix languages after a switch, and the grocery list can list one food twice] → Documented as a known limitation in the proposal. The single user switches rarely. Revisit if the hosted product makes switching common.
- [Reload on switch loses unsaved form input on the settings screen] → The language control sits on its own row and does not live inside a form. Nothing else is unsaved on that screen.
- [Machine-quality English seed names] → Hand review of the seed diff is a task. Users can correct names in the catalog manager.
- [The `Widen` type misses a nested `as const` shape] → The parity test compares runtime keys recursively, in addition to the type check.

## Migration Plan

No data migration. `nameEn` is optional, so existing runtime catalogs load unchanged and only fresh data dirs get the translated seed. A user with an existing catalog can add English names in the manager. Rollback is to revert the change. Entries saved with `nameEn` stay valid JSON, and the old code ignores the extra field.
