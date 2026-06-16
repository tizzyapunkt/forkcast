# Resolve Unmatched Ingredients at Runtime

## Why

Unmatched ingredients on the AI-import review screen exist only in client state and are silently dropped on save — their amounts and notes are lost (the server-side unmatched store records names only). The only repair path is laptop-bound: export the unmatched list, run the augment script, rebuild and redeploy. This loses data, costs momentum, and makes imports on the phone feel broken whenever the curated catalog has a gap.

## What Changes

- **New resolve flow on the import review screen**: when a draft arrives with unmatched ingredients, the client fires one background batch request that returns an AI proposal per item — triaged as *synonym-of* an existing catalog food, *new-food* (full entry proposal: name, synonyms, unit g|ml, macros per 100, optional pieces, optional untracked), or *skip*. The AI receives name **and** note (nutritionally load-bearing, e.g. "Tomaten, getrocknet in Öl"). The user confirms each proposal via an editable show-and-confirm step; the resolved ingredient joins the draft with its original amount/unit/note intact.
- **New runtime-writable user-foods overlay store** (`user-foods.json`): confirmed proposals (new foods and learned synonyms) persist here. The curated `foods.json` stays a read-only build artifact.
- **Import matching becomes a strict cascade**: FOODS → user-foods overlay → scanned products (today: FOODS only). OFF stays excluded from import matching (deliberate: rate limits, packaged-product noise). Scanned products gain name-based search (today they are barcode-only).
- **Overlay joins the picker search** so AI-created foods are findable in manual match, recipe edit, and meal logging.
- **Curation loop retargeted**: a settings action atomically exports the overlay content and clears it; the `build:foods` augment pipeline ingests this export instead of the unmatched-ingredients export — new foods are promoted into the curated set (confirmed values as generation hint), learned synonyms merge into existing curated entries.
- **BREAKING — unmatched-ingredient collection removed end to end**: backend domain/infrastructure/HTTP, the recorder side effect in the import use case, the settings export panel, and the data file. The review screen's unmatched panel stays and becomes the centerpiece of the resolve flow.
- **Classifier reuse**: triage/generation prompts and tool schemas move out of `backend/scripts/` into a shared domain port + Anthropic infrastructure adapter used by both the runtime flow and the augment script. Runtime triage receives top-K fuzzy candidates instead of the full catalog.

Explicitly ruled out: pending-ingredient state on recipes, OFF in import matching, merged/weighted cross-source scoring (cascade first, revisit with real usage).

## Capabilities

### New Capabilities

- `user-foods-overlay`: runtime-writable store of user-confirmed food entries and learned synonyms; participates in ingredient search; atomic export-and-clear operation exposed in settings.
- `unmatched-ingredient-resolution`: batch AI proposal generation (triage + food-entry estimation) for unmatched draft ingredients, editable show-and-confirm, persistence of confirmed entries to the overlay, and resolution of the draft line with original quantities.

### Modified Capabilities

- `ai-recipe-import`: ingredient matching changes from FOODS-only to the cascade FOODS → overlay → scanned products; the unmatched-recording side effect is removed.
- `curated-foods-source`: the augment pipeline's input changes from the unmatched-ingredients export to the overlay export, with two promotion paths (new foods, synonym merges).
- `ingredient-search-source-toggle`: picker search results include user-foods overlay entries alongside the curated FOODS source.

### Removed Capabilities

- `unmatched-ingredient-collection`: fully removed — recording, storage, HTTP endpoints, export UI. Superseded by the overlay (richer data: confirmed entries instead of name counts).

## Impact

- **Backend**: new `user-foods` domain + JSON store + HTTP handlers; new food-proposal domain port + Anthropic adapter (prompts extracted from `scripts/build-foods-classifier-tool.ts` and augment helpers); `import-recipe-from-photos.use-case.ts` search cascade + recorder removal; composite ingredient search gains overlay source and scanned-product name search; deletion of `domain|infrastructure|http/unmatched-ingredients`.
- **Frontend**: review screen unmatched panel gains the resolve flow (batch prefetch, per-item confirm sheet — layout to be supplied by a separate design handoff); settings panel swaps unmatched export for overlay export; deletion of `features/unmatched-ingredients` + related api/queries.
- **Scripts**: `build:foods:augment` retargeted to overlay export format; shared classifier module imported from `src`.
- **Data**: new `backend/data/user-foods.json`; `backend/data/unmatched-ingredients.json` retired.
- **API**: new endpoints for batch proposals, proposal confirmation, and overlay export-and-clear (domain-language names per CLAUDE.md); `unmatched-ingredients` endpoints removed.
- **Runtime AI usage**: one batch proposal call per import with unmatched items (in addition to the existing extraction call).
