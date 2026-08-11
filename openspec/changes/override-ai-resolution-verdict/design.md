## Context

See `proposal.md` — Why. Constraints that shape the approach:

- `ResolvePane` (`frontend/src/features/ai-recipe-import/resolve-pane.tsx`) already renders three mutually exclusive bodies (synonym proposal, new-food editor, manual catalog search) selected from the incoming `ResolutionProposal`. The verdict is derived directly from the proposal on every render, which is exactly why it cannot be overridden today.
- The two endpoints needed already exist: `POST /draft-catalog-entry` (catalog manager's "fill with AI", port `CatalogEntryDrafter`, returns a full `FoodEntry` from a bare name) and `POST /confirm-ingredient-resolution` (`kind: 'new-food' | 'synonym'`).
- `confirmResolution` passes the client's entry straight to `catalog.add`, which validates the id with `validateCatalogEntry` but never checks it against the name — the source of the stale-slug bug.
- A manual pick currently never reaches the backend: `pickManual` builds a `MatchedDraftIngredient` client-side and returns.
- `slugifyName` (`backend/src/domain/food-catalog/slugify-name.ts`) already produces the catalog's id form including German romanisation; `fold` (`ingredient-search/fold.ts`) is the existing case/diacritic-insensitive comparison.

## Goals / Non-Goals

**Goals:**

- Make the verdict a piece of sheet state the user can change, without a second propose round-trip for the whole batch.
- Make a rename in the sheet safe end to end: id, synonyms, and the recipe-specific leftover all land where they belong.
- Keep every write on the existing confirm endpoint, so persistence stays in one use case.

**Non-Goals:**

- No change to the batch propose call, its prompt, or its verdict schema — the model is not asked to produce alternatives.
- No new endpoint, no change to the catalog manager's own create/edit screens.
- No retroactive fix-up of entries already persisted with a mismatched id.

## Decisions

### Verdict override is sheet state, not a re-proposal

`ResolvePane` gets an explicit `mode` state (`'proposal' | 'new-food' | 'manual'`) seeded from the proposal's verdict rather than reading the verdict inline. Override actions set the mode; "back" restores the previous one. The editable new-food `draft` and the pending row `note` already live in component state, so they survive a mode round-trip for free — which is what the "cancelling an override keeps prior edits" scenario requires.

*Alternative considered:* re-calling `propose-ingredient-resolutions` with a "not this verdict" hint. Rejected — it needs a prompt/schema change, costs a second batch call, and the model can still return the rejected verdict.

### The fresh draft on synonym rejection reuses `draft-catalog-entry`

Rejecting a synonym calls the existing `useDraftCatalogEntry` mutation with the raw name. It returns exactly the `FoodEntry` shape the new-food editor already edits, so the editor is reused unchanged and the sheet gets a per-item AI draft without touching the batch endpoint. On error the editor opens seeded with `{ name: <raw>, unit: 'g', macrosPer100: zeros, synonyms: [] }` and the AI-estimate hint suppressed — the failure degrades to manual entry rather than blocking.

*Alternative considered:* seeding from the rejected synonym target's macros (Limette's numbers for Limettensaft). Rejected by the user during proposal review — a juice and its fruit differ enough that pre-filled wrong numbers are worse than a short wait.

### The entry id is derived server-side, in `confirmResolution`

For `kind: 'new-food'`, the use case replaces the incoming id with `slugifyName(entry.name)` before validating and adding; an empty slug returns `422`. The client never has to keep an id in sync with a text field, and any future caller of the endpoint inherits the guarantee. Collision handling is unchanged — `findCatalogCollision` already reports id and folded-name clashes as `409`.

Scope note: the catalog manager's own create path (`catalog.handlers`) keeps accepting an explicit id; renaming there is an existing, separate flow.

*Alternative considered:* re-slugging in the sheet on every keystroke. Rejected — leaves the endpoint trusting client input and duplicates the romanisation rules in the frontend.

### The dropped qualifier is computed by folded token subtraction

A small pure helper in the import feature: tokenize the raw ingredient name and the edited canonical name on whitespace, fold both (`fold`), and return the raw tokens whose folded form is absent from the folded name tokens — joined in raw order with original casing. `dünne Reisnudeln` minus `Reisnudeln` yields `dünne`. It fills the note field only when the row has no note, and only as a pre-fill: the field is editable and clearable, so a bad guess costs one keystroke. Pure and unit-testable, which is where its tests live.

*Alternative considered:* asking the model for a "recipe-specific qualifier" field. Rejected as disproportionate — a second AI call for one adjective.

### The proposed name is retained as a synonym in the draft, visibly

When the user edits the canonical name away from what the proposal contained, the sheet appends the original proposed name to the draft's `synonyms` list, which is now rendered as an editable list in the editor. Nothing happens invisibly, and dropping the alias is one tap. The server deduplicates case-insensitively against the canonical name and the other synonyms, so a no-op rename cannot produce `Reisnudeln` as a synonym of `Reisnudeln`.

### A manual pick becomes a real `synonym` confirm

`pickManual` stops building the row client-side when the learn-synonym toggle is on and the picked result is a catalog entry (`source: 'CATALOG'` — `OFF` and `SCAN` results have no catalog id to attach a synonym to, so the toggle is hidden for them). It then submits `{ kind: 'synonym', foodId: result.id, synonym: <raw name>, original }` and uses the returned row, which also gets the picked entry through the same post-match rules as every other path instead of the hand-rolled row it builds today. Toggle off, or a raw name that folds to the entry's name or an existing synonym, keeps the current client-side behaviour and writes nothing.

This applies to the `create` context (search-panel create-with-AI) as well: the confirmed entry is still handed to the host flow as an `IngredientSearchResult`, so picker consumers are unaffected.

## Risks / Trade-offs

- **Manual picks now write to the catalog** where they previously did not, so a sloppy pick can teach a wrong alias → the toggle is visible and one tap to disable, redundant synonyms are suppressed entirely, and the catalog manager can already edit and remove synonyms after the fact.
- **Server-side id derivation changes behaviour for existing clients** of the confirm endpoint (an explicitly sent id is now ignored) → the only caller is this sheet, and the derived id equals the AI-proposed one whenever the name is untouched, so unrenamed confirms are byte-identical to today.
- **Token subtraction misfires on reworded names** (e.g. `Reisnudeln, dünn` renamed to `Reisnudeln` yields the note `,`) → tokens are stripped of punctuation before comparison, and an empty or punctuation-only result pre-fills nothing.
- **The rejection path costs an extra AI call per rejected synonym** → it is user-initiated and one item wide, and the sheet shows a cancellable loading state.
- **`ResolvePane` grows** (already ~500 lines) → the new-food editor, the synonym proposal, and the manual-match panel move to sibling files in the same feature folder as part of this change, leaving the pane as the state machine.

## Migration Plan

No data migration. Entries already persisted with a name/id mismatch stay as they are — they are valid catalog entries and are renameable in the catalog manager. Deploy is a single frontend + backend release; rollback is a revert (no schema change, and synonyms written in the meantime remain valid).
