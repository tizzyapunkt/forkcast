## Why

AI recipe import silently matches ingredients to the wrong catalog food. It accepts any catalog hit the name search returns, however weak. The search ranks by containment, so a recipe's "Honig" lands on the only entry containing "honig":

| Recipe says | Catalog has | Imported as | Why the search returned it |
|---|---|---|---|
| `1½ TL Honig` | no Honig, but *Honigmelone* | **Honigmelone** (~0.4 vs ~3 kcal/g) | "honig" is a prefix of "honigmelone" |
| `2 EL Peanut-butter-Pulver` | *Butter* | **Butter** (~7 vs ~4 kcal/g) | "butter" is a hyphen-delimited word inside the query |
| `Reis` | *Reisnudeln* | **Reisnudeln** | "reis" is a prefix of "reisnudeln" |

With one candidate there is no "Alternativen" marker, so nothing on the review screen hints that the food is wrong. The only clue is the name itself. After the spoon fix (#52), these wrong matches are the largest calorie error left in imports, and a different model would not change them: the search, not the model, picks the food.

The containment ranking is right for the **interactive** search, where "Honig" should suggest "Honigmelone". It is wrong for the **import**, which picks a food without asking.

## What Changes

- **Name matches get a confidence.** Beside its score, the name search reports whether a hit is *confident*. The rule rests on the German compound head: the last element of a compound is what the food is ("Honig**melone**" is a melon, "Peanut-butter-**Pulver**" is a powder). A hit is confident when it is:
  - an exact name or synonym match
  - a whole word in either direction, unless a hyphen follows it (then it is a compound modifier, as in "Peanut-**butter**-Pulver")
  - a word start that differs from the query only by an inflection ending: Kichererbse → Kichererbse**n**, Ei → Ei**er**

  Everything else is partial: prefix into a longer word (Honig → Honigmelone), mid-word and substring hits.
- **The import auto-matches confident hits only.** The first confident candidate in the cascade wins. A tier with only partial hits no longer stops the cascade: the lower tier and the normalized-name retry still run. With no confident hit anywhere, the row is unmatched and the AI resolve flow proposes a food, e.g. a new "Honig".
- **Rejected partial hits stay visible for debugging.** An unmatched row's provenance lists the partial candidates the search offered, with `chosen: null`.
- **Interactive search is unchanged**: same ranking, same results. Its results just carry the new optional confidence field.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-recipe-import`:
  - a new requirement defines a confident name match
  - catalog matching and the normalized-name retry accept confident candidates only
  - provenance keeps partial candidates on unmatched rows

## Impact

- **Backend**
  - `domain/ingredient-search/score-food-match.ts`: confidence alongside the score
  - `domain/ingredient-search/types.ts`: optional `matchConfidence` on `IngredientSearchResult`
  - `domain/foods/rank-food-entries.ts` and `infrastructure/ingredient-search/composite-ingredient-search.service.ts` (SCAN): set it
  - `domain/ai-recipe-import/import-recipe-from-photos.use-case.ts`: confident-only cascade and retry
- **Frontend**: none. The review and resolve flows already handle unmatched rows.
- **Behavior**: more unmatched rows on import, each resolved once. A confirmed synonym or new food then matches exactly on every later import.
- **Out of scope**: nutrition qualifiers lost to a *whole-word* match ("Frischkäse, 0,2 % Fett" → "Frischkäse (Doppelrahmstufe)" via the normalized retry, "Frischkäse leicht" → "Frischkäse"). That is a qualifier problem, not a compound one.
- **Stacked on #52** (`feat/reliable-spoon-amounts`), because both change the "Ingredient matching against existing catalog" requirement and the import use case.
