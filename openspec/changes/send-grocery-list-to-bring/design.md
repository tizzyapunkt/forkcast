## Context

`plan-grocery-list` provides `buildGroceryList(startDate)` in `domain/shopping` and the Einkaufsliste
sheet, whose tick state is a set of unticked identity keys. forkcast is reached through an open
Cloudflare tunnel. nginx strips `/api` and proxies to the backend (Vite does the same in dev), so the
public path `/api/bring-import/{token}` reaches the backend route `/bring-import/{token}`. The auth
middleware is registered after `/auth/*`, so routes registered before it are public. Sessions are HS256
JWTs (`jose`) signed with `AUTH_JWT_SECRET`, and `verifySession` checks only the signature and expiry.

Per Bring!'s guide, the deeplink endpoint fetches `url` server-side and parses schema.org Recipe
microdata (`itemprop="ingredients"`) into its own catalog items. The in-app import screen lets the user
untick items.

## Goals / Non-Goals

**Goals:**
- One tap from the sheet to Bring!'s import screen, carrying exactly the items the user left checked.
- A public surface limited to one read-only page, usable for at most an hour per link.

**Non-Goals:**
- Bring!'s unofficial REST API, logins or list selection. The import screen picks the list.
- The widget script, JSON import format, recipe images or nutrition in the microdata.
- Tracking what was already sent.

## Decisions

### Import token: JWT signed with a derived key

`mintImportToken({ startDate, excluded }, secret)` signs `{ startDate, excluded }` with `aud: "bring-import"`
and a 1 h expiry, using the key `HMAC-SHA256(AUTH_JWT_SECRET, "bring-import")`, **not** the session key.
Because `verifySession` doesn't check `aud` or `sub`, a token signed with the session key would work as a
session. The derived key rules that out without touching session verification. `verifyImportToken` checks
key, audience and expiry. Both are pure functions in `domain/shopping`. The secret comes from existing
config, so there's no new env var.

*Alternatives:* a random id stored server-side (needs a store and expiry sweeping); tightening
`verifySession` to require `sub: "owner"` (worth doing, but it would be the only safeguard, and it
changes auth behaviour in this change's blast radius).

The token sits in the path, not the query, so the URL stays clean for Bring!'s fetcher. Its size grows
with `excluded`. Typically a handful of keys, so it stays far below URL limits.

### Page computed at fetch time

The page calls `buildGroceryList(startDate)` when Bring! fetches it and removes excluded identities.
No snapshot is stored. Minting and fetching happen seconds apart, and a fresh list is never staler
than a snapshot.

### Microdata rendering

A small string template, with every text value HTML-escaped:

```html
<!doctype html><html lang="de"><head><meta charset="utf-8"><title>…</title></head><body>
<div itemscope itemtype="http://schema.org/Recipe">
  <h1 itemprop="name">forkcast Einkaufsliste 28.9.–4.10.</h1>
  <span itemprop="yield">1</span>
  <ul><li itemprop="ingredients">380 g Zwiebel</li>…</ul>
</div></body></html>
```

Lines use `{amount} {unit} {name}`: German recipe order, which Bring!'s German parser is most likely
to handle. The unit label mapping (`piece → Stück`, `tbsp → EL`, `tsp → TL`, `cup → Tasse`) lives in the
page renderer, the only backend place that writes German. `baseQuantity = requestedQuantity = 1` and
`yield = 1` keep Bring!'s scaling at ×1.

The spike (task 1) may change the line format, e.g. sending "3 Zwiebeln" using the piece hint. If so,
the spec's line format is updated before implementation continues.

### Page URL from the browser's origin

The frontend builds `${location.origin}/api/bring-import/${token}`. The app is used through the tunnel
domain, so that origin is public. No `PUBLIC_BASE_URL` setting is needed.

### Opening the deeplink

The frontend sets `window.location.href` to the GET deeplink. Bring!'s endpoint redirects to its
OneLink, which opens the app, or the store/web fallback when the app isn't installed. This happens
after an `await` (the mint), so `window.open` would be popup-blocked; a same-tab navigation is not.
The PWA reloads on return, and the sheet's ephemeral state being lost is acceptable.

## Risks / Trade-offs

- **Bring!'s parser mis-reads lines** → the spike verifies against real items before implementation. The
  JSON format (`itemId` + `spec`) is the documented fallback.
- **Opened via LAN address instead of the tunnel** → Bring! can't reach the page and its import shows an
  error. Accept for now; the app is normally used through the tunnel.
- **Public page reveals the week's shopping list to anyone holding the link for an hour** → low
  sensitivity. The token is unguessable, and there's `no-store` and `noindex`.
- **Bring! fetches after expiry** (e.g. the app resolves the link later) → spike measures when the
  fetch happens. Raise the lifetime if needed.

## Migration Plan

No data changes. Rollback removes the two routes and the button.
