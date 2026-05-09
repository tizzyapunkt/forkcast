## Context

Recipes today carry a flat list of `RecipeIngredient` rows, each with `name`, `unit`, `macrosPerUnit`, `amount`, and an optional `pieceQuantity`. Every row is treated as a tracked nutritional contribution: `LogRecipe` produces one `LogEntry` per ingredient and the daily-log rollup sums them.

Seasonings, herbs, and spices break this assumption. They belong to the recipe (identity, instructions, future grocery list) but contribute essentially nothing to macros — and treating "1 g of salt" or "2 g of basil" as a tracked entry is noise, not signal. The user has confirmed: anything we'd consider untracked has zero macro contribution full stop (not just zero calories — sodium and similar trace nutrients are also untracked at this stage of the product).

The curated FOODS dataset is the right place to seed which ingredients are untracked: salt, pepper, basil, oregano, thyme, paprika, etc. — the user's regular cooking shortlist. The same flag travels through search results into recipe drafts (AI import) and recipe forms (manual authoring).

The grocery list capability does not yet exist. This change is sized to make untracked ingredients first-class on the recipe so the future grocery list can include them without further data-model work, but does not implement any grocery features.

## Goals / Non-Goals

**Goals:**

- A single binary flag, `untracked`, on `RecipeIngredient` and on `FoodEntry` (and carried through `IngredientSearchResult`) that means "do not include in nutrition rollups".
- Untracked ingredients remain part of the recipe (form, read view, persistence) and are preserved through edit/import/save round-trips.
- `LogRecipe` skips untracked ingredients — no `LogEntry` is produced for them.
- Ad-hoc logging of an untracked ingredient is disallowed (the log drawer surfaces them but disables logging with an inline hint).
- The curated FOODS dataset gains the common seasoning/herb/spice set, all marked untracked.
- The recipe form lets the user toggle a row's `untracked` state — both for unmatched custom rows (e.g. "fresh thyme from the garden") and for matched rows the user wants to override.
- AI recipe import inherits `untracked` from FOODS matches automatically; the review UI surfaces and lets the user toggle the flag before save.
- All changes are backwards compatible: persisted recipes and the old `foods.json` load unchanged.

**Non-Goals:**

- Building or designing the grocery list capability.
- Tracking sodium, fiber, sugar, or any nutrient beyond the existing `calories / protein / carbs / fat`.
- Multi-tier "tracked-ness" (e.g. "track macros but not calories"). The flag is binary.
- Auto-classification of arbitrary ingredients as untracked. Only FOODS matches propagate the flag automatically; the user toggles manually otherwise.
- Adding a free-form/unmatched ingredient flow to the manual recipe form. Today the manual form picks exclusively via FOODS/OFF; this change preserves that.
- Filtering untracked items out of FOODS search results entirely. They remain visible (so the user can pick them in recipe authoring) but are gated when used as a log target.
- Migrating existing recipes to mark previously-saved seasoning rows as untracked. Existing recipes keep whatever ingredients they have until the user edits them.

## Decisions

### Decision 1: Flag on `RecipeIngredient`, not a separate aggregate

**Decision:** Add `untracked?: boolean` to `RecipeIngredient` and to `FoodEntry`. Default to `false` (or absent — semantically equivalent). Plumb through `IngredientSearchResult` as `untracked?: boolean`.

**Rationale:** The user confirmed approach #1 over modeling a separate `Seasoning` aggregate. The difference between salt and chicken breast is *nutritional behavior*, not identity — they are both "things you put in a recipe and buy at the store". A separate aggregate would double the surface (two pickers, two grocery flows, recipes holding two heterogeneous lists) for no domain payoff. A flag captures the only behavior that actually differs.

**Alternative considered:** A `nutritionalRelevance: 'tracked' | 'untracked'` string enum. Rejected as over-engineering for a binary distinction. If the product later needs more nuance (e.g. "track sodium but not calories"), we'll evolve the field then; YAGNI for now.

**Alternative considered:** Implicit untracked status when `macrosPerUnit` is all zeros. Rejected because zero macros and "untracked" are different concepts. A user-defined ingredient with unknown macros (zeros) is still tracked — it just contributes zero to totals. We want an explicit flag so the consumer logic ("don't even produce a LogEntry"; "disable the log button") has a clean signal.

### Decision 2: Source of truth for `untracked` is the curated FOODS dataset; recipes inherit on creation

**Decision:** The curated `foods.json` carries `untracked: true` for the seeded seasoning/herb/spice entries. When a recipe ingredient is added from search, the FOODS entry's `untracked` value is copied onto the new `RecipeIngredient`. From that point on, the recipe owns the flag — re-curating the FOODS dataset never mutates existing recipes.

**Rationale:** Recipes are snapshots of the ingredient at the moment of authoring (this is already true for `name`, `unit`, `macrosPerUnit`, `pieceQuantity`). Untracked status follows the same principle: copy on create, never reach back. This keeps the curated dataset's role purely advisory and avoids a hidden coupling where re-curating the dataset silently re-classifies existing recipe rows.

**Alternative considered:** Look up `untracked` live from FOODS at every render or rollup. Rejected — recipes would suddenly change behavior whenever the curated dataset is regenerated, and recipes would gain a hard runtime dependency on the FOODS index being loaded. Snapshot semantics match every other field on `RecipeIngredient`.

### Decision 3: Untracked recipe ingredients produce no `LogEntry`

**Decision:** `LogRecipe` filters out `ingredient.untracked === true` rows before producing log entries. The remaining tracked ingredients are scaled and persisted as today.

**Rationale:** The user defined "untracked" as "don't track at all". Producing zero-macro `LogEntry` rows for them would clutter the daily log with rows that contribute nothing — and would also make them appear in `recently-used-ingredients`, which is the opposite of the user's intent. Skipping at the boundary is the simplest way to keep the daily-log capability and the recents capability unaware of untracked.

**Edge case:** If a recipe consists entirely of untracked ingredients (a hypothetical "salt and pepper rub" with no proteins or oils), `LogRecipe` would produce zero entries. This is correct — there is nothing to track — but it surprises the caller (HTTP response is `[]`). We accept this; the recipe form already validates that a recipe has at least one ingredient, but does not validate at-least-one-tracked. The HTTP response being an empty array, with a `200`, is acceptable signal.

**Alternative considered:** Produce zero-macro LogEntry rows so the daily log still "shows" what was eaten. Rejected — the user's stated goal is to not track these items at all. Persisting noisy rows defeats the point.

### Decision 4: Ad-hoc logging of untracked search results is disabled, not filtered out

**Decision:** Search results from FOODS continue to include untracked entries (so they're discoverable for recipe authoring). In the log drawer's Search tab, untracked rows render with a muted style and the log/select affordance is disabled, with an inline hint ("Seasoning — not tracked").

**Rationale:** Two consumers need different behavior — recipe authoring needs untracked rows visible, log drawer needs them un-loggable. Filtering at the search layer would force a context flag through the API. Rendering at the consumer keeps the search service simple (it returns one truthful result set) and lets each surface decide how to use the flag.

**Alternative considered:** Filter at the search query level via a context parameter (`?context=log` vs `?context=recipe`). Rejected as premature complexity; one client-side rendering branch is enough. If we ever grow more contexts (e.g. shopping-only items), we can reevaluate.

### Decision 5: Seed-key list gains an optional `untracked` marker

**Decision:** `backend/scripts/foods-seed-keys.ts` changes from `string[]` to `Array<string | { key: string; untracked: true }>`. The build script forwards the flag to the AI prompt, instructing it to set `untracked: true` and zero `macrosPer100` for those keys, and validates the output: untracked entries MUST have `macrosPer100` equal to all zeros and `untracked: true`.

**Rationale:** The seed-key list is the human-curated part of the dataset; it is the right place to express "this key is untracked", not the AI's judgment. A union type keeps the common case (a string) terse for the bulk of entries that are tracked.

**Alternative considered:** Two separate files (`foods-seed-keys.ts` and `foods-seed-keys-untracked.ts`). Rejected — having one canonical list keeps the dataset as a whole reviewable in one place, and the union type is small.

**Alternative considered:** Let the AI decide which keys to mark untracked. Rejected — judgment about what counts as "seasoning" should be the user's, not the model's. We want to be able to add or remove untracked items without re-prompting.

### Decision 6: AI recipe import inherits `untracked` from FOODS matches; never auto-flags unmatched rows

**Decision:** When `ai-recipe-import` matches an extracted ingredient against a FOODS entry, the resulting `MatchedDraftIngredient` carries `untracked` from that match. Unmatched rows never get auto-flagged. The review UI shows the flag and lets the user toggle it on any row before saving.

**Rationale:** Inheriting the flag from FOODS matches gives us "for free" classification of common seasonings (salt, pepper, herbs imported from a recipe photo will arrive marked untracked). Auto-classifying unmatched rows would require either heuristics ("does the name look like a seasoning?") or an extra AI call — both add complexity for marginal gain. The user reviews every imported draft anyway, so manual toggle in the review UI is a fine fallback.

### Decision 7: Manual recipe form treats untracked as first-class — toggle on every row

**Decision:** The manual recipe form (`recipe-ingredient-editor`) renders a "Don't track" toggle on **every** ingredient row, regardless of source. Behavior is symmetric with the AI-import review screen:

- Picking a FOODS entry whose `untracked === true` → new row arrives with `untracked: true` (inherited).
- Picking any other FOODS or OFF result → new row arrives with `untracked: false` (default).
- The toggle on every row lets the user override the default in either direction (mark a tracked OFF row as untracked, or clear an inherited untracked flag).

Untracked rows are visually muted (lighter text and/or a small badge) so the user can scan the list and tell at a glance which rows count toward macros. Saving the recipe persists whatever `untracked` state each row was left in.

**Rationale:** The user explicitly called out that the manual recipe flow must work, not just AI import. The manual form today picks rows exclusively through the FOODS/OFF picker (no free-form/unmatched entry — see "Out of scope" below), so making the toggle a first-class element of *every* picked row is the simplest way to give the manual flow the same expressive power as AI import: inherit the common case from FOODS, override per-row when needed.

**Out of scope (intentional):** This change does NOT add a free-form/unmatched ingredient entry path to the manual recipe form. Today, every manual ingredient comes from FOODS or OFF. If the user needs an untracked seasoning that isn't in FOODS yet, the path is to add it to `foods-seed-keys.ts` (with `untracked: true`) and rerun `build:foods`. Adding a "Quick"-style free-form row to the recipe form is a larger product decision and not coupled to this change.

### Decision 8: Read-mode renders untracked rows with the recipe's full ingredient list

**Decision:** In recipe read mode (the cooking view), untracked ingredients are rendered alongside tracked ingredients in the same ordered list, with a visual distinction (muted/badge). They are NOT grouped into a separate "Seasonings" section.

**Rationale:** When cooking, the order in which ingredients appear matches the recipe's instructions. Splitting them into a separate section breaks that flow ("add salt and pepper" should appear at step time, not in a footer). The visual distinction is sufficient to communicate macro relevance without disturbing cooking ergonomics.

## Risks / Trade-offs

- **Risk:** Existing recipes that were saved with seasonings as ad-hoc unmatched rows are not retroactively classified as untracked. → **Mitigation:** When the user edits such a recipe, the row is right there with a "Don't track" toggle. We do not run a one-time migration; the user fixes them as they revisit. The product is single-user and the dataset is small, so this is fine.
- **Risk:** A recipe consisting entirely of untracked ingredients produces zero `LogEntry` rows on log. → **Mitigation:** Acceptable — the user is explicitly logging a recipe with no nutritional content. The HTTP response is `200` with `[]`. We do not add a special validation rule against "all-untracked recipes" since marinades and rubs are legitimate.
- **Risk:** The `untracked` flag and `macrosPer100 === all zeros` could drift apart in the curated dataset (e.g. the AI returns nonzero macros for an untracked entry). → **Mitigation:** Build-script validation: when `untracked: true`, `macrosPer100` MUST be all zeros (else fail the run with a message naming the offending key). The flag is the source of truth for behavior; the zeros are a hygienic invariant.
- **Risk:** If we later want fine-grained tracking (e.g. sodium), the binary flag is too coarse. → **Mitigation:** Acceptable for now. The product tracks `calories / protein / carbs / fat` only. If we ever add more nutrients, we can either (a) widen the flag to a record `{ trackCalories: bool; trackSodium: bool; ... }` or (b) reinterpret untracked as "exclude from all current and future macros". We are not pre-engineering for this.
- **Trade-off:** Filtering on the consumer (log drawer) instead of the search service means duplication if more consumers appear. → Accepted; one extra UI branch in the log drawer is cheaper than threading a context parameter through a domain service.

## Migration Plan

This is a single-user, JSON-file-backed app — no zero-downtime concerns and no schema migration tooling.

1. **Backend:** Add the optional field to types. Old records load with `untracked` absent; the field is treated as `false`. Add `LogRecipe` skip behavior. Validation accepts the new field on add/update endpoints.
2. **Curated dataset:** Update the seed-key list with the seasoning/herb/spice set (each marked untracked). Re-run `pnpm --filter @forkcast/backend build:foods` with `ANTHROPIC_API_KEY` set; commit the regenerated `foods.json`.
3. **Frontend:** Update recipe form, read view, log drawer search, and AI import review to handle the flag. Type-check forces these surfaces to be updated together (they share the `untracked?: boolean` type).
4. **No rollback plan needed**: the field is additive and optional. Reverting the code reverts behavior; existing recipes saved after the change still load (the field is just ignored).

## Open Questions

- **Naming of the toggle in the recipe form**: "Don't track", "Untracked", "Seasoning"? "Don't track" reads cleanest in context but is verbose. Defer to UI implementation.
- **Should untracked entries appear in `recently-used-ingredients`?** Currently no, because they cannot be ad-hoc logged. Confirmed alignment — leave as is.
- **Should the UI offer a single "mark all unmatched as untracked" affordance in the AI review?** Probably not initially — the user reviews each row anyway and toggling is one tap per row. Revisit if review fatigue becomes real.
