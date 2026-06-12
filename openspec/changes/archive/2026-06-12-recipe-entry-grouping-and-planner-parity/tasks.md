# Tasks: recipe-entry-grouping-and-planner-parity

## 1. Backend — batch metadata on LogEntry

- [x] 1.1 Write failing domain/persistence tests: `LogEntry` accepts optional `recipeBatchId` /
      `recipePortions`, roundtrips them, and loads legacy records without them
- [x] 1.2 Extend the `LogEntry` shape + validation; verify old-code tolerance of the new optional
      fields (rollback safety)
- [x] 1.3 Write failing `LogRecipe` tests: all entries of one invocation share a fresh
      `recipeBatchId`, carry `recipePortions = portions`; two invocations → distinct batch ids;
      ad-hoc logging unaffected
- [x] 1.4 Implement the stamping in `LogRecipe`

## 2. Backend — atomic batch removal

- [x] 2.1 Write failing `RemoveRecipeLog` command tests: deletes every entry of the batch
      atomically, leaves others untouched, not-found on unknown batch id
- [x] 2.2 Implement the command against the JSON-store repository
- [x] 2.3 Write failing HTTP tests for the endpoint (domain-language route, success, 404,
      validation); implement the route

## 3. Frontend — shared grouped entry list

- [x] 3.1 Write failing tests for the shared entry-list component: partitions entries by
      `recipeBatchId`, batch renders one group card (banner: glyph + live recipe name +
      "{recipePortions} Port." + group-remove), member rows stay editable/removable without a
      per-row hint; legacy recipeId-only entries render ungrouped with the per-row hint; deleted
      recipe → generic fallback label, group intact
- [x] 3.2 Implement the component (extract from the diary's current slot rendering); wire the
      batch-remove mutation with React Query invalidation of daily-log + week-log queries
- [x] 3.3 Mount it in the diary slot card (replacing the flat list + "AUS …" caption for batch
      entries); update existing daily-log tests

## 4. Frontend — portion-step preview

- [x] 4.1 Write failing tests: preview lists tracked ingredients only with `portions/yield`-scaled
      amounts, rescales when portions change, states the tracked count, button reads
      "Zutaten übernehmen"
- [x] 4.2 Implement the preview + copy in the RecipePortionStep

## 5. Frontend — planner parity

- [x] 5.1 Write failing planner tests: expanded day slots render entries with the daily-log
      presentation (amount, kcal, macro suffix) and grouped batches via the shared component
- [x] 5.2 Rewire the planner slot body to the shared entry list
- [x] 5.3 Write failing tests for inline amount editing in the planner (immediate recompute,
      debounced PATCH, day/week rollups update) and batch removal from a planner day
- [x] 5.4 Implement by passing the diary's mutation hooks through to the planner; invalidate the
      week-log query on success

## 6. Verification

- [x] 6.1 Full test suite, lint, typecheck, build green in both workspaces
- [x] 6.2 Chrome smoke test: log a recipe (preview correctness incl. an untracked ingredient),
      grouped card in diary, same look in planner, inline edit + group remove in both views,
      legacy entries still render
- [x] 6.3 `openspec validate recipe-entry-grouping-and-planner-parity --strict` passes
