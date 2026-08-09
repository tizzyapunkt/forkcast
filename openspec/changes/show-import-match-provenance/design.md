## Context

See proposal.md — Why. The constraints that shape the approach:

- The data already exists and is already correct. `importRecipeFromPhotos` builds `debug.ingredients` as `matched.map(m => m.debug!)` — a **parallel array** to the draft's ingredients, covering matched and unmatched rows alike. Nothing needs recomputing; this change is mostly plumbing and rendering.
- The review screen splits the draft: `buildInitialMatchedIngredients` keeps only matched rows in `ingredients`, while unmatched rows live in a separate panel and can be appended later via the resolve flow. So the form's row index is **not** the draft index, and the correlation must be established once, at draft load, rather than assumed.
- `RecipeIngredientEditor` is shared between the import review screen and the ordinary recipe editor. Provenance must be optional there, not assumed.
- `RecipeIngredientPicker` in `replace` mode already skips the amount step and hands the raw `IngredientSearchResult` to the host, which merges it with the row's existing amount. Candidates can reuse that exact path.
- Depends on `unify-editable-food-catalog` — candidate `source` values are `CATALOG`/`SCAN` once the cascade shortens.

## Goals / Non-Goals

**Goals:**

- Make a wrong match visible on the row itself, so the frequent error class needs no photo trip at all.
- Turn "swap this ingredient" from *type a query the server already answered* into *tap the answer*.
- Keep the shared recipe editor unchanged for non-import use.

**Non-Goals:**

- Changing what the extractor returns, including asking for a verbatim source line (that is the review-layout change; this one renders what already comes back).
- Photo layout, pinning, or the desktop two-pane review.
- Confidence scoring or re-ranking. The uncertainty marker is derived from flags and candidate count only — no new model call, no new heuristic.
- Re-running matching client-side when the user edits a row.

## Decisions

### Rename `debug` to `provenance` rather than keeping the field name

The payload changes category: gated developer output becomes always-on user-facing data. Keeping `debug` would leave the codebase describing a German-language UI affordance as a debug aid, and would keep inviting the assumption it can be switched off. *Alternative considered:* keep the name and just stop gating it — rejected on ubiquitous-language grounds; the rename is a mechanical find-and-replace over a request-scoped type with no persistence and no external consumers.

Deleting `RECIPE_IMPORT_DEBUG` outright, rather than keeping it as a verbosity switch, is deliberate: with the payload always present there is nothing left for it to gate, and a vestigial env var is a trap.

### Carry provenance on the row, resolved once at draft load

`ReviewImportScreen` builds its matched-row list from the draft; it attaches each row's provenance entry at that moment, keyed by draft index, and carries it alongside the row in review-screen state. Rows appended later (resolve flow, manual picker) carry none.

*Alternative considered:* pass the provenance array down and have the editor correlate by name — rejected, names are not unique (two `Tomate` rows are legal) and a replacement changes the row's name, which would silently re-point or drop the provenance. Resolving once at load is the only place where the correspondence is unambiguous.

This makes provenance an optional per-row companion in the editor's props rather than a second array the editor must index into — which also keeps the ordinary recipe editor's call site unchanged.

### Candidates render inside the existing picker, not a new sheet

The replace flow already opens `RecipeIngredientPicker` in `replace` mode. Candidates become a section above the search input in that mode, selecting one calls the same `onPickResult` path a search result does. No new component, no new state machine, and the existing replace semantics (keep the row's amount, carry `pieceQuantity` when the new unit is mass, drop the note) apply unchanged.

*Alternative considered:* chips directly on the row, no sheet — rejected for now: rows are already dense with the mode segments, amount inputs, macros line, and now a raw line, and candidate names are long enough to wrap badly at row width. The sheet is one extra tap but stays legible.

Candidates are `SearchCandidateProvenance` records (`name`, `source`, `unit`, `untracked`), not full `IngredientSearchResult`s — they carry no macros. Selecting one must therefore resolve it to a real search result before applying. It is resolved by an exact-name lookup against the candidate's source at selection time, and a candidate that no longer resolves (the entry was deleted from the catalog between import and selection) falls back to the search input with a brief notice rather than applying a macro-less row.

### The uncertainty marker is derived, not stored

Marker visibility is computed from the row's provenance at render time: any flag true, or `chosen` non-null with `candidates.length > 1`. No new field, no server change. The `candidates.length > 1` clause is what surfaces the fuzzy-match error class the user actually hits — a confident single-candidate match stays unmarked, so the marker keeps meaning.

*Alternative considered:* mark only on flags — rejected, the common failure (wrong food picked from several plausible ones) sets no flag at all.

## Risks / Trade-offs

- **Every imported row grows taller** (raw line, sometimes a marker) on a screen that is already a long scroll → mitigated by rendering the raw line as small subordinate text on one truncated line, and by the marker being inline text rather than a block. Net effect should still be fewer scroll trips, because the photo round-trip is what dominates today.
- **The marker fires on most rows and becomes noise** → the `candidates.length > 1` threshold is the tuning knob; if a first pass marks nearly everything, raise it (e.g. only when the runner-up scored close) rather than dropping the marker. Worth checking against a real import before finalising the copy.
- **A candidate no longer resolves at selection time** → handled explicitly above; falls back to search rather than producing a row with no macros.
- **Renaming `debug` → `provenance` touches the import use case, handler, config, both domain type files, and the review screen** → wide but mechanical, and type-checked end to end.
- **Provenance is always on the wire now**, adding ~5 candidates per ingredient to every import response → negligible next to the base64 images in the request, and the response is request-scoped.

## Migration Plan

No data migration. Deploy is a straight replacement: the field name changes on a response that is never persisted and has no external consumer. Rollback is a redeploy of the previous image.

Sequence after `unify-editable-food-catalog`, so candidate `source` values are already narrowed; applying it before would require touching the same literals twice.
