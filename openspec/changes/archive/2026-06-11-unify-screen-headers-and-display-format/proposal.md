# Proposal: unify-screen-headers-and-display-format

## Why

Handoff 2 (`design_handoff_forkcast_2/`) declares one app-wide consistency rule — **the indigo
header always names where you are** — and a single macro-triplet display format. The shipped app
still shows the old pattern the handoff explicitly calls a regression: Rezepte / Einstellungen /
Recipe Detail / Recipe Editor render a wordmark-only header plus a duplicate in-body `<h1>` (Detail
and Editor with a purple in-content back arrow), the Wochenplan demotes its title and week rollups
to a body card, and macro triplets render in three competing formats across screens (`40 P / 0 C /
26 F`, `8g P · 35g K · 4g F`, `8g Eiweiß · 35g KH · 4g Fett`).

## What Changes

- **Unified header system** (new capability `screen-headers`): every screen's title lives inside
  the indigo header. Tab screens show their name (Planen → "Wochenplan", Rezepte → "Rezepte",
  Einstellungen → "Einstellungen"); Tagebuch keeps the "forkcast" wordmark as the home anchor.
  Sub-screens (Recipe Detail, Recipe Editor) show a **white back arrow + entity title + optional
  subtitle** inside the header. No screen repeats its title as a heading in the scroll body.
- **Recipe Detail / Editor headers** move from the in-body purple arrow + `<h1>` into the header
  (**BREAKING** for the existing `recipes` back-nav requirement, which pins the arrow "inline to
  the left of the heading, aligned to the content edge"). Detail header carries the recipe name +
  subtitle "Ergibt N Portionen"; Editor header carries "Neues Rezept" / "Rezept bearbeiten".
- **One macro-triplet format everywhere**: `{P} P · {KH} KH · {F} F` — middot separators, label
  "KH" (never "K" or "C"), integer-rounded values without `g` suffix (e.g. `38 P · 67 KH · 11 F`).
  Applies to diary entry rows and slot totals, recipes list rows, recipe detail Pro-Portion strip,
  recipe editor ingredient sub-lines and hero scenarios, and the add-food confirm per-100 line.
  Rate strings (`372 kcal / 100g`) keep the slash — that is a rate, not a macro triplet.
- **Recipe detail nutrition strip becomes the single Pro-Portion line** — the secondary
  `Bei {N} Portionen` scaled-total line is **REMOVED** (decided 2026-06-11); the Portionen stepper
  scales the displayed ingredient quantities only.
- Recipes list rows gain the `/ Portion` suffix after the macro triplet.

Out of scope (decided 2026-06-11): the traffic-light status coloring of the diary/planner header
values stays as-is (the design's neutral white kcal line is not adopted); purely visual
re-compositions are tracked in `ui-polish-backlog.md`, not here.

## Capabilities

### New Capabilities

- `screen-headers`: the app-wide header rule — two header shapes (tab header with screen name /
  wordmark; sub-screen header with white back arrow + entity title + optional subtitle), and the
  prohibition on repeating the screen title in the scroll body.

### Modified Capabilities

- `recipes`: header back navigation moves into the indigo header (white arrow left of the in-header
  title, subtitle on Detail); list-row macro line reformatted + `/ Portion` suffix; detail nutrition
  strip reduced to the single Pro-Portion line (Bei-N line removed); ingredient-editor sub-line and
  hero scenario strings reformatted to the unified triplet.
- `meal-log-display`: per-entry macro suffix and slot-total macro format change from
  `· {P}g P · {C}g K · {F}g F` to `· {P} P · {KH} KH · {F} F`.
- `nutrient-display-format`: the full-entry confirm per-100 readout presents macros as the unified
  triplet (no `g` suffix on values); per-100 rate denominators are unchanged.

## Impact

- **Frontend only** — no backend, API, or domain changes.
- Affected components: the app header (new shared header component), `recipe-detail.tsx`,
  `recipe-form.tsx`, recipes list, planner screen header, settings screen, diary `entry-row.tsx` /
  slot cards, `full-entry-confirm.tsx`; a shared macro-format helper in the i18n/format layer
  replaces the scattered format strings.
- Existing tests asserting the old strings (`g P`, `g K`, slashes, in-body headings) will be
  updated as part of TDD test-first work.
