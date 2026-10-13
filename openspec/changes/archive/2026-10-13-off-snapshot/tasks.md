# Tasks

## 1. Build the snapshot

- [x] 1.1 Add `ignorePatterns: ['frontend/src/demo/off-snapshot.json']` to the root `vite.config.ts` `fmt` block. Verify that `make fmt-check` ignores a deliberately unformatted JSON at that path; if the key is not honoured, switch to the fallback location in design Decision 4 and record it in design.md
- [x] 1.2 Write `scripts/demo/build-off-snapshot.mts` (Decision 2): per country, paged and paced, then filtered (calories, and a name `mapOffProduct` accepts), deduped by code and sorted by scans. It writes the `{ source, license, builtAt, countries, products }` file with a header comment documenting usage and env. Run it and verify:
  - all three countries contribute;
  - every product has `energy-kcal_100g`;
  - no duplicate codes;
  - the printed size is about 1–1.5 MB.

  Commit the generated `frontend/src/demo/off-snapshot.json`.

## 2. Search the snapshot in the demo

- [x] 2.1 Write `src/demo/snapshot-off-search.test.ts` first, against a small in-memory snapshot:
  - `peanut butter` finds the peanut butters and not unrelated products;
  - an exact name match ranks above a substring match;
  - equal matches keep snapshot (popularity) order;
  - `locale` `de` names a product with a German name in German, and `en` in English;
  - a brand-only match is found;
  - results are capped at 20 and labelled `OFF`;
  - a query under two characters returns nothing;
  - `load` runs once across searches;
  - `searchByBarcode` delegates to the barcode service.

  Then implement `SnapshotOffSearch` (Decision 3) until they pass.
- [x] 2.2 Change `buildDemoApp` to take the OFF service. `startDemo` passes `SnapshotOffSearch` with the lazy `import('./off-snapshot.json')` and the live `OpenFoodFactsService(demoOffFetch)` for barcodes. Update `seed-demo-week.test.ts` and `start-demo.test.ts` to pass an in-memory service. Add a `start-demo` test: with the OFF source on, a name search returns snapshot results and makes no network request (the stubbed `fetch` is never called for OFF). Verify `make test-frontend` passes
- [x] 2.3 Verify the demo build puts the snapshot in its own chunk, not in `demo-entry`, and that the normal `vp build` contains no snapshot (grep `dist/assets` for a known snapshot product code)

## 3. Attribution and privacy

- [x] 3.1 Add the intro attribution line (Decision 5) to `de.ts` and `en.ts`, rendered in `DemoIntro` with links to openfoodfacts.org and the ODbL. Extend `demo-intro.test.tsx` to assert the attribution and both links. Verify the i18n key-parity tests pass
- [x] 3.2 Update the demo section of `website/privacy/index.html` and `website/de/datenschutz/index.html`: name searches stay in the browser, and only barcode lookups go to Open Food Facts. Verify `make website-build` passes and both pages show the new wording
- [x] 3.3 Document the snapshot in `AGENTS.md` (Website, Demo bullet: where it comes from and how to refresh it) and the `forkcast-dev` skill (the rebuild command). Verify the documented command matches the script's header

## 4. Integration check

- [x] 4.1 Build the site with the demo and walk it in Chrome in EN and DE:
  - with OFF on, `peanut butter` / `Erdnussbutter` show packaged products after the catalog results, labelled Open Food Facts, with locale names;
  - the network panel shows the snapshot chunk loading once and no request to `search.openfoodfacts.org`;
  - barcode lookup still works live;
  - the intro shows the attribution.
- [x] 4.2 Run `make check` and verify it passes

## Workflow follow-up

- The user re-tests OFF search on a phone after the deploy.
- Archive after review; archiving syncs the `demo-mode` delta.
