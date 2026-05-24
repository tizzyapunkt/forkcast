## Context

The Recent tab in the log drawer surfaces a flat list of previously logged full ingredients with their macros and last-used timestamp. Selecting one transitions to the existing `FullEntryConfirm` step where the user types the amount and submits. In practice the same ingredient is consumed in a recurring portion (oats 80 g, milk 250 ml, eggs 2 pieces), so the amount input is almost always re-typed identically.

The recents projection is computed on every `GET /recently-used-ingredients` from `LogEntry[]`. Each collapsed identity already retains a reference to the most recent matching entry — its `amount` is in scope but currently discarded. There is no caching layer or stored projection, so adding a field has zero migration cost.

## Goals / Non-Goals

**Goals:**
- Surface the most recently used amount per recent ingredient.
- Pre-fill the confirm step's amount input when the user enters it via the Recent tab.
- Keep the change additive on the API (no breaking shape changes).
- Preserve the existing flow for Search and Barcode entries (amount stays empty).

**Non-Goals:**
- Statistical defaults (median/mode amount). The most recent amount is the simplest signal; richer heuristics can come later if needed.
- Skipping the confirm step entirely. Re-logging still requires explicit user confirmation — only the amount is pre-filled.
- Pre-filling amounts for recipe re-logs, quick entries, or barcode scans.
- Persisting `lastAmount` separately; it remains a derived field.

## Decisions

### Carry `lastAmount` from the latest collapsed entry, not from a statistical aggregate

The latest entry already wins for macros and `lastUsedAt`. Carrying its `amount` keeps the projection logic uniform: a single "most-recent-entry-wins" rule decides every field on a recent ingredient. Alternatives considered:

- **Mode (most common amount)** — would feel smarter when amounts oscillate, but requires scanning all entries per identity and choosing a tiebreaker. Overkill for a personal-use app and inconsistent with how macros are already chosen.
- **Median amount** — similar trade-offs; harder to explain ("why did it pick 75 when I keep logging 80?").

"Latest amount wins" is predictable and matches what the user just did, which is usually what they want next.

### Pre-fill in the confirm step, not auto-submit

A one-tap re-log would skip the confirm step entirely when `lastAmount` is present. Rejected for two reasons:

- The confirm screen also shows the macros for the chosen amount — it is a useful sanity check before persisting.
- Skipping confirm would diverge the Recent flow from the Search and Barcode flows; the user would have to remember which tab auto-submits and which does not. Keeping the confirm step uniform across tabs preserves a single mental model and still cuts the interaction down to one tap (`Log`).

### Source-aware pre-fill

`FullEntryConfirm` should remain agnostic about which tab opened it. The drawer threads an optional `defaultAmount` prop when invoking confirm from the Recent path; Search and Barcode paths omit it. This keeps the confirm component pure and avoids leaking `IngredientSearchResult.source` checks into its body.

### Field shape: `lastAmount: number`

Make the field a required `number` on `RecentlyUsedIngredient` rather than optional. Every recent ingredient is derived from at least one full entry, and full entries always have an `amount`, so there is no case where `lastAmount` would be missing. A required field avoids defensive `?? 0` handling in callers.

## Risks / Trade-offs

- **Stale-amount risk** → Mitigation: the value reflects the user's most recent log; if the user's portion changes, the next log updates the suggestion. Worst case the user overwrites the input — same number of keystrokes as today, never worse.
- **Frontend type drift between `backend/.../types.ts` and `frontend/src/domain/meal-log.ts`** → Mitigation: both files are kept in sync manually today; add `lastAmount` to both in the same change and cover with the existing recent-panel and use-case tests.
- **Unit semantics for non-mass amounts (e.g. `piece`)** → No new risk: `amount` already supports decimal pieces today, and the confirm form already accepts any positive number.
