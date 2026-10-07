## 1. Locale foundation (frontend)

- [x] 1.1 Write failing tests for locale resolution in `frontend/src/i18n/`: a stored choice wins; with nothing stored, `de-AT` → `de` and `fr-FR` / missing → `en`; `setLocale` stores the choice and triggers a reload (stubbed). Implement `i18n/index.ts` (`t`, `locale`, `setLocale`) until green
- [x] 1.2 Add `Messages` (`Widen<typeof de>`) in `i18n/messages.ts`; move `slotLabelsDe` and `formatMacroTriplet` into the message object as locale-owned helpers; verify `pnpm --filter @forkcast/frontend exec tsc --noEmit` passes and the existing `de.test.ts` stays green
- [x] 1.3 Pin `de` in `src/test/setup.ts` before modules load; verify the full frontend suite (`vp test`) is green before any call site changes
- [x] 1.4 Switch every `import { de } from '…/i18n/de'` (and `slotLabelsDe` / `formatMacroTriplet` imports) to `import { t } from '…/i18n'`; verify no non-test module imports `i18n/de` (`grep`) and the suite stays green

## 2. English messages

- [x] 2.1 Write `i18n/en.ts` typed as `Messages`, covering every section of `de`; carbs label `C` in `formatMacroTriplet`; verify `tsc --noEmit` passes
- [x] 2.2 Add a parity test that recursively compares the runtime keys of `de` and `en` and calls every function message with sample arguments without throwing; plus English cases for `formatMacroTriplet` (`52 P · 0 C · 30 F`) and the per-entry macro suffix; verify green

## 3. Locale-aware formatting and settings

- [x] 3.1 Write failing tests for `i18n/format.ts` (`intlLocale` → `de-DE` / `en-GB`); replace the hard-coded `'de-DE'` in `date-nav.tsx`, `photo-staging.tsx`, `diagnostics-screen.tsx`, `build-bundle.ts` and the `formatDecimal` default; verify the English date-nav label reads `Mon 5 Oct` and `1.5` vs `1,5` in tests
- [x] 3.2 Add a test that `parseDecimal` accepts `1,5` and `1.5` in both locales (fix it if not)
- [x] 3.3 Set `document.documentElement.lang` from the active locale in `main.tsx`; verify in a test or by manual check in the dev app
- [x] 3.4 Write failing tests for a language control on the settings screen (shows the active locale selected, choosing the other calls `setLocale`); implement with the existing `SegmentedControl` primitive until green

## 4. Catalog English names (backend)

- [x] 4.1 Write failing tests: `validateFoodEntry` accepts entries with and without `nameEn` and rejects a blank one; the catalog create/update duplicate check also matches on `nameEn` (`400`); implement `nameEn?: string` on `FoodEntry` and `nameEnFolded` on the index until green
- [x] 4.2 Write failing ranking tests in `domain/foods/`: `carrot` matches an entry by `nameEn` in either locale; `nameEn` scores at canonical tier above a synonym match; ties break by display-name length for the requested locale; implement until green
- [x] 4.3 Write failing handler tests for `GET /search-ingredients?locale=…`: `en` returns `nameEn` with a canonical-name fallback; absent or unknown means `de`; implement through `CatalogSearchService` and the search handler until green
- [x] 4.4 Write a failing test that the grocery list piece-size lookup finds an entry by its English name; add `nameEnFolded` to `pieceSizeLookup` keys until green
- [x] 4.5 Add required `nameEn` to the drafting schema/prompt (`food-entry-schema.ts`) and the resolution tool (`resolution-tool.ts`); pass it through `normalize-drafted-entry.ts`; verify with the existing drafter/resolution tests extended for `nameEn`

## 5. Seed translation

- [x] 5.1 Write a failing test that every entry in `backend/data/catalog.json` has a non-blank `nameEn` and no two folded `nameEn` values collide
- [x] 5.2 Add `nameEn` to every seed entry until 5.1 is green; review the diff by hand for natural English names (e.g. `Möhre` → `Carrot`, `Quark` → `Quark`)

## 6. Catalog manager and search (frontend)

- [x] 6.1 Write failing tests: the ingredient search request carries `locale` from the active locale (MSW handler asserts the query param)
- [x] 6.2 Write failing tests for the catalog manager: the list shows `nameEn` in the English locale with a German fallback; the filter matches `nameEn`; the editor exposes and saves an English name field; AI fill populates it; implement in `features/food-catalog/` and `domain/food-catalog.ts` until green

## 7. Verification

- [x] 7.1 Run backend and frontend `vp test`, `vp lint` and the frontend type check; all green
- [x] 7.2 Smoke-test in the dev app: start on an English browser profile, check daily log, week plan, recipes, grocery list, settings and catalog manager for leftover German UI copy; switch to German in settings and confirm it persists across a reload; search `apple` and `apfel` in both locales
