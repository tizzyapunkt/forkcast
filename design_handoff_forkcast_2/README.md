# Handoff: forkcast — Recipe & Food-Logging UI

## Overview
forkcast is a German-language calorie / macro tracking mobile app (iOS-style). This package
documents a redesign prototype centered on **recipe creation & editing**, the **recipe detail**
view, and the **add-food bottom sheet** — plus the surrounding shell (diary, planner, settings,
bottom nav). The most heavily iterated screens are the **Recipe Editor** and the **Add-food sheet**;
implement those with the most care.

---

## ⚠️ Before you write code: this is an OpenSpec project

This repository uses **OpenSpec** for spec-driven development. This redesign changes *user-visible
behavior* (a new ingredient measurement-mode control, the add-food sheet sub-steps, live
nutrition recompute, servings scaling, nav-hiding on recipe sub-screens). Those are changes to
**capabilities/requirements**, so they MUST go through an OpenSpec change proposal **before**
implementation — do not implement straight from this README. Skipping this leaves
`openspec/specs/` out of sync with the shipped app and corrupts the source of truth for the next
change.

Follow the **Propose → Apply → Archive** flow:

0. **Read the current state first.** Run `openspec list` and read the relevant existing specs under
   `openspec/specs/` (see the mapping table below) before writing anything. Read the convention
   files too: root **`CLAUDE.md`** (architecture, DDD/CQRS, **mandatory TDD**, the React + TS +
   Tailwind v3 + shadcn/ui + React Query + vaul + lucide stack) and root **`AGENTS.md`** (monorepo /
   run commands). There is **no** `openspec/project.md` or `openspec/AGENTS.md`; `openspec/config.yaml`
   just sets `schema: spec-driven`.
1. **Propose — TWO separate changes** (the planner is greenfield and stays on its own; see the
   planner callout). Scaffold each as `openspec/changes/<change-id>/`:
   - **Change A — `redesign-recipe-editor-and-add-food`:** the recipe editor / detail / add-food
     deltas (all rows in the mapping table EXCEPT the planner).
   - **Change B — `add-weekly-meal-plan`:** the brand-new weekly planner capability (ADDED only).

   Each change contains:
   - `proposal.md` — why + what is changing + impact (list the affected capabilities).
   - `design.md` — the cross-cutting UX decisions (this redesign spans several capabilities; the
     existing archived changes in this repo all carry a `design.md`, so match that convention).
   - `tasks.md` — numbered implementation checklist (small, implementation-ready, **test-first**
     tasks per CLAUDE.md's TDD rule; check off with `[x]` as you go).
   - `specs/<capability>/spec.md` **per affected capability** — the **spec deltas**, with sections
     marked `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`. Each
     requirement needs at least one `#### Scenario:` with Given/When/Then bullets (this is how the
     existing specs are written — match the house style exactly).
2. **Validate & align.** `openspec validate <change-id> --strict`; review and refine the deltas with
   the user until they match intent. Get approval before coding. Validate **both** changes.
3. **Apply.** Implement each change (per the rest of this README) against its `tasks.md`, test-first.
   The two changes are independent and can be proposed/shipped in either order.
4. **Archive.** Once a change is shipped and verified, `openspec archive <change-id>` — this merges
   its deltas into the source-of-truth `openspec/specs/`. Archive each change separately.

### Capability mapping (verified against the repo's `openspec/specs/`)

Map the redesign onto these **existing** capabilities — do not invent parallel ones. Treat this as a
starting hypothesis and confirm each against the current spec text before writing the delta:

| Redesign area (this README) | Capability | Likely delta |
|---|---|---|
| Gewicht·Stück·Frei measurement control; live Pro-Portion recompute; servings scaling; ingredient-row data model; steps editor | **`recipes`** | MODIFIED (piece quantity already exists here; the segmented control + the "Frei"/untracked mode + hero-card placement are the changes) |
| Bottom nav **hidden** on recipe detail/editor sub-screens | **`bottom-navigation`** | MODIFIED — the current spec says the bar is visible on *every* primary screen; add the sub-screen exception |
| Add-food sheet → **Rezepte** tab → RecipePortionStep (log a recipe by portions) | **`log-recipe`** | MODIFIED — the portion-step UI/flow |
| Add-food sheet → **Zuletzt** tab | **`recently-used-ingredients`** | likely no change (verify the tab matches the spec) |
| Add-food sheet → **Suche** tab / source toggle | **`ingredient-search-source-toggle`** (+ `curated-foods-source`) | verify only |
| AmountStep gram pre-fill from serving size | **`ingredient-serving-size`** | verify only — pre-fill behavior already specified |
| Add-food sheet **sub-step navigation + tab-bar hiding** (catalog food & recipe both push a detail step that hides the tabs, header back arrow restores them) | **no single existing capability** | this is a new cross-cutting flow — decide with the user whether it's a new capability (e.g. `add-food-sheet`) or folded into `log-recipe` + the search/recent capabilities. Flag it; don't silently bury it. |
| **Weekly planner (`PlannerScreen`)** — weekly meal overview, per-day calorie/macro rollups, the `Liste` layout | **NEW capability** (e.g. `weekly-meal-plan`) — **none exists yet** | **ADDED Requirements only** — a brand-new `spec.md`. See callout below. |

> **⚠️ The weekly planner is a COMPLETELY NEW capability — it must be proposed through OpenSpec.**
> There is currently **no planner/meal-plan spec** under `openspec/specs/` (CLAUDE.md lists weekly
> planning as a core product capability, but it has never been spec'd). So the planner is **not** a
> delta to an existing capability — it needs its **own new capability spec** (suggested id
> `weekly-meal-plan`) consisting entirely of `## ADDED Requirements`, each with Given/When/Then
> scenarios covering: the weekly grid/list, per-day and per-week calorie + macro rollups against the
> user's goals, and how planned meals relate to logged entries. **It ships as its own separate change
> proposal (`add-weekly-meal-plan`), kept out of the editor/add-food redesign change** — this is a
> settled decision. Only the selected **`Liste`** layout is in scope; `Agenda`/`Raster` were
> ruled out and must not be spec'd.

> **Variants are design-exploration only.** The Tweaks panel and the alternative variants
> (`Menü` measurement control, `Agenda`/`Raster` planner, `Alarm-Rot` tone) must **not** become spec
> requirements — record only the **selected** decisions (see *Selected design decisions* below). The
> Tweaks panel and device frame are prototyping aids and get no spec and no code.

---

## About the Design Files
The files in `design/` are **design references built in HTML/React (via in-browser Babel)** — they
are prototypes showing intended look and behavior, **not production code to ship directly**. Your
task is to **recreate these designs in the target codebase's real environment**, using its
established framework, component library, state management, and styling conventions.

The original product is a React + TypeScript + Tailwind app (the tokens in `fc-tokens.css` were
lifted from its `tailwind.config.ts` / `index.css`). If you are implementing into that codebase, map
the values below onto the existing Tailwind theme rather than introducing new CSS. If no environment
exists yet, React + TypeScript + Tailwind is the recommended target.

All UI copy is **German** — keep it. (The original app uses an i18n layer; string keys for these
screens live under recipe/addFood/recipeDetail namespaces. Reuse them where present.)

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, shadows, and interactions are final
and intentional. Recreate pixel-accurately using the codebase's existing primitives. The exact
token values are listed under **Design Tokens** below and in `design/fc-tokens.css`.

## Running the reference
Open `design/forkcast.html` in a browser. It renders inside a simulated iPhone frame (402×874 pt
content area). A **Tweaks** panel (top-right) toggles design variants — see **Variants** below.
No build step; React/Babel load from unpkg.

---

## App shell

- **Frame / canvas:** content area 402×874 px (iPhone-class). The app is a single full-height
  flex column (`.fc-app`): scrolling content region (`.fc-scroll`) + fixed bottom nav.
- **Header (ONE rule app-wide — see "Header system" below):** indigo gradient (`--header-grad`),
  white text. **The header always names where you are.** Top-level tabs put their own name in it
  (Tagebuch shows the "forkcast" wordmark as the home anchor; Planen → "Wochenplan", Rezepte →
  "Rezepte", Einstellungen → "Einstellungen"). Sub-screens (recipe detail / editor) put a **white
  back arrow + the entity title** in the header. The title is **never** repeated as a separate `<h1>`
  in the scroll body.
- **Bottom nav (`BottomNav`):** 4 tabs — **Tagebuch** (diary), **Planen** (planner),
  **Rezepte** (recipes), **Einstellungen** (settings). Icon + label; active tab in `--primary`.
  The nav is **hidden** whenever the user is inside a recipe sub-screen (detail or editor) for focus.
- **Min touch target:** 44px everywhere (`--tap`). Icon buttons are 44×44 by default.

---

## Header system — the ONE consistency rule (recently unified — verify this first)

The single most important consistency rule in this app, and the focus of the latest iteration:

> **The purple header always names where you are.** The screen title lives **inside** the indigo
> header bar, never as a separate heading in the scroll body.

Two header shapes, nothing else:

| Header type | Used by | Contents |
|---|---|---|
| **Tab header** | Tagebuch, Planen, Rezepte, Einstellungen | Screen name on the left (Tagebuch shows the **"forkcast"** wordmark as the home anchor; the others show **"Wochenplan" / "Rezepte" / "Einstellungen"**). Diary & Planner additionally carry a date stepper / daily-totals block. |
| **Sub-screen header** | Recipe Detail, Recipe Editor | **White back arrow** (chevron-left, 22px) on the **left** + the **entity title** (e.g. the recipe name) + optional subtitle ("Ergibt 4 Portionen"). Optional right-aligned slot. |

Shared component: `SimpleHeader({ title, subtitle, onBack, right })` in `fc-recipes.jsx` — title
21px/700 (`-0.02em`), subtitle 13px/500 at 72% white, back arrow is a 36px white icon button.
Both shapes use the same `--header-grad` background and `52px 18px 16px` padding.

**What this replaced (so you recognize the old pattern if you see it anywhere):** previously
Rezepte/Einstellungen/Detail/Editor had a thin wordmark-only header **plus** a redundant `<h1>` (and
on Detail, a purple back arrow) inside the content. That duplication is gone — if you find a screen
repeating its title below the header, it's a regression.

---

### 1. Recipe List (`RecipesScreen`)
- **Purpose:** browse saved recipes; entry points to create / import.
- **Header:** tab header titled **"Rezepte"** (no actions in the header).
- **Layout:** scroll view, 16px padding. A **toolbar row** of two equal-width (flex:1) buttons:
  ghost **"Aus Fotos"** (camera icon) and primary **"Neu"** (plus icon), 8px gap, 14px bottom margin.
  Below: vertical stack of recipe cards, 10px gap.
- **Recipe card:** `.fc-card`, 14×16px padding, flex row: 44×44 rounded icon tile
  (`--accent-soft` bg, cook glyph in `--primary`) · title (15.5px/650, truncated) · per-portion
  line `"{kcal} kcal · {P}/{KH}/{F} / Portion"` (kcal in `--primary`/700, macros muted) ·
  ingredient count (faint) · trailing chevron.

### 2. Recipe Detail (`RecipeDetail`)
- **Purpose:** read a recipe, scale servings, edit/delete.
- **Header (sub-screen header):** white back arrow + recipe name as the title + subtitle
  "Ergibt N Portionen". `<SimpleHeader title={recipe.name} subtitle={…} onBack={…} />`.
  The long title wraps cleanly inside the header (`overflow-wrap:break-word`); it is **not** repeated
  in the body.
- **Actions row (first thing in the scroll body, right-aligned):** ghost **"Bearbeiten"** (pencil) +
  danger trash icon button (opens delete confirm).
- **Pro-Portion card:** `.fc-card`, header strip with `--accent-soft` bg: eyebrow "Pro Portion"
  (in `--primary`) + `"{kcal} kcal · {P} P · {KH} KH · {F} F"` (tabular nums, **middot separators**).
- **Zutaten (ingredients):** "Zutaten" h2 + a **Portionen** stepper on the right that **scales all
  quantities live**. Divided list (`.fc-divide`): each row = name (15px/550) + optional
  "Nicht gezählt" chip + optional italic note; right-aligned quantity. Quantity display logic:
  free-text `displayQty` if present, else piece form `"{count} {label} (≈ {grams} {unit})"`,
  else `"{amount×scale} {unit}"`.
- **Schritte (steps):** numbered list; each step has a 26px rounded index badge (`--accent-soft`,
  `--primary`) + step text (14.5px, line-height 1.5).

### 3. Recipe Editor (`RecipeEditor`) — PRIMARY SCREEN
Reached via "Neu" (empty) or "Bearbeiten" (seeded from a recipe). **Sub-screen header:** white back
arrow + title **"Neues Rezept" / "Rezept bearbeiten"** (`<SimpleHeader title={…} onBack={onCancel} />`).
The back arrow calls the cancel handler — same header pattern as Recipe Detail (no "x", no duplicate
title in the body).

Top-to-bottom (scroll body):
1. **Name field** — labeled text input, placeholder "z. B. Bolognese".
2. **Pro-Portion HERO card (top of the form — this placement is intentional & important):**
   - `.fc-card` with a subtle `linear-gradient(180deg, --accent-soft, --card)` fill.
   - Header row: eyebrow "Pro Portion" (in `--primary`) on the left; on the right a compact
     "Ergibt [stepper] Portionen" group (servings stepper co-located here).
   - Big **kcal** number: 34px/800, `-0.025em` tracking, with "kcal" label beside it.
   - Macro row: three items, each a colored dot + label (Eiweiß/KH/Fett) + value "Ng".
     Dot hues: P = `hsl(244 60% 55%)`, KH = `hsl(28 60% 55%)`, Fett = `hsl(199 60% 55%)`.
   - Footer line (top border): "Gesamt {kcal} kcal für {n} Portion(en)".
   - **All values recompute live** from the ingredient rows ÷ servings.
3. **Zutaten section:** "Zutaten · N" h2 + ghost "Hinzufügen" button. Divided list of
   **ingredient rows** (see below).
4. **Schritte section:** "Schritte" h2 + ghost "Schritt" button. Each step: index badge + text
   input + remove icon button. Empty state text when none.
5. **Actions:** ghost "Abbrechen" + primary "Speichern"/"Anlegen" (flex 1 / 1.4, 50px tall).

#### Ingredient row (`IngredientRow`) — the core interaction
Each row is a vertical stack (10px gap):
- **Title row:** ingredient name (15.5px/600; muted color when untracked) · a subtle
  **"+ Notiz"** ghost text button (icon + label, NO border/pill — plain text button in `--text-3`)
  shown only when no note is open · a danger "x" remove icon button.
- **Measurement-mode control** — a single control that replaces the older pair of ambiguous
  chips. Three modes: **Gewicht · Stück · Frei**. Two visual styles (tweakable, see Variants):
  - **Segmentiert (default & SELECTED):** a segmented toggle on `--muted` track, 3px padding; active
    segment is white with `--shadow-card`, label in `--primary`/700; inactive labels `--muted-fg`/550.
    **Implementation note:** transition only `color` here — do NOT add a `background`/`background-color`
    or `box-shadow` transition. Animating those *to* `transparent`/`none` gets stuck in some engines
    (the previously-active segment keeps its white background while the body switches), which reads as
    a broken toggle. The background/shadow must change instantly.
  - **Menü:** a compact chip button "Nach Gewicht ▾" that opens a popover (232px, `--shadow-pop`)
    listing the 3 modes with title + sub-label; active item highlighted in `--accent-soft`.
- **Mode body (`ModeBody`)** — inputs depend on the active mode:
  - **Gewicht (weight):** number input (92px, right-aligned, 16px/600) + unit label, then a faint
    live nutrition line `"{kcal} kcal · {P}/{KH}/{F}"`. This drives the recipe's nutrition.
  - **Stück (piece):** a **count stepper** × a **piece-name** text input (e.g. "großes Ei"); below,
    an editable **"pro Stück ≈ [N] {unit}"** number input, then a live readout
    `"= {grams} {unit} · {kcal} kcal"`. Grams = count × gramsPer; this is **tracked** nutrition,
    just entered by piece.
  - **Frei (free / "nicht zählen"):** a **free amount** input (78px, "Menge") + a **free unit**
    text input ("Einheit — z. B. TL, Prise, nach Geschmack"), plus a caption:
    "Zählt nicht in die Nährwerte — nur als Hinweis im Rezept." This mode is **excluded from all
    nutrition totals.** When seeding from existing data, a stored `displayQty` like `"1 TL"` is
    split into amount (`1`) + unit (`TL`).
- **Note (collapsible):** when opened, an inline italic text input ("Notiz, z. B. fein gehackt")
  with a pencil icon and a remove "x". Collapsed by default unless the row already has a note.

> **Data model for a row:** `{ key, name, unit, per100:{kcal,p,c,f}, amount, note,
> untracked:bool, piece:{count,label,gramsPer}|null, free:{qty,unit}|null }`.
> Mode is derived: `piece ? 'piece' : untracked ? 'free' : 'weight'`. Gram-equivalent that drives
> nutrition: piece → `count×gramsPer`, else → `amount`; free rows contribute 0.

### 4. Add-food Bottom Sheet (`AddFoodSheet`) — PRIMARY SCREEN
Opened from a "+" on any diary meal slot. A bottom sheet (`Sheet`) that slides up, dim backdrop,
rounded top corners, drag-handle, max-height 88%.

- **Header:** drag handle, then a row with — when in a sub-step — a **back arrow icon button on the
  LEFT of the title** (this is the same header-arrow pattern as Recipe Detail; the arrow lives in
  the sheet header, never on its own line), the title `"Zu {Mahlzeit} hinzufügen"`, and a text
  **"Abbrechen"** on the right.
- **Root state:** segmented **Tabs** — Suche / Zuletzt / Rezepte / Schnell — over the matching tab
  body (search results, recents, recipe list, manual quick-add form).
- **Sub-steps (IMPORTANT — recently revised):** when the user picks a catalog food **or** a recipe,
  the sheet swaps to a detail step and the **tab bar is hidden** (only the back arrow + step content
  show). Both sub-steps are rendered at the sheet level, not nested inside a tab:
  - **AmountStep** (catalog food): food name + per-100 macro line, a **Menge** number input, quick
    chips (25/50/100/150/200), a live kcal/macro summary card, and a primary
    "{n} {unit} erfassen" button.
  - **RecipePortionStep** (recipe): recipe name + "Rezept ergibt N Portionen", a **portions**
    stepper, live totals card, primary "Erfassen" button.
  - The header back arrow returns to the list **and restores the tab bar.**

### 5. Diary (`DiaryScreen`), Planner (`PlannerScreen`), Settings (`SettingsScreen`)
Supporting screens, present for context. Diary = daily totals header + meal-slot cards with entries
(swipe/x to remove, "+" to add → opens the sheet). Planner = weekly overview with 3 layout variants.
Settings = standard list. See the respective `design/fc-*.jsx` files; these were not the focus of
this iteration but are styled with the same tokens.

---

## Interactions & Behavior
- **Live recompute:** editing any tracked ingredient (weight or piece) instantly updates the
  Pro-Portion hero (kcal + macros) and "Gesamt" line. Free rows never affect totals.
- **Servings scaling:** the detail view's Portionen stepper scales displayed quantities; the
  editor's hero stepper changes the per-portion divisor.
- **Mode switching** preserves sensible defaults: switching to Stück seeds `{count:1, label:'Stück',
  gramsPer: amount||50}`; switching to Frei seeds `{qty: amount||1, unit:''}`; switching to Gewicht
  clears piece/untracked.
- **Sheet sub-steps** hide the tab bar and surface a header back arrow; closing/cancel resets
  sub-step state after the slide-out (≈300ms).
- **Nav hiding:** bottom nav hides on recipe detail/editor.
- **Animations:** sheet slide-in `transform .28s cubic-bezier(.3,.8,.3,1)`; backdrop fade `.25s`;
  popovers/step bodies use `fc-pop-in .22s cubic-bezier(.2,.7,.3,1)`. Button press `scale(.975)`,
  icon button press `scale(.92)`. Respect `prefers-reduced-motion`.
- **Focus states:** inputs get `border-color:--accent` + 3px `--accent-soft` ring on focus.

## State Management
Per the reference (`forkcast.html` App component) — recreate with the codebase's preferred approach:
- `tab` — active bottom-nav tab.
- Diary: `log` (entries per meal slot), `dayOffset`, `addSlot` (which slot's sheet is open).
- Recipes: `recipes` list, `recipeMode` (`list|detail|editor`), `activeRecipe`.
- Add-food sheet (local): `tab`, `amountItem` (catalog food picked), `recipeItem` (recipe picked).
  A sub-step is open when either is set; `onBack` clears the relevant one.
- Recipe editor (local): `name`, `servings`, `rows[]` (ingredient model above), `steps[]`.
- Tweaks: `plannerLayout`, `measureStyle`, `zeroTone` (persisted; design-exploration only — see below).

## Selected design decisions (IMPLEMENT THESE — not as toggles)
During design we explored several variants via a Tweaks panel. **The selections below are final.
Implement exactly these; the Tweaks panel itself is a prototyping aid and must NOT be ported, nor
should the other variants be built.** The alternatives are listed only so you understand what was
ruled out.

| Decision | **Ship this** | Ruled out (do not build) |
|---|---|---|
| Ingredient measurement control (Maß-Steuerung) | **`Segmentiert`** — the Gewicht·Stück·Frei segmented toggle | `Menü` dropdown variant |
| Weekly planner layout (Wochenplan) | **`Liste`** | `Agenda`, `Raster` |
| Diary remaining-calories tone (Status bei Defizit) | **`Neutral`** | `Alarm-Rot` |

> In the reference (`forkcast.html`), these correspond to the `TWEAK_DEFAULTS` values
> `measureStyle: "Segmentiert"`, `plannerLayout: "Liste"`, `zeroTone: "Neutral"`. The components
> accept a prop for the variant — when porting, **hard-code the selected value** (e.g. always render
> `ModeSegments`, never `ModeMenu`) rather than carrying the prop through.

## Screenshots
In `screenshots/` (PNG, captured from the current reference, ~450×920 device frame). These reflect
the **selected** variants (Segmentiert / Liste / Neutral) and the **unified header system**:
- `01-diary.png` — Tagebuch (tab header = "forkcast" wordmark + date stepper + daily totals).
- `02-recipes-list.png` — Rezepte list (tab header "Rezepte"; two-button toolbar in the body).
- `03-recipe-detail.png` — Recipe Detail (sub-screen header: back arrow + recipe name + "Ergibt 4
  Portionen"; Pro-Portion line uses middot separators).
- `04-recipe-editor.png` — Recipe Editor (sub-screen header "Rezept bearbeiten"; Pro-Portion hero).
- `05-addfood-sheet.png` — Add-food sheet, root tabs (Suche/Zuletzt/Rezepte/Schnell).
- `06-addfood-amount.png` — Add-food amount sub-step (tab bar hidden, header back arrow).
- `07-planner.png` — Wochenplan (tab header "Wochenplan" + weekly rollups; Liste layout).
- `08-settings.png` — Einstellungen (tab header "Einstellungen").

---

## ✅ Consistency checklist (use this to double-check the build)
This package was produced after a consistency pass. Verify each item — a failure here is a regression:

1. **Header names the screen.** Every screen's title sits in the indigo header. No screen repeats its
   title as an `<h1>` in the scroll body. (Old regression: Rezepte/Einstellungen/Detail/Editor used
   to show a wordmark-only header **plus** a duplicate heading below it.)
2. **Back affordance = white arrow in the header**, left of the title, on sub-screens (Recipe Detail,
   Recipe Editor). Not a `--primary`-colored arrow inside the content, not an "x".
3. **Tagebuch keeps the "forkcast" wordmark** in its header (intentional home anchor); the other
   three tabs show their screen name.
4. **Macro triplets use middot separators everywhere:** `38 P · 67 KH · 11 F` — never slashes.
   (Old regression: Recipe Detail's Pro-Portion line used `/`.) Note: the per-unit energy figure in
   add-food rows, `"42 kcal / 100ml"`, legitimately keeps the slash — that's a rate, not a macro triplet.
5. **`fc-h2` sub-headings render at a consistent size** within a screen (e.g. Diary's meal-slot and
   weight cards both 16.5px) — no per-card size drift.
6. **Tokens only.** Colors/radii/shadows/type come from `fc-tokens.css` — no ad-hoc hex or sizes.
7. **44px min touch targets** on every interactive element (`--tap`).
8. **Selected variants only** (Segmentiert / Liste / Neutral) — the Tweaks panel and device frame are
   prototyping aids and are not part of the product UI.

## Design Tokens
All in `design/fc-tokens.css`. Key values (map onto existing Tailwind theme where possible):

**Color**
| Token | Value | Use |
|---|---|---|
| `--bg` | `hsl(300 100% 99%)` | page bg (pink-white) |
| `--fg` | `hsl(0 0% 20%)` (#333) | primary text |
| `--card` | `hsl(240 100% 98%)` (#f5f5ff) | card bg (lavender) |
| `--primary` | `hsl(244 36% 44%)` | indigo — header, primary btn |
| `--primary-700` | `hsl(244 36% 36%)` | pressed/hover |
| `--accent` | `hsl(249 72% 65%)` (#7a67e6) | focus ring, highlights |
| `--accent-soft` | `hsl(249 72% 65% / 0.12)` | soft accent fills |
| `--muted` | `hsl(240 33% 94%)` (#ebebf5) | chips, segmented track |
| `--muted-fg` | `hsl(0 0% 36%)` (#5c5c5c) | secondary text |
| `--text-2` / `--text-3` | #5c5c5c / #8a8a8a | secondary / faint text |
| `--border` / `--border-soft` | `hsl(240 9% 78%)` / `hsl(240 14% 88%)` | borders |
| `--destructive`/`--error` | `hsl(0 84% 60%)` (#ef4444) | destructive |
| `--success` / `--warning` | #10b981 / #f59e0b | status |
| macro dots | P `hsl(244 …)`, KH `hsl(28 …)`, Fett `hsl(199 …)` | nutrition dots |
| `--header-grad` | `linear-gradient(160deg, hsl(244 36% 47%), hsl(244 38% 40%))` | header |

**Radius:** `--radius` 12px · `--radius-sm` 9px · `--radius-lg` 18px · pills 999px · icon btn 11px.
**Shadow:** `--shadow-card` `0 1px 2px rgba(48,42,92,.05),0 1px 3px rgba(48,42,92,.04)` ·
`--shadow-pop` `0 8px 28px rgba(38,32,74,.16),0 2px 8px rgba(38,32,74,.10)` ·
`--shadow-fab` `0 6px 18px rgba(74,69,150,.42)`.
**Touch target:** `--tap` 44px (min for all interactive elements).
**Font:** system stack — `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`.

**Type scale:** h1 21px/700 (`-0.01em`) · h2 17px/650 · eyebrow 11px/600 uppercase `0.06em`
· body 14–16px · numbers use `font-variant-numeric: tabular-nums`. Editor hero kcal 34px/800.
**Buttons:** 44px min height, 9px radius, 15px/600. Primary = `--primary` bg / white; ghost =
transparent / `--primary` text / `--border`; soft = `--muted`; danger = transparent / `--error`.

## Assets
- **Icons:** inline SVG paths defined in `design/fc-icons.jsx` (stroke-based, 24px viewBox). Map to
  the codebase's icon set (e.g. lucide-react) — names used: chevL/chevR/chevD, plus, x, minus,
  check, pencil, trash, camera, search, cook, reset, etc. No raster image assets.
- **No fonts to bundle** — system font stack.
- **No logos** beyond the "forkcast" wordmark (plain text).

## Files (in `design/`)
- `forkcast.html` — entry point; App component wires screens, state, nav, and Tweaks.
- `fc-tokens.css` — **all design tokens + base component classes** (start here for styling).
- `fc-recipes.jsx` — RecipesScreen, RecipeDetail, **RecipeEditor + IngredientRow + ModeSegments /
  ModeMenu / ModeBody** (the primary work).
- `fc-addfood.jsx` — **AddFoodSheet + AmountStep + RecipePortionStep** (primary work) + tabs.
- `fc-ui.jsx` — shared primitives: `IconBtn`, `Stepper`, `Sheet` (note the header `onBack` prop),
  `Tabs`, `Confirm`, `CatalogRow`, `fmt` helpers.
- `fc-icons.jsx` — icon set. `fc-data.js` — sample data + nutrition math (`recipeTotals`, etc.).
- `fc-diary.jsx`, `fc-planner.jsx`, `fc-settings.jsx` — supporting screens.
- `frames/ios-frame.jsx`, `tweaks-panel.jsx` — prototype scaffolding only; **do not port** (the
  device frame and tweaks panel are presentation aids, not part of the product UI).
