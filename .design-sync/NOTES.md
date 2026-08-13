# forkcast-ui /design-sync notes

## Setup gotchas

- **`frontend/package.json` needed `types`/`module` fields** pointing at `dist-ui/` (`types: dist-ui/types/components/ui/index.d.ts`, `module: dist-ui/forkcast-ui.js`). Without `types`, the converter's `.d.ts` reader falls back to a nonexistent `frontend/index.d.ts` and reports `[ZERO_MATCH]` — these fields are load-bearing for design-sync even though nothing else in the repo reads them (nothing publishes this package).
- **`frontend/tailwind.config.lib.ts` content scan was extended** to include `../.design-sync/previews/**/*.tsx` alongside `src/components/ui/**/*.tsx`. Originally it scanned only the primitives themselves — any Tailwind utility used *only* in an authored preview (layout glue: `justify-between`, `w-64`/`w-32`/etc., `gap-3`, `divide-y`, `h-12`, `py-0`, `font-semibold`, `flex-wrap`) silently compiled to nothing, so previews rendered squished/collapsed with zero error. Caught by comparing `grep` hits in `dist-ui/forkcast-ui.css` against classes used in preview `.tsx` files — not caught by validate's render check (root wasn't empty, just visually wrong).
- Rebuild sequence when the DS source changes: `pnpm --filter @forkcast/frontend build:ui` (produces `dist-ui/`, gitignored) **then** the design-sync converter. Running the converter against a stale `dist-ui/` silently under-reports utility coverage.
- No provider wrapper needed — none of the 8 primitives (`Button`, `Card`, `Field`, `Input`, `DecimalInput`, `Select`, `SegmentedControl`, `Banner`) needs one. `Input` and `Select` read the `Field` context but tolerate its absence, so they render standalone.
- No custom fonts — the DS uses the system font stack (`ui-sans-serif, system-ui, ...`), so no `[FONT_MISSING]` risk.
- `Button`'s `Variants` story needed `cfg.overrides.Button: {"cardMode": "column"}` — 5 variants side-by-side overflowed the product card grid cell.
- **The `scrim` Button variant only reads correctly over imagery.** Its first preview put the buttons on a flat `bg-black` plate and the result was an unreadable grey-on-grey block; the cell was regraded only after the plate became a photo-stand-in gradient (`linear-gradient(135deg, #8a9a6b, #4a5a3a, #2b2f22)` at 104×104). Keep a photo surrogate in any future scrim story.
- Previews import no icon library — icon children are inline 16px SVG paths via a local `Icon` helper in `previews/Button.tsx`. Keeps preview compilation independent of `lucide-react` resolution.

## Known render warns

None outstanding — render check and grading are both clean (8/8 components, 0 bad, 0 thin, 0 variantsIdentical).

## Re-sync risks

- If `tailwind.config.lib.ts`'s content array is ever narrowed back to just `src/components/ui/**`, every preview using a layout-only utility class (not used by a component itself) goes back to silently rendering broken — re-diff `dist-ui/forkcast-ui.css` class coverage against `.design-sync/previews/*.tsx` after any Tailwind config change in this repo.
- `frontend/package.json`'s `types`/`module` fields are sync-only plumbing — don't remove them as "unused."
- Preview copy uses real German strings pulled from `frontend/src/i18n/de.ts` (e.g. "Speichern", "Endgültig löschen", "Gewicht (kg)") — if those strings change, previews drift cosmetically but won't break; not worth chasing on every wording tweak.
- 8 components today (small, hand-built primitive set) — re-syncs stay fast; if `components/ui/index.ts`'s barrel grows, new exports need the same author+grade treatment. The 2026-08-13 re-sync added `Banner` and `Select` this way: driver reported them as `added`, previews authored, graded, uploaded.
- **`text-warning-ink` is NOT compiled into the shipped CSS** even though the token exists — no `components/ui/` component uses it (`Banner`'s warning tone deliberately uses `text-foreground` for body copy; `text-warning-ink` is only used in app-level code outside the packaged DS). `conventions.md` says so explicitly; re-check that claim if `Banner` ever changes its warning text color.
- `conventions.md`'s radius paragraph asserts `rounded-sm`/`rounded-xl`/`rounded-full` are absent from this bundle. That is true only while no packaged primitive uses them — the app itself does use all three (chips, sheets, dots) outside `components/ui/`. Re-grep the compiled CSS after any primitive gains a pill or overlay shape.
