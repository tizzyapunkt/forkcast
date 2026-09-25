## 1. Spike: Bring! parsing (before any code)

- [ ] 1.1 Serve a static microdata page (per design.md) with ~10 representative lines ("380 g Zwiebel", "800 g Hähnchenbrust", "6 Stück Ei", "5 g Salz", "1200 ml Milch", "3 Zwiebeln") over the tunnel, open the deeplink on the phone, and record how each line lands in Bring! (item, icon, spec)
- [ ] 1.2 Record from the tunnel logs when Bring! fetches the page (on deeplink resolve, on app open, or both) to confirm the 1 h token lifetime is enough
- [ ] 1.3 If lines parse badly or pieces work better, update the line format in `specs/bring-import/spec.md` and `design.md` before continuing; note the outcome in design.md

## 2. Import token (domain)

- [x] 2.1 Write failing tests for `mintImportToken` / `verifyImportToken` in `backend/src/domain/shopping/`: roundtrips `startDate` and `excluded`; rejects expired, tampered, wrong-audience and session tokens; a session token does not verify as an import token and an import token does not pass `verifySession`; implement until green

## 3. Import page (backend)

- [x] 3.1 Write failing tests for the page renderer: Recipe microdata with `itemscope`/`itemtype`, name with the week range, `yield` 1, one `ingredients` line per item in order, German unit labels, HTML escaping of names, empty list renders no lines; implement until green
- [x] 3.2 Write failing handler tests for `GET /bring-import/:token`: `200` HTML without a session, excluded identities left out (case-insensitive), `Cache-Control: no-store` and `X-Robots-Tag: noindex`, `401` for expired/tampered/malformed tokens with no list content; implement until green
- [x] 3.3 Write failing handler tests for `POST /bring-import-token`: `200` with a token, `400` for malformed `startDate`/`excluded`; implement until green
- [x] 3.4 Register `GET /bring-import/:token` **before** and `POST /bring-import-token` **after** the auth middleware in `backend/src/index.ts`; add an auth-middleware test that an import token used as a session cookie yields `401`
- [x] 3.5 Smoke-test via the dev proxy: mint a token with a session, fetch `/api/bring-import/{token}` without one, and check the HTML

## 4. Frontend

- [x] 4.1 Add `api/bring-import-token.ts`, an MSW handler, and German copy ("An Bring! senden", error text); verify typecheck
- [x] 4.2 Write failing sheet tests: the button mints with the sheet's `startDate` and the unticked identities, then navigates to the deeplink with the encoded `{origin}/api/bring-import/{token}`, `source=web` and both quantities 1; pending state while minting; error and no navigation on failure; disabled with nothing checked; implement until green (navigation behind a small injectable `openUrl` so tests don't navigate)

## 5. Verification

- [x] 5.1 Run backend and frontend test, lint, typecheck and format per the forkcast-dev skill; all green
- [ ] 5.2 End-to-end on the phone through the tunnel: plan next week, open Einkaufsliste, untick one item, send to Bring!, confirm the import screen lists the rest with sensible items and quantities, untick one more in Bring!, add, and check the Bring! list
