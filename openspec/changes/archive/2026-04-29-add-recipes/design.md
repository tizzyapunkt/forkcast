## Context

forkcast today is a single-context app: `meal-log` (with `ingredient-search` and `nutrition` as supporting contexts on the backend, and `daily-log` / `log-ingredient` / `settings` as features on the frontend). Every meal is composed ingredient by ingredient through `LogIngredientDrawer` and persisted as `LogEntry` rows.

We are introducing **recipes** as a separate bounded context: a recipe is a definition of a dish (yield, ingredients, cooking steps), not a meal-log artifact. Recipes are *consumed* by the meal-log when the user logs one — but they're authored, browsed, and edited in their own world.

The proposal pins down the user-visible decisions; this document records the technical ones.

Constraints inherited from CLAUDE.md and prior changes:
- Pragmatic DDD; hexagonal architecture; CQRS for clarity (not for performance).
- Domain code stays free of framework imports.
- TDD; no infrastructure introduced speculatively.
- JSON-file persistence stays.
- API uses domain language; commands are POSTs; resource fetch/edit follows the existing REST-y pattern (`GET /daily-log/:date`, `PATCH /log-entry/:id`, `DELETE /log-entry/:id`).

## Goals / Non-Goals

**Goals:**
- A `recipes` bounded context with its own entity, repository port, use cases, JSON adapter, and HTTP handlers — fully decoupled from `meal-log` types.
- Logging a recipe expands into N independent `LogEntry` rows. Each carries the source `recipeId` so the UI can render a visual hint without coupling persistence to the recipe entity.
- Recipe edits, ingredient swaps, and recipe deletion never break already-logged entries (entries are self-contained snapshots; `recipeId` is just a pointer).
- Reuse existing components: `vaul` drawer chrome, `RecentPanel`-style list rendering, ingredient picker patterns, and the `FullEntryConfirm` macro/amount UX as inspiration for the recipe ingredient editor.
- A persistent bottom navigation that scales from 3 destinations today to 4–5 later (grocery list, weekly plan) without redesign.

**Non-Goals:**
- Importing recipes from URLs, PDFs, or third parties. Out of scope.
- Photos / images on recipes. Out of scope (could be added later).
- Recipe categories, tags, or favorites. Out of scope.
- Server-side fuzzy search over recipes. The list is small; client-side filter is enough.
- Recipe versioning / history. Editing a recipe edits in place; no audit trail.
- Logging multiple recipes in one drawer session. One recipe per drawer open, then drawer closes (matches current single-ingredient flow).
- Pinning macros at log time so they "freeze" against later recipe edits. Already-logged entries are independent `LogEntry` rows with their own macros snapshotted from the recipe's ingredients at the moment of logging — they don't track recipe edits anyway. We don't need extra freezing logic.

## Decisions

### D1. `recipes` is its own bounded context, not a sub-folder of `meal-log`

**Chosen:** New folders `backend/src/{domain,http,infrastructure}/recipes/` and `frontend/src/features/recipes/` + `frontend/src/domain/recipes.ts`.

**Why:** A recipe is a separate aggregate with a different lifecycle (authored once, used many times) from a `LogEntry` (one-shot, dated). Folding it under `meal-log` would smear two languages — *plan/cook* and *track/eat* — into one module. Separate folders also let me wire the JSON file independently and keep the repos honest about their boundaries.

**Alternative considered:** Put recipes under `meal-log/` to share the JSON adapter scaffolding. Rejected — saves ~30 lines and conflates contexts.

### D2. Cross-context coupling lives in a single use case: `logRecipe`

**Chosen:** A new use case `logRecipe(recipeRepo, logEntryRepo, command)` that lives in **`backend/src/domain/meal-log/`** (it is fundamentally a write into the meal-log) but **takes a `RecipeRepository` port**. It loads the recipe, scales each ingredient's `amount` by `command.portions / recipe.yield`, and produces N `LogEntry` rows sharing the same `recipeId`.

**Why:** This is the only place where the two contexts touch. Putting it in `meal-log` keeps the recipes domain pure (it doesn't know `LogEntry` exists). Inversely, `meal-log` only depends on the *port* `RecipeRepository`, not on recipe internals.

**Alternative considered:** A separate "application service" layer that orchestrates both repos. Rejected as ceremony — single use case is enough at this scale.

**Alternative considered:** Return a `Recipe` from the recipes context and have the meal-log use case consume the entity. We already do — that's exactly the chosen design. Listed for clarity.

### D3. `LogEntry` schema gains optional `recipeId?: string`; no migration

**Chosen:** Add `recipeId?: string` to `LogEntry` in both `backend/src/domain/meal-log/types.ts` and `frontend/src/domain/meal-log.ts`. Persisted JSON loads cleanly because the field is optional — pre-existing entries simply have no `recipeId`.

**Why:** No batch IDs, no joining table, no separate "recipe-log" entity. The recipe is the source of truth for "what dish?"; the entry is the source of truth for "what was eaten." A single back-pointer is the minimum needed to render the visual hint.

**Alternative considered:** A separate `RecipeLog` aggregate that owns the produced entries. Rejected — duplicates state and complicates editing/removing individual entries (the user's hard requirement).

**Alternative considered:** Pin a snapshot of the recipe name onto every entry for stability across recipe deletes. Rejected per the user's explicit choice (live ref) — the hint should disappear cleanly when the recipe is gone.

### D4. Visual hint resolves on the frontend, not the backend

**Chosen:** `GET /daily-log/:date` keeps returning entries with `recipeId` only. The frontend, on rendering the daily log, fetches the recipes list (cached via React Query) and resolves `recipeId → recipeName` locally. If no match, no hint.

**Why:** Avoids a JOIN-shaped read on the backend and keeps the daily-log handler unchanged. The recipes list is small (likely tens) and already needed by the Recipes screen and the drawer's Recipes tab — one cached query covers all three.

**Alternative considered:** Backend resolves and embeds `recipeName` into the response. Rejected — leaks the recipes context into meal-log read paths and creates a stale-name window if a recipe is renamed mid-render.

### D5. Yield + portions, scaled at log time

**Chosen:** `Recipe.yield: number` (positive integer; "serves N"). At log time, command is `{ recipeId, portions: number, date, slot }`. For each recipe ingredient, the persisted `LogEntry.ingredient.amount = recipe.ingredient.amount * (portions / recipe.yield)`. `macrosPerUnit` is copied unchanged.

**Why:** Matches the user's chosen model (yield + portions). Scaling the *amount* (not the *macros*) is correct because macros are per-unit and the unit doesn't change.

**Edge cases:**
- Non-integer portion math (e.g. 1 of 3 servings) produces non-round amounts. We store the float as-is. The UI rounds for display only.
- `portions` defaults to `1` in the confirm UI, with a stepper. We do not bound it; logging "0.5 of 4" or "8 of 4" is allowed.

**Alternative considered:** Yield-less recipes (free multiplier). Rejected per the user's choice.

### D6. Recipe ingredients are full-only

**Chosen:** Recipe ingredients use the existing `FullIngredientEntry` shape verbatim (`{ type: 'full', name, unit, macrosPerUnit, amount }`). Reused both for storage and for the ingredient editor inside the recipe form.

**Why:** Per the user's choice. Cleanest semantics for swapping later. We can reuse `FullEntryConfirm`'s amount input UX for the recipe ingredient editor.

**Implication:** "Salt to taste" is not directly expressible. If it matters later, we can introduce a salt-shaped entry; not now.

### D7. CQRS split for the recipes domain

**Chosen:** Same shape as the existing meal-log domain.
- Commands: `addRecipe`, `updateRecipe`, `deleteRecipe`.
- Queries: `listRecipes`, `getRecipe`.
- Repository port: `RecipeRepository` with `save`, `findAll`, `findById`, `update`, `remove`.
- JSON adapter: `JsonRecipeRepository` writing to `./data/recipes.json` (registered in `bootstrap.ts` like the others).

### D8. HTTP routing follows the project's existing mixed convention

**Chosen routes:**
- `POST /add-recipe` — command, body `{ name, yield, ingredients, steps }`, returns the created `Recipe`.
- `GET /recipes` — query, returns `Recipe[]`.
- `GET /recipes/:id` — query, returns `Recipe` or 404.
- `PATCH /recipe/:id` — partial update, body `Partial<{ name, yield, ingredients, steps }>`.
- `DELETE /recipe/:id` — delete; 204 on success, 404 if missing.
- `POST /log-recipe` — command, body `{ recipeId, portions, date, slot }`, returns `LogEntry[]` (the produced rows).

**Why:** Mirrors the existing pattern in `index.ts`: `POST /log-ingredient` (command), `GET /daily-log/:date` (query), `PATCH /log-entry/:id`, `DELETE /log-entry/:id`. Commands keep their domain verbs; resource ops keep REST-y verbs.

### D9. Frontend module layout

**Chosen:**
- `frontend/src/features/recipes/`
  - `recipes-screen.tsx` (list, search, "new recipe" button)
  - `recipe-form.tsx` (create + edit, reuses ingredient picker patterns from `log-ingredient`)
  - `recipe-detail.tsx` (read view: ingredients + steps, used as the "cooking instructions" view)
  - `recipe-ingredient-editor.tsx` (an inline editor for one full ingredient — reuses `useSearchIngredients` and `inline-amount-input`)
  - colocated tests
- `frontend/src/features/log-ingredient/recipe-panel.tsx` — the new drawer tab content (recipe list + filter)
- `frontend/src/features/log-ingredient/recipe-confirm.tsx` — the "choose portions" confirm step (analog to `FullEntryConfirm`)
- `frontend/src/domain/recipes.ts` — types only
- `frontend/src/queries/use-recipes.ts`, `use-recipe.ts`, `use-add-recipe.ts`, `use-update-recipe.ts`, `use-delete-recipe.ts`, `use-log-recipe.ts`

The drawer's confirm-step union becomes `'search' | 'confirm' | 'recipe-confirm'`; the existing `'search' | 'confirm'` pair is preserved untouched.

### D10. Bottom navigation as a presentational component, view state in `App`

**Chosen:** Replace the current `view: 'log' | 'settings'` state in `app.tsx` with `view: 'log' | 'recipes' | 'settings'`. Render `<BottomNav active={view} onChange={setView} />` at the bottom of the layout. The header gear is removed; settings is reachable only via the bottom tab.

**Why:** Tiny state surface, no router needed yet. Keeps the bottom nav decoupled from any future router.

**Layout impact:** `main` gets `pb-16` (or matching) so content isn't covered by the nav. The drawer sits above the nav (z-index already on the drawer; bottom nav is below it).

**Alternative considered:** Adopt `react-router` now. Rejected — speculative; adds a dep for three routes.

### D11. Deleting a recipe is allowed even if logged entries reference it

**Chosen:** No referential integrity enforcement. `DELETE /recipe/:id` just removes the recipe; logged `LogEntry`s with that `recipeId` keep the orphaned id, and the frontend hint silently disappears (D4).

**Why:** Matches the live-ref decision. Otherwise we'd need to either cascade-clear `recipeId` on log entries (mass write) or refuse deletion (annoys the user).

### D12. Test strategy

**Chosen:**
- Backend: integration-style tests for each use case (in-memory repo) and HTTP handler tests using the existing pattern. New `logRecipe` use case tested against a hand-rolled in-memory `RecipeRepository` + `LogEntryRepository`.
- Frontend: RTL + MSW for the recipe screens; reuse the existing test helpers under `frontend/src/test/`.
- Follow the project's TDD rule: failing test first.

## Risks / Trade-offs

- **Recipe-name drift in the daily log feels lossy when a recipe is deleted.** → Mitigation: per the user's preference, the hint silently disappears; the entry remains intact. Document in the spec so it's not perceived as a bug.
- **Macros at log time can drift after a recipe ingredient is edited.** → By design: edits to a recipe don't retro-apply to past logs. The entry is a snapshot; this is the standard nutrition-tracking convention and matches the user's "swap on the fly" use case (the entry must be independently editable).
- **Float amounts from non-integer portions look ugly** (e.g. logging 1 of 3 servings of 200g rice → 66.666g). → Mitigation: round in display only (1 decimal); persist the exact float for accurate macro arithmetic.
- **JSON file growth as recipes accumulate.** → At expected scale (hundreds at most), unmeasurable. Will revisit if we ever introduce a DB.
- **Bottom nav crowding when more destinations land later.** → Three tabs now leaves room for two more (e.g. weekly plan, grocery list) without redesign. If we exceed five, switch to a "more" overflow.
- **No referential integrity (D11) means orphaned `recipeId`s exist forever.** → Acceptable. We can add a one-shot cleanup pass later if it ever matters; today it's invisible to the user.

## Migration Plan

- No data migration. New fields are optional (`LogEntry.recipeId`); new file `./data/recipes.json` is created on first write by `bootstrap.ts`.
- Rollback: revert the change. Existing `LogEntry`s without `recipeId` are unaffected. Any `LogEntry`s written *after* this change with a `recipeId` would lose only the visual hint on rollback — they remain valid entries.

## Open Questions

- Should the Recipes tab in the drawer be hidden entirely when the user has zero recipes, or shown with an empty state that links to the Recipes screen? **Tentative:** show with empty state ("No recipes yet — create one"), one tap to navigate.
- On recipe edit, should we update the `updatedAt` timestamp? **Tentative:** yes, store `createdAt` and `updatedAt`. Cheap and useful for sorting later.
- Sort order for the recipes list? **Tentative:** alphabetical by name; revisit when there are enough recipes that "recently used" or "most-logged" would beat A-Z.
