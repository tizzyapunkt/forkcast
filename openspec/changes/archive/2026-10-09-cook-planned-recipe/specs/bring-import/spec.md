# Spec Delta

## MODIFIED Requirements

### Requirement: Mint a week-scoped import token

The system SHALL expose an authenticated command `POST /bring-import-token` with body
`{ startDate, excluded, portions }`. `startDate` is an ISO date, `excluded` is a list of grocery item
identities (case-insensitive name plus unit) the user ticked off as already at home, and `portions` is an
optional map of recipe id to a positive number, the portions per recipe chosen in the sheet. It returns
`{ token }`. The token MUST:

- encode `startDate`, `excluded` and `portions`
- expire **one hour** after minting
- be signed so that the import page can detect tampering
- **never be accepted as a session**: sending it as the session cookie to any protected route MUST yield `401`

A malformed `startDate`, `excluded` or `portions` MUST be rejected with `400`, and an unauthenticated
call with `401`.

#### Scenario: Token minted for a week

- **WHEN** an authenticated client sends `POST /bring-import-token` with `{ startDate: "2026-09-28", excluded: [] }`
- **THEN** the response is `200` with a token

#### Scenario: Token minted with portions

- **WHEN** an authenticated client sends `POST /bring-import-token` with `{ startDate: "2026-09-28", excluded: [], portions: { "<pasta id>": 4 } }`
- **THEN** the response is `200` with a token

#### Scenario: Token is not a session

- **GIVEN** a freshly minted import token
- **WHEN** it is sent as the session cookie to `GET /week-log/2026-09-28`
- **THEN** the response is `401`

#### Scenario: Unauthenticated mint rejected

- **WHEN** a client without a session sends `POST /bring-import-token`
- **THEN** the response is `401`

#### Scenario: Malformed body rejected

- **WHEN** an authenticated client sends `POST /bring-import-token` with `{ startDate: "soon" }`
- **THEN** the response is `400`

#### Scenario: Non-positive portions rejected

- **WHEN** an authenticated client sends `POST /bring-import-token` with portions `0` for a recipe
- **THEN** the response is `400`

### Requirement: Public Bring! import page

The system SHALL serve `GET /bring-import/{token}` **without a session**. For a valid, unexpired token it
MUST respond `200` with an HTML page (`lang="de"`) containing one schema.org Recipe in microdata:

- an element with `itemscope` and `itemtype="http://schema.org/Recipe"`
- `itemprop="name"`: "forkcast Einkaufsliste {week range}" (e.g. "forkcast Einkaufsliste 28.9.–4.10.")
- `itemprop="yield"`: `1`
- one `itemprop="ingredients"` element per item, in list order, reading `{amount} {unit} {name}`, with
  units written as German shopping units (`g`, `ml`, `Stück`, `EL`, `TL`, `Tasse`, `oz`), e.g. "380 g Zwiebel"

The items are the grocery list for the token's `startDate` with the token's `portions` (per
`grocery-list`), **computed at request time**, minus every item whose identity is in the token's
`excluded` list. Untracked items are included unless excluded. The response MUST carry
`Cache-Control: no-store` and `X-Robots-Tag: noindex`.

An expired, tampered or malformed token MUST yield `401` with no list content. A week with no remaining
items MUST still render the page, with no ingredient lines.

#### Scenario: Page lists the week's items

- **GIVEN** a token for `2026-09-28` with nothing excluded, and a week needing 380 g Zwiebel and 800 g
  Hähnchenbrust
- **WHEN** `GET /bring-import/{token}` is requested without a session
- **THEN** the response is `200` HTML whose Recipe microdata has the ingredient lines "800 g Hähnchenbrust"
  and "380 g Zwiebel"

#### Scenario: Portions from the token apply

- **GIVEN** a token whose portions set Pasta to 4, and Pasta planned twice at 1 portion with Ketchup 50 ml each
- **WHEN** the page is requested
- **THEN** its Ketchup line reads "200 ml Ketchup"

#### Scenario: Ticked-off items are left out

- **GIVEN** a token whose `excluded` contains Olivenöl (ml)
- **WHEN** the page is requested
- **THEN** no ingredient line mentions Olivenöl

#### Scenario: List reflects the plan at fetch time

- **GIVEN** a token minted before a meal was added to that week
- **WHEN** the page is requested afterwards
- **THEN** the added meal's ingredients are on the page

#### Scenario: Piece units in German

- **GIVEN** an item Ei of 6 pieces
- **WHEN** the page is requested
- **THEN** its line reads "6 Stück Ei"

#### Scenario: Expired token rejected

- **WHEN** the page is requested with a token minted more than one hour ago
- **THEN** the response is `401` and contains no ingredient lines

#### Scenario: Tampered token rejected

- **WHEN** the page is requested with a token whose payload was altered
- **THEN** the response is `401`

#### Scenario: Not cached or indexed

- **WHEN** the page is served
- **THEN** it carries `Cache-Control: no-store` and `X-Robots-Tag: noindex`

### Requirement: An Bring! senden

The Einkaufsliste sheet SHALL offer an **An Bring! senden** action next to Kopieren. Activating it MUST:

1. mint an import token for the sheet's week, with the identities of all items currently ticked off as
   `excluded` and the sheet's current portions per recipe as `portions`
2. build the page URL from the app's current origin: `{origin}/api/bring-import/{token}`
3. open `https://api.getbring.com/rest/bringrecipes/deeplink?url={encoded page URL}&source=web&baseQuantity=1&requestedQuantity=1`

While the token is being minted, the action MUST show a pending state. If minting fails, the sheet MUST
show an error and open nothing. With every item ticked off, the action MUST be disabled.

#### Scenario: Send the items still to buy

- **GIVEN** the sheet for `2026-09-28` with Olivenöl ticked off
- **WHEN** the user activates An Bring! senden
- **THEN** a token is minted with Olivenöl excluded, and the Bring! deeplink opens with
  `url` = `{origin}/api/bring-import/{token}` and `source=web`

#### Scenario: Send with changed portions

- **GIVEN** the sheet with Pasta set to 4 portions
- **WHEN** the user activates An Bring! senden
- **THEN** the token is minted with portions 4 for Pasta

#### Scenario: Mint failure shows an error

- **WHEN** minting the token fails
- **THEN** the sheet shows an error and no deeplink is opened

#### Scenario: Everything ticked off

- **WHEN** every item in the sheet is ticked off
- **THEN** An Bring! senden is disabled
