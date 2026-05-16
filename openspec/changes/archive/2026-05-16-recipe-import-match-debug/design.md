## Context

The AI recipe import pipeline has three steps with three possible failure modes for ingredient matching:

1. **Extraction** — the vision LLM returns a `RawIngredient` with a name string. The name can be misread from the photo or translated/normalized in unexpected ways.
2. **Search** — `IngredientSearchService.searchByName(name, {'FOODS'})` returns ranked candidates. The top-1 candidate may not be the best match (e.g., partial-token hits, typos, or near-duplicate FOODS entries).
3. **Match resolution** — the use case applies override rules (catalog unit wins, piece-quantity drop, `untracked` inheritance) on top of the top-1 candidate.

Today the API only returns the *post-match* draft. From the review screen there's no way to tell which step is responsible when a row looks wrong. The user has confirmed (anecdotally) that mismatches happen, but cannot reproduce/diagnose without code-level instrumentation.

Stakeholders: solo developer/user (efcholic@gmail.com). No other consumers of the API.

## Goals / Non-Goals

**Goals:**
- Make the three failure modes above directly inspectable from the review screen during an import.
- Keep the debug surface entirely opt-in so it adds zero overhead and zero payload when disabled.
- Avoid persistence: debug data is transient and lives only in the import response.
- Reuse existing matching code; the debug payload is a passive observer, not a second code path.

**Non-Goals:**
- No persisted import logs, no audit history, no analytics.
- No "fix the matcher" work in this change — the goal is observation, not correction. Improvements to ranking/scoring are follow-up changes informed by what we learn.
- No new authn/authz; this is a single-user app.
- No UI for editing/replaying against the debug payload — the existing unmatched-resolution UI already covers manual correction.

## Decisions

### 1. Opt-in via env var (`RECIPE_IMPORT_DEBUG`)

The backend reads `RECIPE_IMPORT_DEBUG` at startup. When truthy, the handler passes `includeDebug: true` to the use case; otherwise the use case behaves exactly as today and the response omits the field.

**Why env over per-request flag:** the only consumer is the local dev instance. An env var is the simplest switch, fits the existing config pattern (`ANTHROPIC_API_KEY`, `RECIPE_IMPORT_MAX_IMAGES`), and removes any risk of clients accidentally enabling it in a deployed environment.

**Alternative considered:** a `?debug=1` query param or `X-Debug: 1` header. Rejected: more surface area, more validation, and no actual benefit for a single-user setup. If a deployed multi-user version emerges later, switching to a header is trivial.

### 2. Debug payload shape

Add `debug?: RecipeDraftDebug` to `RecipeDraft`:

```ts
interface RecipeDraftDebug {
  ingredients: IngredientMatchDebug[];
}

interface IngredientMatchDebug {
  /** Verbatim from the LLM, before any matching. */
  raw: RawIngredient;
  /** Top N candidates from IngredientSearchService.searchByName, in rank order. */
  candidates: SearchCandidateDebug[];
  /** The candidate picked as the match, or null if unmatched. */
  chosen: SearchCandidateDebug | null;
  /** Post-match flags that fired on this row. */
  flags: {
    unitOverridden: boolean;
    pieceQuantityDropped: boolean;
    untrackedInherited: boolean;
  };
}

interface SearchCandidateDebug {
  name: string;
  source: 'FOODS' | 'OFF';
  unit: MeasurementUnit;
  untracked: boolean;
}
```

**Why include all three layers (raw / candidates / chosen):**
- Without `raw`, we can't tell if the LLM misread the photo.
- Without `candidates`, we can't tell if a better match existed but was outranked.
- Without `chosen`+`flags`, we can't tell why the chosen row looks different from the candidate (unit override, piece drop, etc).

**Why top-N candidates only (not full result set):** the search service can return long lists; top 5 is enough to see whether the right answer existed in the neighborhood. Hard-cap at 5 in the use case.

**Why no scores:** `IngredientSearchService.searchByName` doesn't expose a score today. Adding one is out of scope — rank order is the only signal it currently provides, and rank is what we surface. If we later need scores, that's a separate change against the search service.

### 3. Wire the debug flag through the use case, not in HTTP land

The matching loop lives in `import-recipe-from-photos.use-case.ts`. The handler reads the env, but assembling the debug structure happens inside the use case where we already have raw/candidates/chosen in scope. This keeps the HTTP layer thin and matches the project's hexagonal split (domain owns business logic; HTTP only adapts).

**Alternative considered:** run the search a second time in the handler. Rejected: doubles the cost, risks divergence if matching logic changes.

### 4. Frontend: collapsible "Debug" box at the bottom of the review screen

Render the debug box inside `review-import-screen.tsx`, below the recipe form, only when `draft.debug` is present. Default collapsed; expanding shows a per-ingredient block:

```
> [+] tomato paste (raw)
       chosen: Tomatenmark (FOODS, g)   [unitOverridden]
       candidates:
         1. Tomatenmark (FOODS, g)
         2. Tomaten (FOODS, g)
         3. Tomate, getrocknet (FOODS, g)
```

**Why collapsible:** the box is a developer tool, not a primary review surface. Keep the review experience clean.

**Why bottom of screen:** avoids reflowing the existing review form layout; the user only scrolls to it when investigating.

**No i18n:** debug labels stay in English. This is dev-only; localizing it adds noise.

### 5. No tests for the box's visual layout; integration test on the wiring

Backend: unit-test that the use case populates `debug` only when `includeDebug: true`, with the expected raw/candidates/chosen/flags for a matched, unmatched, unit-overridden, and untracked row.

Frontend: one test that the debug box renders when `draft.debug` is present, and does not render when absent. Don't pin the exact DOM layout (it'll churn as the dev tool evolves).

## Risks / Trade-offs

- **[Risk] Debug payload accidentally enabled in a future deployed env** → Mitigation: env var defaults to off; document in `backend/.env.example` (if/when one exists) that this is dev-only. Single-user app today means low blast radius.
- **[Risk] Payload size for long recipes** → Mitigation: top-5 candidate cap; debug off by default. A 30-ingredient recipe at 5 candidates each is still tiny JSON.
- **[Trade-off] No score surface** → Accept: rank is enough signal for diagnosing the cases the user has seen. Revisit if a pattern emerges where rank-1 looks fine but is wrong for non-obvious reasons.
- **[Trade-off] English-only debug UI** → Accept: this is a developer tool; localizing it is gold-plating.

## Migration Plan

No data migration. No API break (new field is additive and optional). Deploy is:

1. Merge backend changes; existing clients continue to work because they ignore unknown fields.
2. Merge frontend changes; the debug box renders only when `debug` is present, so it stays hidden until the env var is set.
3. Set `RECIPE_IMPORT_DEBUG=1` locally to investigate; unset to turn it off.

Rollback: revert the merges, or simply unset the env var — the field becomes absent and the box disappears.

## Open Questions

- None currently. The shape above covers the three failure modes the user has called out.
