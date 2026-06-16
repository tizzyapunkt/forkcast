# Design — resolve-unmatched-ingredients

## Context

Unmatched ingredients from AI recipe import live only in the review screen's React state and are dropped on save. The server-side unmatched-ingredient store captures names/counts only (no amounts, no recipe link), and turning a miss into a catalog entry requires the laptop: export → `build:foods:augment` → rebuild → redeploy. Meanwhile the saved recipe is silently incomplete.

Relevant existing machinery:

- `RecipeIngredient` embeds `macrosPerUnit` as a value snapshot — recipes never reference food IDs, so fixing a recipe line and enriching the catalog are independent acts.
- The backend already calls Anthropic at runtime (photo extractor); the augment script's triage prompt/tool (`scripts/build-foods-classifier-tool.ts`) and entry-generation tooling are the same capability, currently locked to the laptop.
- `scanned-products.json` is precedent for a runtime-writable product store.
- Import matching searches FOODS only (`import-recipe-from-photos.use-case.ts:72`); scanned products are barcode-lookup only, never name-searched.

## Goals / Non-Goals

**Goals:**

- Resolve unmatched ingredients on the phone, in the moment, with AI-proposed food entries the user confirms (editable sanity check).
- Never lose the recipe's amounts/units/notes for resolved lines.
- Confirmed entries become searchable immediately (import matching + picker), so the same miss never recurs.
- Keep the curated `foods.json` pipeline as the long-term home: the overlay is a staging area the laptop pipeline drains.
- Remove the now-redundant unmatched-ingredient collection subsystem.

**Non-Goals:**

- No pending/unresolved ingredient state on saved recipes (explicitly ruled out).
- No OFF participation in import matching (rate limits, packaged-product noise).
- No merged/weighted cross-source ranking — strict cascade first, revisit with usage.
- No manual "create food" form; AI-propose + edit covers it.
- Screen layout/visual design — supplied by a separate design handoff before implementation.

## Decisions

### D1: New `USER` ingredient source backed by a runtime-writable overlay store

`backend/data/user-foods.json` with shape `{ foods: FoodEntry[], synonyms: LearnedSynonym[] }` where `LearnedSynonym = { foodId: string, synonym: string }`. Foods reuse the exact curated `FoodEntry` shape and validation. A `UserFoodsStore` port in the domain; JSON adapter in infrastructure (same pattern as scanned products).

*Why not write into `foods.json`?* It is a build artifact — `build:foods` regenerates it and would clobber runtime additions.

*Why a distinct `USER` source instead of folding into FOODS?* Provenance must stay visible (badge, debug box) and the import cascade needs the tiers distinguishable. Search results from the overlay carry `source: 'USER'`.

### D2: Learned synonyms mutate the in-memory curated index, persisted in the overlay

A confirmed `synonym-of` verdict appends `{ foodId, synonym }` to the overlay and immediately registers the synonym on the in-memory FOODS index (`addSynonym`). At startup, overlay synonyms are re-applied after `foods.json` loads. Matches via a learned synonym return the **curated** entry (`source: 'FOODS'`) — the synonym is an alias, not a new food.

*Consequence of export-and-clear:* learned synonyms leave the running index when the overlay is drained, until the rebuilt `foods.json` (with merged synonyms) deploys — same accepted self-healing window as overlay foods.

### D3: Import matching becomes a strict cascade — FOODS → USER → SCAN

Per ingredient: search FOODS (incl. learned synonyms); if zero hits, search USER; if zero hits, search SCAN (scanned products gain name search using the shared fold helper). First tier with ≥1 hit wins; lower tiers are not consulted. The existing normalized-name retry wraps the whole cascade (full cascade with raw name, then full cascade with normalized name). OFF is never queried during import.

*Why strict cascade over merged scoring?* Predictable, explainable, keeps curated data authoritative, and avoids the unsolved problem of cross-source score comparability (scanned product names are brandy/noisy). SCAN is last because package products are the most specific/noisy tier.

### D4: One batch proposal call per review screen, triage + generation combined

`POST /propose-ingredient-resolutions` accepts all unmatched items (name, note, unit, pieceQuantity) and makes **one** Anthropic call returning, per item, one of:

- `synonym-of` — existing food id + the synonym to learn (+ confidence)
- `new-food` — a complete draft `FoodEntry` (canonical name, synonyms, unit g|ml, macrosPer100, optional pieces, optional untracked) (+ confidence)
- `skip` — reason

The prompt includes, per item, the top-K (K=8) fuzzy candidates from FOODS+USER instead of the full catalog (runtime token economy; the laptop script can keep full-catalog context). Name **and** note are passed — the note changes nutrition ("Tomaten, getrocknet in Öl"). The endpoint persists nothing.

The frontend fires this request in the background as soon as the review screen mounts with unmatched items (React Query prefetch). Per-item confirm sheets read from the cached result — usually zero perceived wait. Proposal failure (502/503) degrades gracefully: the panel keeps its existing manual match (+) and discard (✕) paths.

The same endpoint pair also powers a **single-item create-with-AI affordance in the shared search panel**: when a query yields no suitable result, the user can trigger a one-item propose for the query string, walk the same confirm sheet, and receive the confirmed entry as a normal search selection (`source: 'USER'`, or the curated entry for a synonym verdict). This closes the wrong-match gap — swapping a mismatched row to a food that doesn't exist yet — and makes the capability available in recipe edit and meal logging without extra backend surface (confirm already accepts payloads without a prior batch propose).

*Why one call instead of Haiku-triage + Opus-generate like the script?* One round-trip bounds latency on the phone; a current mid-tier model handles both verdicts and per-100 estimates for generic foods well, and the user confirms every value anyway. Model id configurable via env alongside the existing extractor model config.

### D5: Confirm endpoint persists to the overlay and returns a fully-matched draft row

`POST /confirm-ingredient-resolution` takes the (possibly user-edited) resolution plus the original draft ingredient fields and:

1. Persists — new food appended to overlay (validated with the curated rules), or synonym appended + registered on the index.
2. Builds the resolved row by **reusing the existing import matching rules** (unit override, piece preservation, untracked + displayQuantity inheritance) against the just-created/just-matched entry.
3. Returns the `MatchedDraftIngredient`; the frontend swaps it from the unmatched panel into the ingredient list with original amount/note intact.

*Why return the matched row from the backend instead of assembling it client-side?* The post-match rules (unit-override, piece-drop, untracked displayQuantity) already live in the import use case; duplicating them in the frontend invites drift.

Folded-name collision with an existing curated/overlay food on a `new-food` confirm → `409` with a stable error code (triage should have said `synonym-of`; the user can fall back to manual match).

### D6: Atomic export-and-clear replaces the unmatched export

`POST /export-user-foods` returns the full overlay `{ foods, synonyms }` and clears the store in the same operation. Settings panel swaps the unmatched-ingredients panel for this control (timestamped filename download, disabled when empty, copy makes clear that exporting drains the store). The downloaded file is the only copy until the laptop pipeline lands — accepted; the window is self-healing (re-resolving via AI recreates entries; the augment triage dedups at promote time).

### D7: Augment script retargeted to the overlay export

`build:foods:augment <export.json>` now ingests `{ foods, synonyms }`:

- **Synonyms** — applied to the named curated entries (same human-in-the-loop accept menu as today, but these were already phone-confirmed, so accept is the default action).
- **Foods** — promoted into `foods.json` + `foods-seed-keys.ts`; the Opus drafting call receives the phone-confirmed entry as a hint and regenerates, keeping the curated artifact uniformly curated; the human reviews per item as today.

### D8: Shared AI tooling extracted from `scripts/` into `src`

Triage/generation tool schemas, prompts, and entry validation move to a module under `backend/src` (domain port `FoodResolutionProposer` + Anthropic adapter in infrastructure). The augment and build scripts import from there — same package, one source of truth, no drift between laptop and runtime behavior.

### D9: Remove the unmatched-ingredient collection subsystem

Domain + infrastructure + HTTP handler + recorder wiring + frontend settings panel/api/queries + data file. The review screen's unmatched panel remains and becomes the resolve flow's host. No data migration: the store held only name counts, which the overlay supersedes with richer data.

### D10: Design-handoff reconciliation (`design_handoff_resolve_unmatched_ingredients/`)

The handoff is the visual/interaction source of truth; the spec is the behavioral one. Where they diverged, these calls were made (confirmed with the user):

- **Create host (Host B) is AI-assisted** — the prototype opens a blank manual form; ship the spec behavior instead: the create trigger fires a single-item propose, the sheet opens immediately in `ResolvePane`'s existing loading state, then shows the editable prefill. Synonym verdicts work from this host too.
- **Confidence stays categorical** (`high | medium | low`) — the prototype's numeric "KI · 82%" chip is replaced by the three-tone chip with "KI · hoch/mittel/niedrig". No numeric confidence in the backend contract.
- **Manual matching lives inside the sheet** (spec amended to match the design) — there is no per-row "+" anymore. Two prototype dead-ends MUST be fixed in implementation: `skip` rows render a non-tappable "Kein Vorschlag" span (must open the sheet with fallback actions), and the sheet's loading state has no manual escape (must offer one).
- **In-sheet `ManualMatch` reuses the real search** (same sources as the picker: FOODS + USER + OFF), not a separate catalog-only search — otherwise manual resolution would lose the OFF fallback the old picker path had.
- **Backend owns id generation** — the prototype slugs ids client-side; confirm payloads send the entry without trusting a client slug.
- **Settings overlay-export panel is not in the handoff** — build it from the `user-foods-overlay` spec following the existing settings-screen patterns.
- Copy nit: the all-resolved success card says "{n} neue Einträge … gespeichert" but counts synonym and manual resolutions too; count only overlay writes (or soften the copy).
- The create trigger renders from 2+ trimmed characters (search minimum), not 1.

### D11: Post-smoke fixes from real-recipe feedback (Griechische Hähnchen-Gyros-Pfanne)

Two issues surfaced testing a real import; both fixed:

- **Proposer candidates must be fuzzier than the auto-matcher.** The propose use case originally gathered candidates with the same strict substring `searchByName` used for auto-matching, so a plural query ("grüne Oliven") found nothing against a singular catalog entry ("Grüne Olive") — the model got an empty candidate list and proposed `new-food`, producing a duplicate. Fixed with a dedicated fuzzy finder (`domain/foods/fuzzy-candidates.ts`) behind a `ResolutionCandidateFinder` port (`CompositeResolutionCandidateFinder` over FOODS incl. learned synonyms + the overlay). The scorer rewards: exact tokens, ≥4-char shared/near-identical prefixes ("Olive"↔"Oliven"), and **boundary containment** for German compounds — a base-food token sitting at the start or end of a query token ("Meersalz"⊃"Salz", "Kirschtomaten"⊃"Tomaten", "Apfelmus"⊃"Apfel"), anchored to prefix/suffix so mid-word coincidences are rejected ("Preiselbeere"↛"Reis"). This is safe to be generous because candidates are only AI-judged suggestions, never auto-matches. Auto-matching stays strict; only the proposer's candidate net widened — the D4 intent the first pass missed. Remaining gap: compounds needing true morphological splitting with linking morphemes (e.g. "Hühnerbrühe"→"Brühe") still fall through to `new-food`.

- **Untracked steering + salvage.** The proposer prompt now has an explicit untracked rule (seasonings/herbs/spices → `untracked: true` + zero macros, prefer synonym-of an untracked candidate), and the propose use case coerces an `untracked`-with-nonzero-macros entry to zero rather than degrading it to `skip` — so a near-right seasoning proposal survives instead of being dropped.
- **Extractor must not split identity-changing qualifiers.** The vision model parsed "2 EL getrocknete Tomaten in Öl" as `name: "Tomaten"` with `pieceUnitLabel: "getrocknete in Öl"`, losing that oil-packed sun-dried tomatoes are a different food (~5–6× the calories of fresh). Hardened the `extract-recipe-tool` prompt: `pieceUnitLabel` is a bare count noun only (never the food name or a quality modifier), and identity-changing qualifiers ("getrocknete Tomaten in Öl") stay on `name` — so it lands in the resolve panel as a correct `new-food`, not a mangled "Tomaten".

## Risks / Trade-offs

- [AI proposes wrong macros] → show-and-confirm with editable values; provenance stays visible (`USER` badge); laptop pipeline re-curates at promote time.
- [User confirms `new-food` when `synonym-of` was right → near-duplicate foods] → triage is instructed to prefer synonym verdicts and sees top-K candidates; confirm rejects folded-name collisions; augment triage is the second net.
- [Export → failed laptop run leaves entries only in the export file] → accepted; file on disk is recoverable, app self-heals by re-proposing.
- [Learned synonyms vanish from the index after export until redeploy] → same self-healing window; worst case one redundant re-resolve.
- [SCAN tier name noise produces odd import matches] → SCAN is the last tier, consulted only when FOODS and USER are empty; debug box shows the source per candidate.
- [Batch proposal latency or failure blocks review] → prefetch is non-blocking; manual match/discard never depend on it.

## Migration Plan

1. Land overlay store + search integration + resolve endpoints + review-screen flow + removals in one change (TDD throughout).
2. Data: `backend/data/user-foods.json` starts as `{ "foods": [], "synonyms": [] }`; `backend/data/unmatched-ingredients.json` is deleted.
3. Script: augment retargeted in the same change; old export format no longer accepted (clear error naming the expected shape).
4. Rollback: revert the change commit; the overlay file is ignored by reverted code and can be deleted manually.

## Open Questions

- None blocking. Screen layout/copy for the proposal confirm sheet arrives via the separate design handoff; spec pins behavior only.
