# forkcast-ui /design-sync notes

## Setup gotchas

- **`frontend/package.json` needed `types`/`module` fields** pointing at `dist-ui/` (`types: dist-ui/types/components/ui/index.d.ts`, `module: dist-ui/forkcast-ui.js`). Without `types`, the converter's `.d.ts` reader falls back to a nonexistent `frontend/index.d.ts` and reports `[ZERO_MATCH]` — these fields are load-bearing for design-sync even though nothing else in the repo reads them (nothing publishes this package).
- **`frontend/tailwind.config.lib.ts` content scan was extended** to include `../.design-sync/previews/**/*.tsx` alongside `src/components/ui/**/*.tsx`. Originally it scanned only the primitives themselves — any Tailwind utility used *only* in an authored preview (layout glue: `justify-between`, `w-64`/`w-32`/etc., `gap-3`, `divide-y`, `h-12`, `py-0`, `font-semibold`, `flex-wrap`) silently compiled to nothing, so previews rendered squished/collapsed with zero error. Caught by comparing `grep` hits in `dist-ui/forkcast-ui.css` against classes used in preview `.tsx` files — not caught by validate's render check (root wasn't empty, just visually wrong).
- Rebuild sequence when the DS source changes: `pnpm --filter @forkcast/frontend build:ui` (produces `dist-ui/`, gitignored) **then** the design-sync converter. Running the converter against a stale `dist-ui/` silently under-reports utility coverage.
- No provider wrapper needed — none of the 6 primitives (`Button`, `Card`, `Field`, `Input`, `DecimalInput`, `SegmentedControl`) read React context.
- No custom fonts — the DS uses the system font stack (`ui-sans-serif, system-ui, ...`), so no `[FONT_MISSING]` risk.
- `Button`'s `Variants` story needed `cfg.overrides.Button: {"cardMode": "column"}` — 5 variants side-by-side overflowed the product card grid cell.

## Known render warns

None outstanding — render check and grading are both clean (6/6 components, 0 bad, 0 thin).

## Re-sync risks

- If `tailwind.config.lib.ts`'s content array is ever narrowed back to just `src/components/ui/**`, every preview using a layout-only utility class (not used by a component itself) goes back to silently rendering broken — re-diff `dist-ui/forkcast-ui.css` class coverage against `.design-sync/previews/*.tsx` after any Tailwind config change in this repo.
- `frontend/package.json`'s `types`/`module` fields are sync-only plumbing — don't remove them as "unused."
- Preview copy uses real German strings pulled from `frontend/src/i18n/de.ts` (e.g. "Speichern", "Endgültig löschen", "Gewicht (kg)") — if those strings change, previews drift cosmetically but won't break; not worth chasing on every wording tweak.
- Only 6 components exist today (small, hand-built primitive set) — re-syncs should stay fast; if `components/ui/index.ts`'s barrel grows, new exports need the same author+grade treatment as this first import.
