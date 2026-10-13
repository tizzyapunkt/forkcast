# Proposal

## Why

The demo's Open Food Facts name search does not work. Search-a-licious sends no CORS headers, so browsers block every name search. A phone test on the deployed demo confirmed it, as the probe in `browser-demo` predicted. With the OFF source on, demo visitors only see catalog results, so one of forkcast's selling points (packaged products next to generic foods) is missing from the demo. Barcode lookup works, because that endpoint allows any origin. OFF's older CORS-enabled search (`cgi/search.pl`) answered with "temporarily unavailable" and then poor results within seconds, so it is not an option.

## What Changes

- **A bundled OFF snapshot for the demo.** It holds the most-scanned products sold in Germany, the United Kingdom and the United States: the top 2,000 per country by OFF's scan count, minus products without calories, and deduplicated. That is about 5,000–6,000 products. Each product keeps only the fields the app maps: names (generic, German, English), brand, nutrition per 100 g, and serving size.
- **A script builds it.** `scripts/demo/build-off-snapshot.mts` pages through search-a-licious server-side (sorted by scan count, filtered by country) and writes one JSON file, committed to the repo. Deploys never depend on OFF. Rerunning the script refreshes the data. The file records its source, its licence (ODbL) and when it was built.
- **Name search in the demo uses the snapshot.**
  - With the OFF source on, the demo searches the snapshot instead of calling OFF. Names and brand are matched the way the catalog matches, ranked by match quality and then popularity.
  - Results are named per locale exactly like live OFF results, and keep the "Open Food Facts" label.
  - The snapshot loads the first time an OFF search runs, not with the demo.
- **Barcode lookup stays live.** It still goes from the browser to OFF.
- **Attribution.** The demo intro credits Open Food Facts and the ODbL licence for the product data.
- **The privacy policy (EN and DE) is corrected.** Name searches in the demo stay in the browser; only barcode lookups go to Open Food Facts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `demo-mode`:
  - Open Food Facts name search runs against a bundled snapshot, while barcode lookup stays live.
  - The first-visit disclaimer credits the snapshot's source.
  - The privacy-policy requirement now names only barcode lookups as going to Open Food Facts.

## Impact

- **Scripts:** a new `scripts/demo/build-off-snapshot.mts`. It needs network access, takes about a minute with pacing, and doesn't run in CI.
- **Frontend demo** (`frontend/src/demo/`):
  - the committed `off-snapshot.json` (about 1.3 MB raw, about 300 KB gzipped, in its own lazily loaded chunk);
  - a snapshot-backed OFF search adapter, wired in `buildDemoApp`;
  - an intro attribution line in `de.ts` and `en.ts`.
- **Backend:** none at runtime. The adapter reuses the domain's `mapOffProduct`, `fold` and `matchFoodEntry`, which are already browser-safe.
- **Website:** privacy policy pages in EN and DE.
- **Repo size:** about 1.3 MB per snapshot refresh in git history. Refreshes stay rare.
