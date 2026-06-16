# Handoff: Resolve Unmatched Ingredients

## Overview
This package documents the **resolve-unmatched-ingredients** feature for **forkcast** (a German-language calorie/macro tracking app). When a recipe is imported from photos (AI/OCR), most ingredients auto-match the food catalog, but some don't ("3 Zutaten ohne Treffer"). Today those are silently dropped on save and can only be fixed on a laptop. This feature lets the user **resolve them on the phone, in the moment**: an AI batch call proposes a resolution per unmatched item (map to an existing food, create a new food, or skip), the user reviews/edits and confirms in a **show-and-confirm sheet**, and the confirmed entry both drops back into the ingredient list (with its original amount/unit/note) and persists to a runtime `USER` overlay so the same miss never recurs.

The same show-and-confirm sheet has **two hosts**, and must be built **once** as a reusable component:
1. **Import review** — the unmatched-ingredients panel on the "Rezept prüfen" screen.
2. **Add-food search** — the "nichts gefunden" empty state in the food-logging search (create-if-missing).

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — runnable prototypes showing intended look and behavior, **not production code to copy directly**. The prototype uses in-browser Babel, global `window` exports, and demo data; none of that should ship.

Your task is to **recreate these designs in forkcast's real codebase** (React + TypeScript + Tailwind — see the `frontend/` reference in the main project) using its established components, design tokens, and patterns. The existing real components to extend are `LogIngredientDrawer` / `SearchPanel` (add-food) and the AI-import review screen. Treat the HTML as the visual + interaction spec; wire it to the real endpoints described under **Backend Contract**.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, motion, and copy (German) are all specified below and in `fc-tokens.css`. Recreate pixel-faithfully using forkcast's existing UI library; where this prototype defines a token, map it to the codebase's equivalent rather than hardcoding.

---

## Screens / Views

### 1. Import Review — Unmatched Panel (Host A)
**File:** `fc-import.jsx` (`ImportReview`, `UnmatchedPanel`, `UnmatchedRow`)
**Screen label:** "Rezept prüfen" (review screen reached via Rezepte → "Aus Fotos").

**Purpose:** After photo import, let the user confirm the parsed recipe and resolve any ingredients that didn't match the catalog.

**Layout (top → bottom), single scroll column, 16px horizontal padding:**
- **Unmatched panel** (the centerpiece — only rendered when ≥1 unmatched item).
- Recipe **Name** input.
- **Pro Portion** hero card (kcal + macro dots + servings stepper).
- **Zutaten** list (matched ingredients; resolved rows land here).
- **Schritte** (numbered steps).
- Footer actions: "Abbrechen" / "Rezept anlegen".

**Unmatched panel — structure:**
- Card, padding `15px 16px 6px`. Tone is tweakable: **Amber** (default) = background `hsl(38 92% 50% / 0.09)`, border `1px solid hsl(38 92% 50% / 0.5)`; **Neutral** = `var(--card)` + `var(--border-soft)`.
- Header row: a 30×30 rounded icon tile (sparkles, `var(--warning)` on amber / `var(--primary)` on neutral) + heading **"{n} Zutaten ohne Treffer"** (16px/700) + sub-copy "Tippe „Zuordnen", um den KI-Vorschlag zu prüfen, anzupassen oder manuell zu suchen." (12.5px, `var(--muted-fg)`).
- A divided list (`fc-divide`, 1px `--border-soft` separators) of **unmatched rows**.

**Unmatched row — structure (each row):**
- Left block (flex:1, min-width:0):
  - Title line: **ingredient name** (15.5px/650, truncates with ellipsis, `white-space:nowrap`) immediately followed by **amount + unit** (`13px/600`, `var(--muted-fg)`, `flex-shrink:0` so it never wraps). *The amount must stay pinned next to the name on the same baseline; only the name truncates.*
  - Optional **note** line below (12.5px italic, `var(--text-3)`), e.g. "getrocknet in Öl".
- Right controls (flex, gap 4, flex-shrink:0): the **resolve affordance** + a **discard ✕** icon button (36×36, danger). *There is no longer a separate manual "+" on the row — manual search lives inside the sheet.*

**Resolve affordance — 3 tweakable styles (`resolveStyle`):**
- **Knopf** (default): solid primary button, 36px min-height, sparkles icon + "Zuordnen".
- **Badge**: pill `var(--accent-soft)` bg, "✦ KI ›".
- **Vorschau**: under the name, an inline proposal preview chip ("Neu · {name}" / "Treffer · {name}") + a small "Bestätigen" quick-confirm button.

**Per-row affordance states:**
- **loading** (proposal in flight): spinner + "KI prüft…" (`var(--primary)`, 12.5px).
- **error**: a chip "↻ Erneut" (`var(--error)` on `hsl(0 84% 60% / 0.1)`) that reopens/retries.
- **no proposal / skip**: faint "Kein Vorschlag" text (affordance disabled), discard still available.
- **ready**: the styled affordance above.

**All-resolved state:** when the last item is resolved, the panel collapses to a success card — green 32px check tile + "Alle Zutaten zugeordnet" + "{n} neue Einträge in deiner Bibliothek gespeichert." (`fc-anim-pop` entrance).

### 2. Show-and-Confirm Sheet (REUSABLE — the core component)
**File:** `fc-resolve.jsx` (`ResolvePane`, `ResolveSheet`, `ProposalContent`, `ManualMatch`)

A bottom sheet (`Sheet` in `fc-ui.jsx`) whose body is `ResolvePane`. **One component, a `context` prop switches host behavior:** `'import'` (default) and `'create'`.

**Common anatomy (top → bottom):**
- *(import only)* **Original-line card** — gradient `linear-gradient(180deg, var(--accent-soft), var(--card))`, shows the draft line being resolved: name (17px/700) + amount/unit + italic note.
- **Body** — varies by proposal verdict (below).
- **Footer** — "Abbrechen" (ghost) + primary confirm. Label: import → **"Bestätigen & einfügen"**; create → **"Anlegen & weiter"**. Caption under buttons: new-food → "Wird in deiner Lebensmittel-Bibliothek gespeichert · sofort durchsuchbar"; synonym → "Synonym wird gelernt · künftig automatisch erkannt".

**Body by verdict:**
- **new-food** (editable entry): eyebrow "✦ Neuer Eintrag · KI-Vorschlag" (or just "Neuer Eintrag" when `aiAssisted=false`), optional confidence chip ("KI · {pct}%", gated by `showConfidence && aiAssisted`). Fields: **Name** input; **Einheit** segmented `g | ml`; **Nicht zählen** toggle (untracked); **Nährwerte pro 100** 4-up grid (kcal / Eiweiß / KH / Fett) each with a small amber dot = "KI-Schätzung" cue (only when AI-assisted); a live **ResultPreview** card (USER-tagged) showing the computed macros for the original amount; and a manual-fallback link **"Stattdessen aus Katalog zuordnen"**.
- **synonym-of** (maps to existing catalog food): eyebrow "✦ Treffer im Katalog" + confidence chip; a catalog card (check icon + food name + "Katalog" chip + its per-100 macros, **read-only**); explanatory line "„{raw}" wird als **Synonym** für {food} gelernt — künftig automatisch erkannt."; a ResultPreview adopting the catalog macros; and "Anderes Lebensmittel wählen" (manual).
- **skip / no proposal:** "Kein KI-Vorschlag" + copy; footer becomes **FallbackActions** = "Katalog" (manual search) + "Entfernen" (discard).
- **loading:** sparkles eyebrow "KI sucht einen passenden Eintrag…" + shimmer skeletons.
- **error:** "Vorschlag nicht verfügbar" + "Erneut versuchen" + FallbackActions.
- **manual (ManualMatch):** search input (seeded with the raw name) over `CatalogRow` results; picking one resolves the item; "Zurück zum Vorschlag" returns.

### 3. Add-Food Search — Create Trigger (Host B)
**File:** `fc-addfood.jsx` (`SearchTab`, `AddFoodSheet`)
**Reached via:** Tagebuch → meal "Hinzufügen" → **Suche** tab.

**Purpose:** When a user searches for a food to log and nothing in the catalog fits, let them create it via the **same** show-and-confirm sheet.

**Behavior:**
- Search results filter by query. When the query is non-empty and yields **zero** results, show "Kein Treffer für „{query}" im Katalog." (14px, `var(--muted-fg)`).
- A **persistent create trigger** sits below the results whenever the query is non-empty: a full-width dashed button, `var(--accent-soft)` bg, `1px dashed var(--accent)`, radius 12 — a 30px white "+" tile + "„{query}" neu anlegen" (14.5px/650, `var(--primary)`) + sub "Eigenen Eintrag erstellen · sofort nutzbar" + chevron.
- Tapping it opens `ResolvePane` with `context="create"`: blank new-food entry **seeded with the query name**, no AI cues, no original-line card, no amount yet.
- On confirm, the created (or catalog-picked) food is handed to the existing **amount step** (`AmountStep`) so the user logs a quantity — then it's added to the diary. *This is the key difference between hosts: import bakes the amount in (recipe line already has it); create routes through amount selection afterward.*

---

## Interactions & Behavior

- **Prefetch on mount (import):** when the review screen mounts with ≥1 unmatched item, fire **one** background batch propose request for all items; the screen stays fully interactive while in flight. Each row shows its loading affordance until its proposal arrives.
- **Resolve → confirm → move:** confirming calls the confirm endpoint; on success the row **animates out** of the panel (`fc-row-out`, 0.34s) and the returned matched row **animates into** the ingredient list (`fc-row-in`, 0.5s, brief `--accent-soft` highlight). Totals (Pro Portion hero) recompute live.
- **Provenance tags:** resolved rows in the ingredient list carry a small tag — **USER** (new food, `--accent-soft`/`--primary`) or **Katalog** (learned synonym, `--muted`).
- **Manual & discard always available:** every unmatched row keeps a discard (✕); manual catalog match is always reachable inside the sheet (and via FallbackActions on skip/error).
- **Edit before confirm:** all new-food values are editable; edits flow to both the persisted overlay entry and the resolved row.
- **Error is non-blocking:** a `502` propose failure leaves every row rendered with manual + discard intact and shows a per-affordance error state.
- **Reduced motion:** shimmer/spin disabled under `prefers-reduced-motion: reduce`; the prefetch skeleton is skipped.

## State Management
Per `ImportReview`: `rows` (matched + resolved ingredients), `unmatched` (remaining items, each with `{ id, name, amount, unit, note, proposal }`), `openId` (which item's sheet is open), `leaving` (ids animating out), `highlightKey` (row just inserted), `prefetching` (mount batch in flight), `resolvedCount`. Per `AddFoodSheet`: `amountItem`, `recipeItem`, `createItem` (drives the create-context sheet). Confirm resolution shape handed to host: `{ key, name, unit, per100, untracked, source, amount?, note? }`.

## Backend Contract (recreate against these real endpoints)
- `POST /propose-ingredient-resolutions` — body `{ items: [{ name, note?, unit?, amount?, pieceQuantity? }] }`; returns one proposal per item from a **single** Anthropic call. Verdicts: `{ verdict:'synonym-of', foodId, synonym, confidence }`, `{ verdict:'new-food', entry, confidence }`, `{ verdict:'skip', reason }`. Prompt includes each item's name + note + top-K (K=8) fuzzy candidates from FOODS+USER (not the full catalog). Persists nothing. `401` no session; `503 ai-import-not-configured`; `502` on upstream failure (no auto-retry).
- `POST /confirm-ingredient-resolution` — body is the (possibly edited) resolution `{ kind:'new-food', entry }` or `{ kind:'synonym', foodId, synonym }` + original draft fields. Persists to the user-foods overlay and returns a `MatchedDraftIngredient` built with the **same post-match rules as AI import** (catalog unit wins w/ `unitOverridden`, piece preserve/drop by unit, untracked inheritance incl. `displayQuantity`, note verbatim). `409` on folded-name/id collision (persist nothing). Does **not** require a prior propose call.
- Confirmed foods/synonyms are searchable in the same process (overlay `USER` source) — re-import of the same name matches instead of re-listing as unmatched.

See `specs-source/` (proposal.md, design.md, tasks.md, and the per-capability spec deltas under `specs-source/specs/`) for the full behavioral contract and rationale.

## Design Tokens
Authoritative source: **`fc-tokens.css`**. Key values:
- **Primary** `hsl(244 36% 44%)` (indigo header), pressed `hsl(244 36% 36%)`; **Accent** `hsl(249 72% 65%)`, **accent-soft** `hsl(249 72% 65% / 0.12)`.
- **Surfaces:** bg `hsl(300 100% 99%)`, card `hsl(240 100% 98%)`, muted `hsl(240 33% 94%)`, border-soft `hsl(240 14% 88%)`.
- **Text:** fg `hsl(0 0% 20%)`, text-2 `#5c5c5c`, text-3 `#8a8a8a`.
- **Semantic:** success `#10b981`, warning `#f59e0b`, error `#ef4444`.
- **Macros:** Eiweiß `hsl(244 50% 56%)`, KH `hsl(28 80% 52%)`, Fett `hsl(199 70% 48%)`.
- **Radius:** 12 / 9 (sm) / 18 (lg). **Tap target:** 44px min. **Font:** system (`-apple-system, …`). **Shadows:** see `--shadow-card` / `--shadow-pop`.
- **Motion:** `fc-row-in` .5s, `fc-row-out` .34s, `fc-shimmer` 1.1s, `fc-spin` .7s, `fc-pop-in` .22s — all in `fc-tokens.css`.

## Assets
No raster/image assets. Icons are lucide-style line icons (the real app uses `lucide-react`) — see `fc-icons.jsx` for the set used (`sparkles`, `check`, `plus`, `x`, `search`, `reset`, `info`, `chevR`, `chevL`, `book`, `camera`, …). Map to `lucide-react` equivalents in the codebase.

## Files
Runnable prototype (open `forkcast.html`). The resolve feature lives in:
- **`fc-resolve.jsx`** — the reusable show-and-confirm sheet (`ResolvePane`, `ResolveSheet`, `ProposalContent`, `ManualMatch`). **Start here.**
- **`fc-import.jsx`** — import review screen + unmatched panel (Host A).
- **`fc-addfood.jsx`** — add-food sheet + search create trigger (Host B).
- **`fc-recipes.jsx`** — `IngredientRow` (resolved rows render here, with provenance tag).
- Supporting: `fc-ui.jsx` (Sheet, CatalogRow, IconBtn, Stepper, Tabs…), `fc-icons.jsx`, `fc-data.js` (demo data + `IMPORT_DRAFT` + `matchSearch`), `fc-tokens.css` (tokens), `fc-diary.jsx` / `fc-planner.jsx` / `fc-settings.jsx` / `frames/ios-frame.jsx` / `tweaks-panel.jsx` (needed only to run the shell), `forkcast.html` (entry).
- **`specs-source/`** — the original OpenSpec change (proposal, design, tasks, capability spec deltas) — the behavioral source of truth.

### Tweaks (prototype-only)
The prototype exposes design forks via a Tweaks panel under "Foto-Import · Zutaten zuordnen": confirm surface (Sheet/Inline), resolve-affordance style (Knopf/Badge/Vorschau), panel tone (Amber/Neutral), KI-confidence on/off, and a demo proposal-state switch (Bereit/Lädt/Übersprungen/Fehler) to walk every state. These are for exploring the design — ship the chosen defaults (Sheet, Knopf, Amber, confidence on).
