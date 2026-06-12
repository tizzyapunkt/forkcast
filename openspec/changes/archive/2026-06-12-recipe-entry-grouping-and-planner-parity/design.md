# Design: recipe-entry-grouping-and-planner-parity

## Context

Handoff 2's design code (not its README — see the diff against handoff 1) introduces a shared
`EntryList` that groups recipe-sourced entries under a banner card and is used identically by the
diary and the planner; the reference tags expanded entries with `recipeRef: { id, name, portions }`.
The current app: logs recipes as flat entries tagged `recipeId` (per the `log-recipe` spec, which
also mandates skipping untracked ingredients and resolving the recipe name **live** for the per-row
hint), renders the planner's slots as name-only rows, and the portion step announces untracked
ingredients it never logs.

Decisions already made with the user (2026-06-11): untracked ingredients stay skipped; planner
slots must look/behave like the diary; this is its own change, separate from the header/format
change.

## Goals / Non-Goals

**Goals:**

- Grouped recipe display (banner + portions + group remove) in diary and planner from one shared
  component.
- Planner slot parity: full entry rows with inline amount editing.
- Truthful portion-step preview (tracked ingredients only, scaled amounts).
- Atomic batch removal.

**Non-Goals:**

- No change to `LogRecipe`'s skip-untracked semantics, scaling math, or atomic insert.
- No separate plan entity — the planner stays a weekly view over the same `LogEntry` data.
- Copy-day, day rollup tones, and planner header placement (other change / backlog).
- Visual polish (group card styling details beyond structure) — `ui-polish-backlog.md`.

## Decisions

1. **Batch metadata as flat optional fields (`recipeBatchId`, `recipePortions`) instead of the
   reference's `recipeRef { id, name, portions }` snapshot.** The existing spec already resolves
   the recipe name live via `recipeId` (rename reflects immediately; deleted recipe degrades
   gracefully) — snapshotting the name would contradict that and duplicate state. Portions cannot
   be derived from entries, so they are persisted. A batch id (rather than grouping by `recipeId`)
   keeps two logs of the same recipe in one slot as two distinct groups with their own portion
   labels and removal scopes.

2. **Group identity = `recipeBatchId`; banner name = live lookup by `recipeId`; deleted recipe →
   generic fallback label, group intact.** Grouping is structural (data), the name is cosmetic.
   Falling back to ungrouped rows on recipe deletion would silently remove the group-remove
   affordance.

3. **Atomic `RemoveRecipeLog` command + endpoint instead of a frontend delete-per-entry loop.**
   A 10+-ingredient batch via sequential DELETEs is slow on mobile and can fail half-way, leaving a
   partial group. `LogRecipe` already sets the atomic-write precedent on insert; removal mirrors
   it. Endpoint name follows the domain-language API convention (e.g. `POST /remove-recipe-log`),
   final naming at implementation time.

4. **One shared entry-list component** (e.g. `features/meal-log/entry-list.tsx`) that partitions a
   slot's entries into batch groups + flat rows and renders existing `EntryRow`s inside. The diary
   slot card and the planner slot body both mount it. The planner passes the same mutation hooks
   (amount PATCH, entry delete, batch remove) the diary uses — no planner-specific write path,
   keeping the weekly-meal-plan invariant.

5. **`recipePortions` is a record of what was logged**, not a live rollup — editing member amounts
   does not recompute it. Cheap, honest, and matches the reference's behavior.

6. **Legacy entries** (recipeId without batch metadata, from before this change) keep the current
   per-row hint and stay ungrouped. No data migration; the fields are optional.

## Risks / Trade-offs

- [Group banner shows "2 Port." even after the user halves every member amount] → accepted
  (decision 5); the rows themselves always show true amounts/kcal.
- [Two write paths for removal (single entry vs batch)] → batch removal reuses the repository's
  existing delete primitives inside one transaction-equivalent JSON write; covered by
  command-level tests.
- [Planner gains mutation traffic (inline PATCH) it never had] → reuse the diary's existing
  debounced mutation hook + React Query invalidation of the week-log query; test the
  planner-specific invalidation path.
- [Same recipe logged twice pre-change groups oddly] → it doesn't: pre-change entries have no
  batch id and render legacy-style; only new logs group.

## Migration Plan

Backend and frontend ship together (monorepo, single deploy). `LogEntry` fields are optional —
existing JSON store loads unchanged; no migration script. Rollback = revert the commit; entries
written with batch metadata still load on the old code (unknown optional fields tolerated by the
existing schema-permissive store — verify in a test before shipping).

## Open Questions

- Exact German copy for the portion-step preview ("Die {n} gezählten Zutaten werden einzeln
  übernommen — jede lässt sich danach anpassen.") and the generic fallback banner label
  ("Rezept") — confirm wording with the user during review.
