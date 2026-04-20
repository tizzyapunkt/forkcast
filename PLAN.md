# forkcast — Plan

## IN PROGRESS

_Nothing in progress yet._

---

## TODO

### Frontend epic

**Stack:** Vite + React + TypeScript, Tailwind CSS, shadcn/ui, React Query (server state), local useState/useReducer (UI state), vite-plugin-pwa.
**Colors:** brand palette (primary-100/200/300, accent-100–500) from user's blog.

#### #9 Frontend project setup
Vite + React + TS, Tailwind, shadcn/ui, React Query, vite-plugin-pwa. Configure brand color palette. Wire QueryClient provider and app shell.

#### #10 API client layer
Typed fetch functions for all 8 backend endpoints. React Query hooks call these — no raw fetch in components.

#### #11 Daily log view — main screen
Today's 4 slots with entries and per-slot totals. Day-level calorie + macro totals vs daily goal. `macros_partial` surfaced. Data via React Query.

#### #12 Date navigation
Header prev/next controls. Active date drives the daily log query. Today by default. Local state only.

#### #13 Log ingredient — quick entry flow
Distinct entry point per slot. Bottom sheet: label + calories (required) + optional macros. Submits quick log entry. Invalidates daily log on success.

#### #14 Log ingredient — full entry flow (search)
Distinct entry point per slot. Bottom sheet with search input → results list → confirm screen with amount input. Submits full log entry. Invalidates daily log on success.

#### #15 Edit and remove log entries
Inline actions per entry. Edit opens bottom sheet pre-filled with current values. Remove with confirmation. Both invalidate daily log on success.

#### #16 Settings screen — nutrition goal
Form pre-filled from current goal. Saves via PUT /nutrition-goal. Invalidates nutrition goal query.

#### #17 PWA setup — installable + cached assets
Manifest, precached app shell assets. Installable on mobile and desktop. No background sync.

---

### Backlog

#### #8 Copy day / slot / week _(future)_
Copy a slot or full day's log entries to another date. Useful for meal prep patterns. Not MVP.

---

## DONE

### #7 OpenFoodFacts ingredient search integration
- `domain/ingredient-search/types.ts` — `IngredientSearchResult`
- `domain/ingredient-search/map-off-product.ts` — pure mapper (OFF product → domain type, divides per-100g by 100)
- `domain/ingredient-search/ingredient-search.service.ts` — port
- `infrastructure/ingredient-search/open-food-facts.service.ts` — adapter
- `http/ingredient-search/search-ingredients.handler.ts` — Hono handlers
- `GET /search-ingredients?q=`, `GET /search-ingredients/barcode/:barcode` wired in `index.ts`

### #6 Navigate between dates
Covered by `GET /daily-log/:date` — any date is valid, defaults to today. No separate backend work needed.

### #5 Edit and remove log entries
- `domain/meal-log/edit-log-entry.use-case.ts` — type-safe edit (full: amount, quick: calories/macros); throws on type mismatch or missing entry
- `domain/meal-log/remove-log-entry.use-case.ts` — remove with existence check
- `infrastructure/meal-log/json-log-entry.repository.ts` — `findById`, `update`, `remove` added
- `http/meal-log/edit-remove-log-entry.handler.ts` — Hono handlers
- `PATCH /log-entry/:id`, `DELETE /log-entry/:id` wired in `index.ts`

### #4 Set and update daily nutrition goal
- `domain/nutrition/nutrition-goal.repository.ts` — `NutritionGoalRepository` port
- `domain/nutrition/set-nutrition-goal.use-case.ts` + `get-nutrition-goal.use-case.ts`
- `infrastructure/nutrition/json-nutrition-goal.repository.ts` — JSON file adapter
- `http/nutrition/nutrition-goal.handler.ts` — Hono handlers
- `PUT /nutrition-goal`, `GET /nutrition-goal` wired in `index.ts`

### #3 View daily log with macro totals
- `domain/meal-log/get-daily-log.use-case.ts` — `getDailyLog` query
- `infrastructure/meal-log/json-log-entry.repository.ts` — `findByDate` added
- `http/meal-log/get-daily-log.handler.ts` — Hono handler
- `GET /daily-log/:date` wired in `index.ts`

### #2 Log an ingredient to a meal slot
- `domain/meal-log/log-entry.repository.ts` — `LogEntryRepository` port
- `domain/meal-log/log-ingredient.use-case.ts` — `logIngredient` command handler
- `infrastructure/meal-log/json-log-entry.repository.ts` — JSON file adapter
- `http/meal-log/log-ingredient.handler.ts` — Hono handler
- `POST /log-ingredient` wired in `index.ts`

### #1 Define core domain model
- `domain/meal-log/types.ts` — `MealSlot`, `MeasurementUnit`, `QuickIngredientEntry`, `FullIngredientEntry`, `IngredientEntry`, `LogEntry`, `DayTotals`, `SlotSummary`, `DailyLog`
- `domain/nutrition/types.ts` — `DailyGoal`
