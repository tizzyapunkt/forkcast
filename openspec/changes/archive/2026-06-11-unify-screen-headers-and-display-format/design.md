# Design: unify-screen-headers-and-display-format

## Context

Handoff 2 (`design_handoff_forkcast_2/`) introduces one app-wide header rule (the indigo header
names where you are; `SimpleHeader({ title, subtitle, onBack, right })` in the reference) and one
macro-triplet format (`38 P · 67 KH · 11 F`). The shipped app still has: wordmark-only headers with
duplicate body headings on Rezepte / Einstellungen / Recipe Detail / Recipe Editor, a purple
in-content back arrow on Detail/Editor (pinned by the current `recipes` back-nav requirement), the
Wochenplan title + rollups in a body card, and three competing macro formats (`40 P / 0 C / 26 F`,
`8g P · 35g K · 4g F`, `8g Eiweiß · 35g KH · 4g Fett`) — some of them pinned verbatim by
`meal-log-display`, `recipes`, and `nutrient-display-format` requirements and their tests.

Decisions already made with the user (2026-06-11): traffic-light status coloring of header values
stays; the detail strip's `Bei {N} Portionen` line is removed; purely visual re-compositions are
tracked in `ui-polish-backlog.md` and are NOT part of this change.

## Goals / Non-Goals

**Goals:**

- One shared header component used by every screen; title (or wordmark) in the header; sub-screens
  get a white in-header back arrow + entity title + optional subtitle.
- One shared macro-triplet formatter; every spec'd format string updated to
  `{P} P · {KH} KH · {F} F`.
- Recipe detail nutrition strip reduced to the single per-serving line.

**Non-Goals:**

- No change to status/tone coloring (`nutrition-progress` stays as-is).
- No change to kcal-rate strings (`372 kcal / 100g` keeps the slash).
- No change to navigation structure, bottom-nav hiding, or sheet sub-step behavior (already spec'd).
- No backend/API/domain changes.
- Visual polish items from `ui-polish-backlog.md` (button shapes, icon tiles, hero dots, etc.).

## Decisions

1. **New `screen-headers` capability instead of stuffing the header rule into each screen's
   capability.** The rule is cross-cutting (4 tabs + 2 sub-screens today, more later); a single
   capability states it once. The `recipes` back-nav requirement is MODIFIED to point at the
   in-header placement and defers the shape to `screen-headers`. Alternative considered: MODIFY
   `bottom-navigation` (which mentions the Log header) — rejected, it owns the nav bar, not headers.

2. **Shared `AppHeader` component (frontend `src/components/` or a `features/app-shell/` folder)**
   with props mirroring the reference `SimpleHeader`: `title`, `subtitle?`, `onBack?`, `right?`,
   `children?` (for the diary/planner stepper + totals blocks). Existing screens migrate to it;
   the diary's existing header content becomes `children`. Alternative: per-screen headers sharing
   only CSS — rejected, the drift this change fixes came exactly from that.

3. **Single macro-format helper** (e.g. `formatMacroTriplet(p, c, f)` in the i18n/format layer)
   used by entry rows, slot summaries, recipes list/detail/editor, and the confirm step. The
   triplet convention (middots, `KH`, integer, no `g` suffix) lives in one function so the spec
   strings can't drift again. Existing `de.*` i18n entries for these strings are updated, not
   duplicated.

4. **`Bei {N} Portionen` removal is spec'd as REMOVED + ADDED** (old "reactive to multiplier"
   requirement removed; new "per-serving nutrition totals" requirement added) rather than MODIFIED,
   because the requirement's name and core semantics (reactivity) change, and archive-time matching
   on a renamed-and-rewritten requirement is fragile.

5. **Planner header placement.** The `weekly-meal-plan` spec already says "the planner header SHALL
   display week-level rollups"; the implementation satisfies it in a body card. Moving the title,
   week stepper, and rollups into the indigo header is covered by the new `screen-headers`
   Wochenplan scenario — no `weekly-meal-plan` delta needed (its requirement text stays true).

## Risks / Trade-offs

- [Many existing tests assert the old strings (`g P`, `g K`, `/`-separated, body headings)] →
  TDD task order updates tests first per requirement, then the implementation; the shared formatter
  makes most updates mechanical.
- [Removing the `Bei {N} Portionen` line loses the at-a-glance scaled total] → accepted by user
  decision (2026-06-11); the multiplier still scales ingredient rows, which is the cooking use case.
- [Header refactor touches every screen at once] → migrate screen-by-screen behind the shared
  component; each screen's migration is an independent task with its own test updates.
- [`screen-headers` overlaps conceptually with `bottom-navigation`'s header mention] → the
  bottom-navigation requirement only forbids a settings gear in the header; no contradiction.

## Migration Plan

Frontend-only, single deploy; no data or API migration. Revert = revert the commit.

## Open Questions

None — the open decisions (status colors, Bei-N line, scope split) were resolved with the user on
2026-06-11.
