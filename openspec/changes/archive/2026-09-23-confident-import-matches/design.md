## Context

See proposal.md, "Why". The constraints that shape the approach:

- **One scorer, two very different users.** `scoreFoodMatch` ranks catalog entries (via `rankIndexedFoods`) and scanned products (in the composite search service) by tier:
  - exact 100/90
  - whole word 80/70
  - prefix 60/50
  - token start 40/30
  - substring 20/10

  (Canonical name / synonym; the reverse "name as a word inside the query" direction scores whole-word only.)

  The interactive search and the resolve sheet want this loose ranking as suggestions. The import takes `results[0]` of the first tier with *any* result, with no one confirming it.
- **Search results carry no score and no synonyms.** The import cannot judge a result's strength on its own. `Erdnussmus` → `Erdnussbutter` is right *because* of a synonym the import never sees.
- **The failures are German compounds.** A compound's head is its last element: Honig**melone**, Reis**nudeln**, Peanut-butter-**Pulver**. The query lands on the modifier, not the head.
- **An unmatched row is cheap to fix.** The resolve flow proposes a new food or a synonym per unmatched row, and a confirmed synonym makes the next import an exact match.

## Goals / Non-Goals

**Goals:**

- The import never silently picks a food whose name merely *contains* the ingredient as a modifier.
- Keep every current right match: exact names and synonyms, whole words ("Kichererbsen (aus der Dose)"), hyphen heads ("Bio-Tomaten"), plural and singular (Kichererbse/Kichererbsen).
- Leave interactive search ranking and results byte-for-byte unchanged.

**Non-Goals:**

- **Qualifier-sensitive matching.** "Frischkäse leicht" → "Frischkäse", and "Frischkäse, 0,2 % Fett" → "Frischkäse (Doppelrahmstufe)" through the normalized retry. These are whole-word matches that lose a nutrition qualifier: a separate problem.
- **Inflection in the other direction** (recipe plural "Zwiebeln", catalog singular "Zwiebel"). The search finds no hit there today either, so nothing regresses.
- **Fuzzy or semantic matching**, or asking the model to pick. Out of proportion for this bug.

## Decisions

### 1. Confidence is computed where the score is: in the scorer

The scorer already walks every name/synonym hit and knows each hit's position and the characters around it, so it is the one place that can classify a hit. `scoreFoodMatch` keeps its signature for current callers. A new `matchFoodEntry` returns `{ score, confident }`, and `scoreFoodMatch` becomes `matchFoodEntry(...).score`. Confidence is the OR over all hits (canonical, synonyms, both directions): one confident hit makes the entry confident.

- **Alternative: re-classify in the use case from `result.name`.** Rejected: results don't carry synonyms, so every synonym match (`Erdnussmus` → `Erdnussbutter`) would read as partial.
- **Alternative: raise the score threshold** (accept ≥ 70). Rejected: whole-word scores 80 even for "Peanut-**butter**-Pulver", and prefix scores 60 for plural "Kichererbse**n**". Score tiers and confidence cut across each other.

### 2. The rule: exact, whole word not followed by a hyphen, or a word start plus an inflection ending

The spec's requirement "Import auto-matches confident name matches only" lists the cases. The two refinements over the existing tiers:

- **A following hyphen demotes a whole-word hit.** It is the only boundary that glues the word into a compound as a modifier. Space, comma and parentheses still separate words ("Kichererbsen (aus der Dose)" → Kichererbsen). A *preceding* hyphen keeps it confident, because the word is then the compound's head ("Bio-Tomaten" → Tomaten).
- **Prefix and token-start hits are confident only up to an inflection ending.** The rest of the name's word must be one of `n`, `e`, `en`, `s`, `es`, `er` (Kichererbse**n**, Ei**er**, Möhre**n**). Anything longer is a new compound element, e.g. **melone**, **nudeln**, **mark**, **filet**.

`Hähnchenbrust` → `Hähnchenbrustfilet` becomes partial, so it's one resolve click the first time, then a learned synonym. That is the price, and it's accepted: a silently wrong food costs more than one click.

### 3. Results carry `matchConfidence`, and only the import reads it

`IngredientSearchResult` gets an optional `matchConfidence: 'confident' | 'partial'`, set by the catalog ranking and the SCAN name search. Ranking and result lists don't change. OFF results carry nothing, and the import never queries OFF. A result without the field (e.g. a test double) counts as confident, so existing callers and fakes keep working. The HTTP search endpoint returns the field too, which is harmless and could later power a "Teiltreffer" hint in the UI.

### 4. The cascade continues past partial-only tiers

The import now looks for the first confident candidate: CATALOG, then SCAN, then the same cascade with the normalized name. Previously the first non-empty tier won and the retry ran only on zero results. A tier with only partial hits must not end the cascade, or "Reis" (catalog: Reisnudeln only) could never reach a scanned "Reis".

When nothing is confident, the row is unmatched. Provenance keeps the partial candidates of the first tier that had any, so `Honigmelone` shows up as the rejected near-miss when debugging. Draft-row behavior for unmatched rows is unchanged.

## Risks / Trade-offs

- **[More unmatched rows]** Every prefix-into-compound hit that happened to be right (e.g. `Hähnchenbrust` → `Hähnchenbrustfilet`) now asks for one resolve step. → The resolve AI proposes `synonym-of` for exactly these, and the learned synonym makes later imports exact. The unmatched panel batches the proposals.
- **[Inflection list is German-centric]** English plurals are covered by `s`/`es`. Irregular plurals (Nuss/Nüsse) aren't, and stay partial. → Acceptable: they cost a resolve step, never a wrong food.
- **[Hyphenated brand/product names]** "Coca-Cola" as a query against a catalog entry "Coca" would be partial. → Harmless, since a partial hit is never worse than today's unmatched.

## Migration Plan

Code-only. No data or API breaks: `matchConfidence` is optional and additive. Saved recipes are unaffected. Earlier imports matched to a wrong food (e.g. Honigmelone) stay as they were saved. The spoon change's saved-recipe audit won't catch these, because the amounts look normal. The user would spot them by the wrong food name in the recipe.
