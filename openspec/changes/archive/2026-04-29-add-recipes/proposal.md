## Why

Planning meals a week ahead is the headline use-case of forkcast, but today every meal is composed ingredient-by-ingredient. For the dishes the user cooks repeatedly (oats bowl, bolognese, …) that's punishing. A "recipe" abstraction lets the user define a dish once, then drop it into any slot on any day in two taps.

Existing apps usually log a recipe as a single opaque line with summed macros, which makes "I ran out of skyr, I'll use quark instead" awkward — you have to either edit the recipe globally or detach the whole meal. forkcast inverts that: logging a recipe **expands** into individual ingredient log entries, each independently editable, swappable, or removable, with a back-reference to the recipe purely as a visual hint.

Recipes also serve their second purpose — cooking instructions — which the user wants in the same place as the ingredient list, not in another app.

## What Changes

- New bounded context `recipes` (frontend + backend), separate from `meal-log`.
- New `Recipe` aggregate: name, yield (e.g. "serves 4"), ordered list of full ingredients (name + unit + macrosPerUnit + amount), ordered list of cooking-step strings.
- Recipe CRUD: create, list, get, update, delete (commands and queries via CQRS).
- HTTP endpoints, mirroring the existing project convention (POST for commands, REST-y verbs for resource ops): `POST /add-recipe`, `GET /recipes`, `GET /recipes/:id`, `PATCH /recipe/:id`, `DELETE /recipe/:id`, `POST /log-recipe`.
- New frontend `Recipes` screen: list, create, edit, delete recipes. Reuses existing components (drawer chrome, ingredient pickers from the log flow).
- New `Recipes` tab in the existing `LogIngredientDrawer`, ordered Search → Recent → Recipes → Quick. Picking a recipe opens a confirm step where the user chooses the number of portions; on submit, every ingredient becomes its own `LogEntry` for the selected slot.
- **Modify `meal-log`**: `LogEntry` gains an optional `recipeId` field. Entries logged from a recipe carry it; entries logged ad-hoc do not. The frontend resolves the current recipe name live; if the recipe is deleted, the hint disappears (the entry stays).
- New `add-recipe` use case in the log-ingredient drawer: scales each recipe ingredient's `amount` by `portions / yield` and persists one full `LogEntry` per ingredient, all sharing the same `recipeId`.
- New **bottom app-like navigation** with three destinations: Log (current daily-log screen), Recipes (new), Settings. The settings gear is removed from the header in favor of the nav tab.

## Capabilities

### New Capabilities
- `recipes`: define and manage reusable recipes — a yielded list of full ingredients plus ordered cooking steps. Powers the Recipes screen and is the source for batch-logging into the meal log.
- `log-recipe`: from inside the log drawer, pick a recipe, choose portions, and produce one `LogEntry` per recipe ingredient (each tagged with `recipeId`) into the selected date+slot.
- `bottom-navigation`: persistent bottom tab bar across the app providing top-level navigation between Log, Recipes, and Settings.

### Modified Capabilities
- `recently-used-ingredients`: no requirement change. Recipe-sourced log entries are full entries and SHALL appear in the recents list under the existing rules. (Listed for awareness; no delta file required.)

> Note: `meal-log` does not yet have a published spec under `openspec/specs/`. The `recipeId` field addition is documented inside the new `log-recipe` capability spec and the design doc, since there is no existing spec to delta against.

## Impact

- **Backend**
  - New domain folder `backend/src/domain/recipes/` (entity, repository port, use cases: add/list/get/update/delete; CQRS split).
  - New HTTP folder `backend/src/http/recipes/` (5 handlers).
  - New infrastructure adapter `backend/src/infrastructure/recipes/` (JSON-file repository alongside the existing meal-log JSON store; separate file).
  - New use case `LogRecipe` either under `backend/src/domain/meal-log/` (consumes `RecipeRepository`) or in a thin orchestration module — design.md decides. Produces N `LogEntry` rows with shared `recipeId`.
  - **Modify `LogEntry`** type and persisted schema: add optional `recipeId?: string`. Existing JSON files load cleanly (field absent → undefined). No migration script needed.
  - New route registrations in `backend/src/index.ts`.
- **Frontend**
  - New feature folder `frontend/src/features/recipes/` (list screen, recipe form for create/edit, recipe detail/cooking view).
  - New `Recipes` panel inside `frontend/src/features/log-ingredient/` (the new drawer tab) with a portions-confirm step.
  - New domain types under `frontend/src/domain/recipes.ts`.
  - New React Query hooks under `frontend/src/queries/` (use-recipes, use-recipe, use-add-recipe, use-update-recipe, use-delete-recipe, use-log-recipe).
  - New API client functions in `frontend/src/api/`.
  - **Modify `LogIngredientDrawer`** to add the Recipes tab between Recent and Quick.
  - **Modify daily log entry rows** to render a recipe-source visual hint when `recipeId` is present and resolves to an existing recipe.
  - **New bottom navigation component** under `frontend/src/components/app/bottom-nav.tsx`, wired into `app.tsx`. Replaces the header settings gear; the header becomes destination-specific (date nav on Log, simple title on Recipes/Settings).
- **No DB / containerization change.** JSON file storage stays.
- **No breaking API changes.** Existing meal-log endpoints keep their shapes; `recipeId` only appears on responses for entries that have one.
