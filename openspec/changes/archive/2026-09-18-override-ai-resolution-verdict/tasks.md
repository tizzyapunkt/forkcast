## 1. Backend: id derivation and synonym hygiene on confirm

- [x] 1.1 Add failing tests to `backend/src/domain/food-resolution/confirm-resolution.use-case.test.ts`: a `new-food` confirm whose entry id disagrees with its name persists under `slugifyName(name)`; a name yielding an empty slug returns `422` and persists nothing; a derived id colliding with an existing entry returns `409`; an unrenamed confirm still persists exactly the proposed id
- [x] 1.2 Derive the id from the canonical name in `confirmResolution` (`kind: 'new-food'`) before `catalog.add`, returning `422` on an empty slug — make 1.1 pass
- [x] 1.3 Add failing tests for synonym hygiene on `new-food`: submitted `synonyms` are deduplicated case- and diacritic-insensitively against each other and dropped when they fold to the canonical name
- [x] 1.4 Implement the synonym dedup in the confirm path — make 1.3 pass
- [x] 1.5 Extend `backend/src/http/food-resolution/resolution.handlers.test.ts` with the `422` unsluggable-name case and a rename round-trip through the handler

## 2. Frontend: dropped-qualifier helper

- [x] 2.1 Write failing tests for a `droppedQualifier(rawName, canonicalName)` helper in the import feature: `("dünne Reisnudeln", "Reisnudeln") → "dünne"`; identical names → `""`; punctuation-only remainder → `""`; casing of the raw token preserved; multi-token remainder joined in raw order
- [x] 2.2 Implement the helper using the existing fold utility for comparison — make 2.1 pass

## 3. Frontend: resolve sheet becomes a state machine

- [x] 3.1 Extract the new-food editor, synonym proposal, and manual-match panel from `resolve-pane.tsx` into sibling files in `features/ai-recipe-import/` with no behaviour change; existing `resolve-pane.test.tsx` / `resolve-flow.test.tsx` stay green
- [x] 3.2 Add a failing test: opening a `synonym-of` proposal, switching to the new-food editor, editing macros, going back, and returning shows the edited macros
- [x] 3.3 Replace the verdict-derived body selection with an explicit `mode` state seeded from the proposal verdict, plus a back action that restores the previous mode — make 3.2 pass

## 4. Frontend: override a synonym verdict with an own entry

- [x] 4.1 Add failing tests: the synonym proposal exposes a "create own entry instead" action; triggering it fires `draft-catalog-entry` with the raw name and shows a cancellable loading state; the returned draft opens in the editable new-food editor; confirming persists the new entry and writes no synonym
- [x] 4.2 Add a failing test for the degraded path: a failing draft request opens an empty editor seeded with the raw name and no AI-estimate hint
- [x] 4.3 Wire `useDraftCatalogEntry` into the resolve sheet behind the new action — make 4.1 and 4.2 pass
- [x] 4.4 Add the German strings for the action, loading, and fallback states to `i18n/de.ts`

## 5. Frontend: rename handling in the new-food editor

- [x] 5.1 Add failing tests: renaming the draft name appends the originally proposed name to the visible, editable synonym list; removing it from the list keeps it out of the confirm payload; a no-op rename adds nothing
- [x] 5.2 Render `synonyms` as an editable list (add/remove) in the new-food editor and implement the retention rule — make 5.1 pass
- [x] 5.3 Add failing tests for the row note: a rename pre-fills the note field with the dropped qualifier only when the row has no note; an existing note is left untouched; the field is editable and clearable; the confirmed row carries the note while the catalog entry does not
- [x] 5.4 Add the editable row-note field to the sheet (both verdict paths) and feed it into `original.note` on confirm — make 5.3 pass
- [x] 5.5 Add the German strings for the synonym list and note field

## 6. Frontend: manual pick teaches a synonym

- [x] 6.1 Add failing tests: picking a `CATALOG` result for an unmatched raw name shows a learn-synonym toggle enabled by default and confirms via `{ kind: 'synonym', foodId, synonym: <raw name> }`; the toggle off resolves the row without any request; `OFF`/`SCAN` results show no toggle; a raw name folding to the entry's name or an existing synonym shows no toggle and writes nothing
- [x] 6.2 Route `pickManual` through the confirm mutation when the toggle applies, using the returned row instead of the hand-rolled one — make 6.1 pass
- [x] 6.3 Add a failing test for the `create` context: a taught pick still hands the picked entry to the host flow as an `IngredientSearchResult`; make it pass
- [x] 6.4 Make the proposed synonym string editable on a `synonym-of` proposal, with a test that the edited string is what gets persisted
- [x] 6.5 Add the German strings for the toggle and the editable synonym field

## 7. Frontend: override a new-food verdict with an existing entry

- [x] 7.1 Add a failing test: the new-food editor exposes an "assign to existing entry" action that opens catalog search, and picking an entry resolves the row against it, persists the raw name as a synonym, and creates no entry
- [x] 7.2 Wire the action to the manual-match mode with the learn-synonym path from section 6 — make 7.1 pass
- [x] 7.3 Add the German string for the action

## 8. Verification

- [x] 8.1 Run the repo's test, lint, typecheck, and format commands across both workspaces (see the `forkcast-dev` skill) and fix fallout
- [x] 8.2 Manually walk both override paths against a real import: `Limettensaft` → own entry, `dünne Reisnudeln` → renamed to `Reisnudeln` with `dünne` as the row note; verify the catalog manager shows `reisnudeln` with the retained synonym and that re-importing the same recipe matches without a resolve step
- [x] 8.3 Update `openspec/specs/unmatched-ingredient-resolution/spec.md` via the archive/sync flow once the change is verified
