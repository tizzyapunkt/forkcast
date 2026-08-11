## Why

The resolve sheet offers one editable path per AI verdict and no way to overrule the verdict itself, so two everyday corrections are impossible or lossy:

- The model proposes `Limettensaft` as a synonym of `Limette`. The only choices are *accept* — wrong nutrition, and the wrong alias is now learned permanently — or *manual catalog search*, which cannot create the entry the user actually wants. There is no "no, make this its own entry" path.
- The model proposes a new food `dünne Reisnudeln`. The catalog should hold the generic `Reisnudeln` (thin or not, the nutrition is the same) and `dünne` belongs on the recipe row as a note. Renaming the draft in the editor is possible today, but the AI-derived `id` (`duenne-reisnudeln`) and synonym list are left untouched — the entry ends up keyed against its own name — and the dropped qualifier is simply lost.

Manual catalog picks also teach the catalog nothing: the raw ingredient name is dropped, so the next import of the same recipe produces the same unmatched row again.

## What Changes

- **Reject a `synonym-of` verdict and create a new entry instead.** The synonym proposal gains a "create own entry instead" action that requests a fresh AI draft for the raw name via the existing `POST /draft-catalog-entry` endpoint and opens the editable new-food editor with it. The synonym is not persisted.
- **Renaming a new-food draft is a first-class edit, not just a text change.** Saving a draft under an edited name re-derives its `id` from that name, keeps the originally proposed name as a synonym (so the raw recipe wording still auto-matches on re-import), and offers the qualifier the rename dropped (`dünne`) as the recipe row's note — the recipe-specific part stays on the recipe, the generic food goes in the catalog.
- **The draft's synonyms and the row's note become editable** in the sheet, so the user can drop the retained synonym or reword the note instead of accepting the defaults.
- **Reject a `new-food` verdict and assign it to an existing entry instead.** The new-food editor gains an "assign to existing entry" action leading into the sheet's catalog search; picking an entry persists the raw name as a synonym of it rather than inventing a duplicate.
- **Manual catalog picks teach the catalog.** Any manual pick in the resolve sheet persists the raw ingredient name as a synonym of the picked entry — a toggle, on by default, so the user can decline when the raw name is not actually an alias. Today the pick is client-side only and persists nothing.
- **The learned synonym string is editable** on a `synonym-of` proposal, so a user can accept the target entry while correcting the alias that gets learned.

## Capabilities

### New Capabilities

None — this extends the existing resolution flow.

### Modified Capabilities

- `unmatched-ingredient-resolution`: the resolve step gains verdict-override paths in both directions (synonym → own entry, new entry → synonym of an existing food); renaming a new-food draft re-derives the entry id, retains the proposed name as a synonym and offers the dropped qualifier as the row note; synonyms, the learned synonym string and the row note are editable before confirming; manual catalog picks persist the raw name as a synonym.

## Impact

- **Backend**: `confirm-resolution.use-case.ts` — new-food confirms re-derive and validate the entry id against its (possibly edited) name; the confirmed row's note comes from the submitted original fields. No new endpoint: `POST /draft-catalog-entry` and `POST /confirm-ingredient-resolution` already cover both directions. `slugify-name.ts` is reused from the catalog domain.
- **Frontend**: `features/ai-recipe-import/resolve-pane.tsx` (verdict-override actions, id re-derivation and synonym retention on rename, dropped-qualifier note, synonym toggle on manual pick), `queries/use-resolve-ingredients.ts`, `queries/use-catalog.ts` (reuse `useDraftCatalogEntry` inside the resolve flow), `i18n/de.ts`.
- **Behavioural**: manual picks now write to the catalog overlay where they previously did not — intended, and surfaced by the toggle.
- **No API/schema breaks**: existing propose/confirm payloads stay valid.
