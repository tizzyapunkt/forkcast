# Tasks: unify-screen-headers-and-display-format

## 1. Shared macro-triplet formatter

- [x] 1.1 Write failing tests for a `formatMacroTriplet(p, c, f)` helper (i18n/format layer):
      middot separators, `KH` label, integer rounding, no `g` suffix (`52 P · 0 KH · 30 F`)
- [x] 1.2 Implement the helper; export alongside the existing `de` i18n strings

## 2. Macro format — daily log (meal-log-display deltas)

- [x] 2.1 Update entry-row tests: macro suffix `· {P} P · {KH} KH · {F} F` for full and quick
      entries, suppression rules unchanged; update live-amount-edit test strings
- [x] 2.2 Switch `entry-row.tsx` to the shared formatter
- [x] 2.3 Update slot-summary tests (`540 kcal` + `· 32 P · 60 KH · 18 F`, suppression rules
      unchanged) and switch the slot card to the shared formatter

## 3. Macro format — recipes (recipes deltas)

- [x] 3.1 Update recipes-list row tests: `{kcal} kcal · {P} P · {KH} KH · {F} F / Portion`,
      meta line unchanged; switch the row to the shared formatter
- [x] 3.2 Update ingredient-editor sub-line tests (`500 kcal · 52 P · 0 KH · 30 F`, untracked
      hidden, live updates unchanged); switch the sub-line to the shared formatter
- [x] 3.3 Update recipe-form hero tests to the new triplet strings (dot row content per existing
      requirement; values via shared formatter)
- [x] 3.4 Update full-entry-confirm tests: per-100 line `370 kcal / 100g · 13 P · 66 KH · 7 F`
      and the live total line using the shared triplet; switch component over
      (nutrient-display-format delta)

## 4. Recipe detail nutrition strip

- [x] 4.1 Write failing tests: strip shows the single per-serving line
      `{kcal} kcal · {P} P · {KH} KH · {F} F`, no `Bei {N} Portionen` line, invariant under the
      multiplier, untracked rows excluded
- [x] 4.2 Remove the `Bei`-line rendering and rewire the strip to the shared formatter

## 5. Shared AppHeader component (screen-headers)

- [x] 5.1 Write failing tests for `AppHeader`: renders title (or wordmark), optional subtitle,
      optional white back-arrow button (accessible label) left of the title, optional right slot,
      children block; long title wraps
- [x] 5.2 Implement `AppHeader` against the existing indigo header styling

## 6. Tab screens adopt AppHeader

- [x] 6.1 Tagebuch: header keeps wordmark + date nav + day totals via `AppHeader` children
      (behavioral no-op; tests assert wordmark + no body screen-title)
- [x] 6.2 Rezepte list: header title "Rezepte"; remove the body `<h1>`; tests assert no duplicate
      heading
- [x] 6.3 Einstellungen: header title "Einstellungen"; body "Ernährungsziel" stays a section
      heading; tests assert no "Einstellungen" body heading
- [x] 6.4 Wochenplan: header title "Wochenplan" + week stepper + rollups moved into the header;
      tests assert rollups render in the header and no body "Wochenplan" heading

## 7. Recipe sub-screens adopt AppHeader (recipes back-nav delta)

- [x] 7.1 Recipe Detail: white in-header back arrow + recipe-name title + "Ergibt {N} Portionen"
      subtitle; remove body h1/arrow; back arrow still returns to the list (update existing
      back-nav tests)
- [x] 7.2 Recipe Editor: white in-header back arrow + "Neues Rezept" / "Rezept bearbeiten" title;
      remove body h1; back arrow still cancels; no `×` (update existing tests)

## 8. Verification

- [x] 8.1 Full test suite, lint, typecheck, build green in both workspaces
- [x] 8.2 Chrome smoke test at mobile width against the handoff screenshots (headers on all six
      screens, triplet strings on diary/recipes/sheet, single Pro-Portion strip)
- [x] 8.3 `openspec validate unify-screen-headers-and-display-format --strict` passes
