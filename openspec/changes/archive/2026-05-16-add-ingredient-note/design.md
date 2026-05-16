## Context

The previous change (`extend-foods-from-unmatched-imports`) addressed the catalog feedback loop and, as a side effect, tightened the extractor: ingredient `name` is the food noun only; prep modifiers ("fein gehackt", "geschält", "in Scheiben") were instructed to move into recipe `steps`. That kept the matchable name clean for unmatched-ingredient dedupe.

Pushing prep into `steps` has a problem in practice. Plenty of source recipes write the prep inline on the ingredient line (`"1 TL Ingwer, fein gehackt"`) and never repeat it in the step list. When the extractor strips the modifier and the source recipe doesn't have a corresponding step, the prep info is silently lost. The current prompt asks the model to add a short step when it strips, but that's brittle — sometimes the model doesn't, and even when it does, "fein gehackt" as a freestanding step reads awkwardly.

The natural home for this information is right where most cookbooks put it: on the ingredient row, as a short qualifier next to the name. forkcast already has a precedent for subtitle-style data on ingredient rows (`displayQuantity` on untracked rows renders a secondary line like "1 TL"), so the rendering pattern is established.

Stakeholders: solo developer/user. Single-user app, JSON persistence, hexagonal backend, React + RQ frontend.

## Goals / Non-Goals

**Goals:**
- Give prep modifiers a clean, persisted home on the ingredient row so they survive from photo → draft → saved recipe → recipe re-render.
- Keep the matchable `name` clean (no regression on the unmatched-ingredient dedupe that the previous change enabled).
- Let the user edit the note on existing recipes — it's a recipe-authoring field, not an immutable extractor output.
- Stay backward-compatible: existing recipes without a note load and render unchanged.

**Non-Goals:**
- No surfacing of `note` in the meal-log entry display, the daily totals, or the (future) grocery list — it's an authoring concept, not a runtime one.
- No structured representation of the prep modifier (no enum, no tagging). It's free text.
- No localisation of the note. Whatever language the source recipe uses is what's stored.
- No retroactive backfill of notes onto existing recipes. They keep their current `name` and `steps`; the user can edit if they care.
- No change to ingredient matching, normalization, or the unmatched recorder — `note` is invisible to that pipeline.

## Decisions

### 1. `note` lives on the ingredient row, not at the recipe level

Adding `note?: string` to each entry in `Recipe.ingredients[]` (and to both draft variants in `ai-recipe-import`) keeps the data attached to the thing it qualifies. The alternative — a parallel `prepNotes: Record<ingredientIndex, string>` map on the recipe — was rejected because it splits the truth across two structures, complicates reorder/delete, and adds nothing in return.

The field is optional. Absent / empty after trim means "no note on this row". We never persist an empty string — the validator rejects it, the save path strips it.

### 2. Validation: trim, non-empty when present, max 80 chars

Constraints on `note` when present:
- Must be a string.
- Trimmed length must be `>= 1` (no empty notes).
- Trimmed length must be `<= 80` (room for short German phrases like `"in dünne Scheiben geschnitten"` without inviting paragraph-style abuse).
- Applied uniformly on both `add-recipe` and `update-recipe`.

**Why 80 and not, say, 24 (the `displayQuantity.unitLabel` cap)?** `displayQuantity.unitLabel` is a unit token; this is a free-text qualifier that can be 2-4 short words in German. 80 gives "in feine Würfel geschnitten und kurz angeschwitzt" room while still being short enough that the UI doesn't need to truncate. The cap is a guard against the extractor (or a future user) shoving full instructions into the wrong field.

**Alternative considered:** no cap. Rejected — without a cap, an over-eager LLM could put an entire prep paragraph into `note`. The UI would have to deal with it.

### 3. Extractor: `note` becomes the primary home for prep modifiers

The current extractor prompt says: prep modifiers MUST NOT appear in `name`; they belong in `steps`. After this change:
- Prep modifiers MUST NOT appear in `name` (unchanged).
- Prep modifiers SHOULD appear in `note` on the ingredient row (NEW — primary).
- A corresponding step is no longer required. The prep info now has a stable home on the row; duplicating it into `steps` is unnecessary and was the source of awkward freestanding step text.
- Leading adjectives that change food identity (`"Zuckerfreier Ahornsirup"`, `"Geräucherter Lachs"`) stay on `name` (unchanged).
- `note` is omitted when there's no modifier on the ingredient line.

The tool-input schema gains an optional `note` field on each ingredient. `parseToolInput` trims it, drops empty strings, and enforces the 80-char cap (drop if too long rather than throw — the row is still valid without a note).

**Why drop-rather-than-throw on overlong note?** If we threw, an overlong note would tank the whole import. The note is a quality-of-life field; a malformed note shouldn't poison a 12-ingredient recipe. The 80-cap is enforced strictly on user save (where the user can fix it); on extractor output, we drop with a warning.

**Alternative considered:** keep prep in both `note` *and* `steps`. Rejected — duplication invites drift between the two when the user edits one, and steps gain noise the user doesn't want.

### 4. Matching pipeline: `note` rides along, untouched

`note` is read out of `RawIngredient`, carried verbatim through `matchIngredient`, and attached to both `MatchedDraftIngredient` and `UnmatchedDraftIngredient`. Nothing in the search, normalization, unit override, piece-quantity, or unmatched-recorder paths reads or writes it.

This is deliberately boring: the note is not a matching signal, and any logic that touched it would be a regression risk for the already-shipped unmatched feedback loop.

### 5. UI rendering: subtitle row under the name (not inline)

Inline rendering — `Ingwer · fein gehackt` on the primary line — was the obvious first choice, but it has problems:
- Mixes two fields (matchable name + qualifier) on the same visual axis, fighting the existing pattern where the name line carries amount controls.
- Forces a truncation policy on what is already a sometimes-long line.
- Reads as a single label, making it less obvious the note is editable on its own.

Subtitle row under the name, matching the existing `displayQuantity` subtitle pattern:

```
[name picker]          [amount input] [unit]
fein gehackt                                      ← note subtitle / edit
```

- Recipe form: the note renders as a small editable text input below the name; empty state shows a placeholder ("Notiz hinzufügen" or similar). Saving the form trims and submits.
- Review-import screen: the note renders as a read-only subtitle (the user reviews and can adjust the recipe form afterward, or — stretch — edit inline; settled in implementation).
- Recipe read view (if/when present): subtitle, read-only.

The note is independent of `displayQuantity`. Both may appear; they render on separate lines.

**Alternative considered:** inline rendering with a separator. Rejected — see above.

### 6. No surfacing downstream of the recipe

The meal-log entry display shows ingredient names from a logged recipe. The note is **not** rendered there:
- Most prep notes ("fein gehackt") are only relevant during cooking, not while reviewing what was eaten yesterday.
- The meal-log view already has tight density constraints (per-entry macros, batch context).
- Adding the note there would require deciding when it's meaningful and when it's noise — that's a non-trivial design call we don't need to make to ship the recipe-side win.

Same reasoning for the grocery list (future): shopping doesn't care about prep.

### 7. Backward compatibility

- The persisted shape of existing recipes is unchanged; loading old recipes returns ingredient rows with `note` simply absent.
- Repository serializer needs no code change — the field is optional on the type, so `JSON.stringify` omits it when undefined.
- Frontend: any code path that reads `ingredient.note` must treat `undefined` as "no note" — covered by TypeScript optionality.
- API: `add-recipe` / `update-recipe` payloads accept the field; missing field is equivalent to absent (no validation error).

## Risks / Trade-offs

- **[Risk] Extractor overuse — model puts non-prep info into `note`** (brand names, store names, supplier notes, free-form commentary) → Mitigated by the tight prompt instruction ("preparation, cut, or quality modifiers only — examples: …") and the 80-char drop-on-overflow rule. Worst case the user edits or clears the note in the review screen.
- **[Risk] Existing recipes (no `note`) feel inconsistent after import gets the new field** → Accept. The user can add notes manually if they care. No backfill; old recipes are fine.
- **[Risk] Loss of step coherence after we stop pushing prep into steps** → Low. The extractor was already pushing prep into steps awkwardly; removing that path returns steps to describing the cooking process only, which is the more natural shape.
- **[Trade-off] Subtitle row UX adds vertical density to the recipe form** → Accept. The form is already a tall, scrollable list; one extra line per ingredient that has a note is a fair price for not losing the data.
- **[Trade-off] No structured prep representation** → Accept. Structured prep (enum / tag set) would be over-engineering for a single-user app. Free text is the right primitive.

## Migration Plan

- No data migration. Existing `recipes.json` is forward-compatible — recipes without `note` load and render exactly as before.
- Backend changes are additive: new optional field on the validator, new optional field on the extractor tool schema. Old clients that don't send `note` keep working.
- Frontend changes are additive: the recipe form gains a note input; review-import gains a subtitle row. Old recipes (no notes) render unchanged.
- Rollback: revert. No state on disk gets the new field unless the user saves a recipe after the change ships, and even then it's optional — older code would see it as an unknown extra field and ignore it.

## Open Questions

- **Edit affordance on the review-import screen**: should the note be inline-editable on the review screen, or only on the post-save recipe form? Lighter-touch: read-only on review, edit on form. Final call in implementation when the screen is open.
- **Placeholder copy**: German vs English placeholder text. The rest of the UI is mixed; follow existing convention in the recipe form (likely German for user-facing copy).
- **Display in piece-quantity drawer / replace-ingredient flow**: when the user swaps an ingredient via the picker, does the note transfer or clear? Default: clear (a different food usually means different prep), but worth confirming in implementation. Captured here so it doesn't get lost.
