# Design

## Context

- A recipe batch is the set of `LogEntry` rows sharing `recipeBatchId` on one date. Grouping happens at
  render time in `EntryList` (`frontend/src/features/daily-log/entry-list.tsx`), used by diary and planner.
- The planner reads `GET /week-log/{startDate}`; recipes come from `GET /recipes/:id` (already cached by
  React Query). Together they hold everything the cooking view needs.
- `cookedPortions` lives on every batch entry and is read only by `buildGroceryList`
  (`backend/src/domain/shopping/build-grocery-list.use-case.ts`) and the banner's `cooked-portions-sheet.tsx`.
- `LogEntryRepository` (JSON file) has atomic `saveMany` / `removeMany` but no atomic multi-entry update.
- The app has no router: `App` switches screens with `useState` and hides the bottom nav for sub-screens.
- `LogIngredientDrawer` already has a batch `target` mode (replace / add) with an amount step that
  prefills the old amount when the unit matches.
- `scaleIngredient`, `formatMassAmount`, `formatPieceCount` (`features/recipes/scale-ingredient.ts`) and
  the per-portion hero / servings stepper in `recipe-detail.tsx` already scale and present recipe rows.

## Goals / Non-Goals

**Goals:**
- No new persisted shape. The session is client state; the server sees only writes to batches.
- One backend write command that covers change, swap, add, leave out **and** undo.
- Grocery math stays tested in one place (backend).

**Non-Goals:**
- A cooking-session read model on the backend.
- Offline queuing of cooking writes beyond what React Query already does.
- Scaling numbers inside recipe step text.

## Decisions

### The session is computed in the frontend from week-log + recipe

A pure module (`frontend/src/domain/cooking-session.ts`) takes the week's batches of one recipe, the
selection, the extra portions and the recipe, and returns the pot: rows (identity, pot amount, recipe
order, conversion rate, note, "in n of m"), untracked rows, macros per portion. A second pure function
turns an edit into the `SetBatchIngredients` payload (per batch: per-portion amount × `recipePortions`).
Both are unit-tested; the screen only renders them.

*Alternative:* `GET /cooking-session/...` cross-context query on the backend. Rejected for now: the data
is already in the client cache, the pot reacts to selection and extra portions on every tap (no
round-trip wanted), and nothing else consumes it.

### One generic write: `SetBatchIngredients` with explicit per-batch amounts

`POST /set-batch-ingredients` body: `{ changes: [{ recipeBatchId, date, remove: Identity[], set:
FullIngredientEntry[] }] }`. Per batch: drop every entry whose identity is in `remove ∪ identities(set)`,
then write one entry per `set` item, taking `slot`, `recipeId`, `recipePortions` from the batch (as
`addToRecipeBatch` does — the client never sets batch metadata). An entry whose identity survives keeps
its `id` (stable React keys and inline inputs in the planner); a new identity gets a fresh `id` and
`loggedAt`, so it surfaces in "Zuletzt" like `replaceBatchIngredient` does.

The client sends **absolute per-batch amounts**, so:
- the command is idempotent (a retry after a timeout is harmless),
- undo is the same command with the snapshot amounts — including uneven originals that a
  per-portion command could not express,
- swap-into-existing merges in the UI (prefill = sum of both pot amounts), and the command stays pure
  "set".

Validation: each `(date, recipeBatchId)` must exist (`404`), ingredients must pass
`assertFullIngredient`, no duplicate identity in one `set`, no batch may end up empty (`400`). Any
failure rejects the whole request.

*Alternatives:* five commands (change, swap, add, remove, restore) — more endpoints, same write. A
per-portion command (`{ batches, identity, perPortion }`) — cannot restore uneven batches on undo.

### Atomic write: `replaceMany` on the repository

`LogEntryRepository.replaceMany(removeIds: string[], save: LogEntry[])` reads the file once, applies
both, writes once. The fake implements the same. The use case loads affected days with `findByDate`
per distinct date (batch ids can recur across dates, so lookup stays `(date, recipeBatchId)`).

### Grocery list: portions per recipe, grouped by `recipeId`

`buildGroceryList(startDate, portions?: Record<recipeId, number>)`. Batches are grouped by
`(date, recipeBatchId)` as before, then per `recipeId`: `logged = Σ recipePortions`, `P = portions[id] ??
logged`, batch entries contribute `amount × P / logged`, untracked recipe rows contribute
`amount × P / yield` once per recipe. Deleted recipe: entries unchanged, not listed. The response
gains `recipes: [{ recipeId, name, loggedPortions, portions }]` so the sheet can render its inputs
without a second query. HTTP parses `portions=<id>:<n>,…`; any non-positive or non-numeric value is
`400`. The Bring! token payload gains `portions` (same validation), passed straight into
`buildGroceryList`.

### Removing `cookedPortions`

Field, `setCookedPortions` use case + test, route, API client, `cooked-portions-sheet.tsx`, banner
rendering ("für 2 gekocht"), i18n keys and `addToRecipeBatch`'s copy of the field go. Stored values stay
in `log.json` and are ignored: the field is dropped from the type, and `copyLogDay`'s spread would carry
it along harmlessly. No data migration.

### Navigation and URL state without a router

`App` gets a `cooking` state `{ recipeId, weekStart, batches: {date, recipeBatchId}[], extra } | null`.
When set, the cooking screen renders instead of the current view and the bottom nav is hidden. The
state is mirrored with `history.replaceState` into
`?cook=<recipeId>&week=<date>&b=<date>~<batchId>,…&extra=<n>` and parsed once on startup; leaving clears
the query string. The planner's active week must be restorable on back: `PlannerScreen` takes an
optional initial week (from `cooking.weekStart`). Unknown or stale batch refs in the URL are dropped;
if none remain, the default selection rule applies.

*Alternative:* adding a router. Rejected: one screen does not justify it.

### Commit on confirm, not debounce

The planner's inline amount input debounces. Here one edit writes several batches, so the pot amount
commits on Enter/blur (or the sheet's confirm for swap/add). Pot amounts display rounded
(`formatMassAmount`, `formatPieceCount`); writes use the unrounded per-portion value.

### Undo snapshot per row

On a row's first change, the screen records, for each batch in the change, the entries of every
identity the change touches (old and new identity for a swap). Undo sends `SetBatchIngredients` that
sets those identities back (or removes those that were absent) for exactly those batches, independent
of the current selection. The snapshot lives in component state; it is cleared on leave or reload.

### Wake lock hook

`hooks/use-screen-wake-lock.ts`: `navigator.wakeLock?.request('screen')` while active, re-request on
`visibilitychange` → visible, release on unmount. Returns whether a lock is held, which drives the
header indicator. No polyfill.

### Recipe matching and units

Rows match recipe ingredients by the meal log's identity rule (lower-cased name + unit; frontend copy of
`ingredientIdentityKey`). Conversion rate: `displayQuantity` with an amount → `recipe.amount /
displayQuantity.amount` per label unit; `pieceQuantity` → `gramsPerPiece`. A qualitative
`displayQuantity` shows its label only.

## Design handoff

`design_handoff_cook-planned-recipe/` (repo root, not committed) holds the handoff spec (`README.md`) and
the prototype source (`prototype/`) of the canvas https://claude.ai/artifact/DH3ophtxnCLM8bs2tKvGeJ.
Implement the screens against it with tokens and primitives. It also proposes two system changes, a
44 px `Button` size and a `Stepper` primitive, which trigger the design workflow's document and
design-sync steps (tasks 8.3).

## UX Design Hints (for the Claude Design handoff)

Grounded in `frontend/PRODUCT.md` and `frontend/DESIGN.md` ("The Training Kitchen"). These are hints for
the screens designed in Claude Design next, not final layouts. Implementation follows the handoff,
built from tokens and `components/ui/` primitives.

**Scene.** Phone propped up on the counter, arm's length away, wet or floury hands, glances between
chopping. The pot amount and the ingredient name are what the eye must find in under a second. Planning
happens elsewhere; this screen is for doing.

**Screens and states to design**

1. **Planner batch banner** — a new "Kochen" action next to the existing replace/add/remove actions
   (lucide `CookingPot`, `quiet` or `ghost`). The banner loses its "für 2 gekocht" text and control.
2. **Cooking view** (full-screen sub-screen, bottom nav hidden, `AppHeader` with back + recipe name):
   - **Header indicator**: small "Bildschirm bleibt an" icon (on-dark) when the wake lock is held.
   - **Portions block**, compact once set: one line like "4 Portionen · 2 geplant + 2 mit" that expands
     to batch chips (`Mo Abend · 1`, toggleable, last one locked) and an extra-portions stepper (same
     pattern as the recipe detail's servings stepper).
   - **Per-portion macros**: reuse the recipe detail's per-portion hero / totals strip with the fixed
     macro identity colours (Macro Identity Rule). It updates after every edit.
   - **Ingredient rows** (recipe order): name, **pot amount** as the most prominent figure (tabular),
     converted recipe unit beside it ("60 g · 4 EL"), note as caption, "in 1 von 2 Mahlzeiten" caption
     when partial. Tap the amount to edit in place (`DecimalInput`); an overflow or swipe-free row
     action for **Tauschen** and **Weglassen**. A changed row shows "vorher 200 ml" and its own
     **Rückgängig** (`quiet`).
   - **Added rows** after the recipe rows, with a small "hinzugefügt" chip.
   - **"Zutat hinzufügen"** at the end of the list (`accent`, not primary).
   - **Untracked section** under the same heading the grocery list uses ("Gewürze & Kleinkram"),
     read-only, visibly quieter.
   - **Steps**: numbered, as written.
   - **States**: loading skeleton; recipe deleted (no steps, short hint); row write pending (inline
     spinner on that row only); write failed (error banner, row shows its previous amount); wake lock
     unsupported (no indicator, nothing else changes).
3. **Swap / add sheet** — the existing add-food sheet in a new target mode; the amount step is labelled
   for the **whole pot** ("für 4 Portionen"), prefilled per the swap rule, with the per-portion amount
   as a caption.
4. **Einkaufsliste sheet** — a "Rezepte der Woche" block above the items: one compact row per recipe
   (name · "2 geplant" · stepper). A changed value reads as changed (weight, not colour). The list below
   reloads without losing ticks.

**Constraints to carry into the design**

- Touch targets: controls in the cooking view should use the **44 px** tier (full-screen context, wet
  hands), not the 36 px dense floor.
- Type: no display size exists (18 px ceiling, No-Display-Type Rule). Get kitchen-distance legibility
  from weight, tabular numerals and spacing, and 16 px body in rows and steps, not from bigger type. If
  the design genuinely needs a larger pot figure, flag it as a system change (step 3 of the design
  workflow), don't inline it.
- One Indigo Rule: the cooking view probably has **no** indigo fill at all; it is not a form with a
  single commit.
- Motion stays informational: no entrance animation on row changes; a changed row may get a static
  marker, not a flash.
- Both locales: "Rückgängig", "Mahlzeiten", "Bildschirm bleibt an" are long in German; rows must hold
  them at 360 px without horizontal scroll.

## Risks / Trade-offs

- [Pot math lives in the frontend, outside the hexagonal backend core] → It is presentation math over
  already-loaded data; the server still owns validation and atomicity. Kept in a pure, tested module so
  it can move behind a query later.
- [Undo snapshot can overwrite a planner edit made in between] → Accepted; the flow is unlikely
  (decided in exploration).
- [Wake lock unreliable in some iOS standalone versions] → Verify on the owner's device during the
  apply phase; the view works without it.
- [URL grows with many batch refs] → At most 7 days × 4 slots per recipe; well within URL limits.
- [Normalising batches on edit erases intentional per-day differences] → Accepted; per-day side-dish
  changes are made in the planner afterwards.
- [Grocery numbers reset every time the sheet opens] → Accepted; the flow ends in Bring!.

## Migration Plan

Deploy backend and frontend together (same `main` push). Old clients calling
`/set-cooked-portions` get `404`; old `cookedPortions` values in `log.json` are ignored. Rollback is a
revert; values written before the change are still in the file and become effective again.

## Open Questions

- Does Screen Wake Lock hold in the installed PWA on the owner's iPhone? Test on device; no design
  change either way.
