## Why

The Einkaufsliste (from `plan-grocery-list`) ends in a clipboard copy, but the actual shopping happens in
Bring!, shared with my partner. Getting the week's list there should be one tap. Anything left over
stays in Bring! for a second trip.

## What Changes

- New action **An Bring! senden** in the Einkaufsliste sheet. It opens Bring!'s import deeplink
  `https://api.getbring.com/rest/bringrecipes/deeplink?url={pageUrl}&source=web` for the week being viewed.
  Bring!'s servers fetch `pageUrl`, and the Bring! app opens its import screen, where items can still be
  unticked before they're added. No widget script, API key or partner registration is needed (per the
  [integration guide](https://sites.google.com/getbring.com/bring-import-dev-guide)).
- New **public import page**, reachable without logging in: an HTML page with schema.org Recipe
  **microdata** (`name`, `yield`, one `ingredients` line per item such as "380 g Zwiebel") that Bring!'s
  parser maps onto its own catalog items. It contains the week's grocery list **minus the items unticked
  in the forkcast sheet**, computed fresh when Bring! fetches it.
- The page URL carries a **signed import token** in its path: scoped to one week and the unticked items,
  valid for one hour, signed so it can never pass as a login session. It's minted by an authenticated
  call right before the deeplink opens. Every other route stays behind the existing single-user auth.
- The page URL is built from the origin the app is opened on (the public tunnel domain), so no new
  configuration is needed. The tunnel is open, so no Cloudflare Access exemption is needed either.

## Capabilities

### New Capabilities

- `bring-import`: import-token minting, the public microdata import page, and the "An Bring! senden"
  action in the Einkaufsliste sheet.

### Modified Capabilities

- `single-user-auth`: "Protected API routes require valid session" gains one exception, the import page,
  which is authorised by an import token instead of a session.

## Impact

- **Backend**: `domain/shopping` gains the import-token rules (mint/verify, key derived from
  `AUTH_JWT_SECRET`) and the list line formatting. `http/shopping` gains `POST /bring-import-token`
  (authenticated) and `GET /bring-import/{token}` (public, registered before the auth middleware).
- **Frontend**: a button in `grocery-list-sheet.tsx` that mints the token with the week and unticked
  items and opens the deeplink.
- **Depends on** `plan-grocery-list`.
