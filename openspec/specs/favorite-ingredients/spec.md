# favorite-ingredients

## Purpose

Give the user a curated, stable set of everyday ingredients that is reachable in one tap while logging a meal or assembling a recipe. Unlike the mechanical recency list, membership is chosen by the user and does not shift when other foods are logged.

## Requirements

### Requirement: A favorite is a snapshot identified by name and unit

A favorite SHALL store a snapshot of the ingredient: `name` (as displayed when it was favorited), `unit` (`g` or `ml`), `macrosPerUnit`, an OPTIONAL `untracked` boolean (omitted entirely when the ingredient is tracked), and `favoritedAt` (an ISO-8601 timestamp).

Two favorites refer to the SAME ingredient when their `name` (case-insensitive) and `unit` are equal — the identity rule already used by recently used ingredients. The set SHALL hold at most one favorite per identity.

A favorite SHALL NOT reference a food-catalog entry id or any other source id. Consequently, editing or deleting a catalog entry MUST NOT change or remove a favorite, and any ingredient the user can pick — whatever its search source — is favoritable.

#### Scenario: Favorite keeps its own macro snapshot

- **WHEN** the user favorites a catalog-sourced ingredient and the catalog entry's macros are later corrected
- **THEN** the favorite still carries the macros captured at favoriting time

#### Scenario: Deleting the catalog entry leaves the favorite

- **WHEN** the user favorites an ingredient sourced from catalog entry `olivenoel` and that entry is then deleted from the catalog
- **THEN** the favorite is still listed with its stored name, unit, and macros

#### Scenario: Non-catalog result is favoritable

- **WHEN** the user favorites a result whose source is `OFF`
- **THEN** the favorite is stored with that result's name, unit, and macros

#### Scenario: Untracked flag is carried into the snapshot

- **WHEN** the user favorites an ingredient carrying `untracked: true`
- **THEN** the stored favorite carries `untracked: true`

### Requirement: Favoriting is an idempotent upsert

Favoriting an ingredient whose identity is already favorited SHALL NOT create a second favorite. It SHALL overwrite the stored `name` (adopting the new casing), `macrosPerUnit`, and `untracked` with the newly supplied values, and SHALL leave `favoritedAt` at its original value.

Favoriting SHALL reject a payload with a non-empty `name`, a `unit` outside `g` / `ml`, or `macrosPerUnit` values that are not finite and non-negative, leaving the favorites set unchanged.

#### Scenario: Re-favoriting refreshes macros without duplicating

- **WHEN** `Skyr / g` is already favorited and the user favorites `Skyr / g` again with different macros
- **THEN** the set holds exactly one `Skyr / g` favorite carrying the new macros and its original `favoritedAt`

#### Scenario: Casing differences collapse to one favorite

- **WHEN** `Skyr / g` is already favorited and the user favorites `skyr / g`
- **THEN** the set holds exactly one favorite for that identity, and its `name` is `skyr`

#### Scenario: Same name with a different unit is a separate favorite

- **WHEN** the user favorites `Milch / ml` and then `Milch / g`
- **THEN** the set holds two favorites

#### Scenario: Invalid payload rejected

- **WHEN** a favorite request carries an empty `name` or a negative `macrosPerUnit.calories`
- **THEN** the request is rejected and the favorites set is unchanged

### Requirement: Unfavoriting is idempotent

Unfavoriting SHALL remove the favorite matching the given `name` (case-insensitive) and `unit`. Unfavoriting an identity that is not favorited SHALL succeed and leave the set unchanged — it MUST NOT be reported as an error.

Unfavoriting MUST NOT alter any log entry, recipe, or catalog entry.

#### Scenario: Favorite removed

- **WHEN** the user unfavorites `Skyr / g` while it is favorited
- **THEN** the favorites list no longer contains it

#### Scenario: Unfavoriting an absent identity succeeds

- **WHEN** the user unfavorites `Skyr / g` while it is not favorited
- **THEN** the operation succeeds and the favorites set is unchanged

#### Scenario: Logged days survive unfavoriting

- **WHEN** the user unfavorites an ingredient that appears in past log entries
- **THEN** those log entries and their day totals are unchanged

### Requirement: Favorites are durable and shared across devices

Favorites SHALL be persisted server-side so they survive a backend restart and are identical for every client of the same account. They MUST NOT be stored only in a browser.

#### Scenario: Favorites survive a restart

- **WHEN** the user favorites three ingredients and the backend is restarted
- **THEN** the favorites list still returns those three

#### Scenario: Second device sees the same list

- **WHEN** the user favorites an ingredient on one device and opens the log drawer on another
- **THEN** the favorites list on the second device contains that ingredient

### Requirement: Listing favorites enriches each entry with its last use

The system SHALL expose a query returning every favorite. Each returned favorite SHALL carry, in addition to its stored fields, an OPTIONAL `lastAmount` and `lastUsedAt` derived from the user's log history: the `amount` and `loggedAt` of the most recent **full** log entry (`type === 'full'`) whose `name` (case-insensitive) and `unit` match the favorite's identity. Quick entries MUST NOT contribute.

When no matching full log entry exists, both fields SHALL be omitted.

Results SHALL be sorted with used favorites first, by `lastUsedAt` descending, followed by never-used favorites by `favoritedAt` descending. Ordering MUST be deterministic for the same stored data.

#### Scenario: Empty set

- **WHEN** the user has favorited nothing
- **THEN** the query returns an empty list

#### Scenario: Last amount taken from the most recent full entry

- **WHEN** `Haferflocken / g` is favorited and was logged as a full entry with amount 60 last week and amount 80 today
- **THEN** the returned favorite carries `lastAmount` 80 and `lastUsedAt` equal to today's entry's `loggedAt`

#### Scenario: Quick entries do not supply a last amount

- **WHEN** a favorite's name matches only quick entries in the log history
- **THEN** the returned favorite omits `lastAmount` and `lastUsedAt`

#### Scenario: Never-logged favorite has no last amount

- **WHEN** the user favorites an ingredient straight from search and has never logged it
- **THEN** the returned favorite omits `lastAmount` and `lastUsedAt`

#### Scenario: Used favorites sort ahead of never-used ones

- **WHEN** favorites A (logged today), B (logged last week), and C (never logged) exist
- **THEN** the query returns them in the order A, B, C

### Requirement: HTTP endpoints for listing, favoriting, and unfavoriting

The system SHALL expose three authenticated endpoints:

- `GET /favorite-ingredients` returning the full list as a JSON array of `{ name, unit, macrosPerUnit, favoritedAt }` objects, each OPTIONALLY carrying `untracked`, `lastAmount`, and `lastUsedAt`. It MUST return `200 OK` with `[]` when nothing is favorited (NOT `404`) and MUST NOT accept query parameters in this version.
- `POST /favorite-ingredient` accepting `{ name, unit, macrosPerUnit, untracked? }`, returning `200 OK` on success and `400` for an invalid payload.
- `POST /unfavorite-ingredient` accepting `{ name, unit }`, returning `200 OK` on success (including when the identity was not favorited) and `400` for a malformed payload.

Unauthenticated calls to any of the three MUST return `401` and leave the favorites set unchanged.

#### Scenario: Empty list

- **WHEN** an authenticated client sends `GET /favorite-ingredients` and nothing is favorited
- **THEN** the response is `200 OK` with body `[]`

#### Scenario: Favorite then list

- **WHEN** an authenticated client posts a valid favorite and then sends `GET /favorite-ingredients`
- **THEN** the response is `200 OK` and the array contains that ingredient

#### Scenario: Invalid favorite payload

- **WHEN** an authenticated client posts a favorite with `unit: "kg"`
- **THEN** the response is `400` and the favorites set is unchanged

#### Scenario: Unfavoriting something absent still succeeds

- **WHEN** an authenticated client posts `/unfavorite-ingredient` for an identity that is not favorited
- **THEN** the response is `200 OK`

#### Scenario: Unauthenticated access rejected

- **WHEN** an unauthenticated client calls any of the three endpoints
- **THEN** the response is `401` and the favorites set is unchanged

### Requirement: Favorite star on every ingredient row

Every ingredient row in the search-results list, the recently-used list, and the favorites list SHALL render a favorite toggle showing whether that row's identity is currently favorited. This applies in both the log drawer and the recipe ingredient picker, since both surfaces share those lists.

Activating the toggle SHALL flip the favorite state for that row's identity and MUST NOT select the row, open the confirm/amount step, or close the surface. The toggle SHALL carry an accessible label stating which action it performs, and its state MUST update as soon as the write succeeds.

On the Favorites tab the toggle is always in the favorited state, and activating it SHALL remove the favorite in place — the row leaves the list without the user having to find the ingredient again in Search or Recent.

The toggle SHALL remain operable on rows whose *selection* is gated because the ingredient is untracked. Such a row's text stays unselectable while its star stays enabled: favoriting an untracked seasoning is meaningful for the recipe picker.

When the write fails, the toggle SHALL return to its previous state and an error SHALL be surfaced, leaving the list otherwise usable.

#### Scenario: Star reflects stored state

- **WHEN** `Skyr / g` is favorited and the user searches for it
- **THEN** the `Skyr` row's toggle renders in the favorited state

#### Scenario: Tapping the star does not select the row

- **WHEN** the user taps the star on a search-result row
- **THEN** the ingredient becomes favorited and the list stays open on the same step

#### Scenario: Unstarring from the recent list

- **WHEN** the user taps the star of a favorited ingredient in the Recent tab
- **THEN** the ingredient is no longer favorited and disappears from the Favorites tab

#### Scenario: Failed toggle reverts

- **WHEN** the favorite write fails
- **THEN** the toggle returns to its previous state and an error is surfaced

#### Scenario: Star reachable from the recipe ingredient picker

- **WHEN** the user opens the recipe ingredient picker and searches for an ingredient
- **THEN** each result row offers the same favorite toggle

#### Scenario: Removing a favorite from the Favorites tab

- **WHEN** the user activates the star on a row in the Favorites tab
- **THEN** the ingredient is no longer favorited and the row leaves the list
- **AND** the confirm/amount step is not opened

#### Scenario: Star stays enabled on an untracked row

- **WHEN** a search result is untracked and the surface gates its selection
- **THEN** the row's text is not selectable
- **AND** its star is still operable, and activating it favorites the ingredient

### Requirement: Favorites tab in the log drawer and the recipe ingredient picker

The log drawer SHALL present its tabs in the order Search, Favorites, Recent, Recipes, Quick. The recipe ingredient picker SHALL present its tabs in the order Search, Favorites, Recent. In both surfaces the Search tab SHALL remain the tab selected on open.

The Favorites tab SHALL list the favorites in the order returned by the list query, and SHALL offer a search input that filters the loaded list **client-side** with fuzzy matching, firing no network request. An empty query SHALL show the full list. Sort order of filtered results SHOULD reflect fuzzy match score, falling back to the list query's order for equal scores.

Each row SHALL show the ingredient's name. In the **log drawer** the row SHALL additionally show, on a second line, the favorite's `lastAmount` with its unit followed by the calories per unit; when the favorite carries no `lastAmount` that line SHALL show the calories per unit followed by a phrase stating the ingredient has not been logged yet, so the two cases are distinguishable at a glance rather than by omission.

In the **recipe ingredient picker** the row SHALL show the name and the calories per unit only, and MUST NOT show a last amount — a last amount is log history and has no meaning while assembling a recipe.

When nothing is favorited, the tab SHALL show an empty state explaining that ingredients are favorited via the star in the Search and Recent lists.

#### Scenario: Drawer tab order

- **WHEN** the log drawer opens
- **THEN** the tab bar shows Search, Favorites, Recent, Recipes, Quick in that order, with Search selected

#### Scenario: Picker tab order

- **WHEN** the recipe ingredient picker opens
- **THEN** the tab bar shows Search, Favorites, Recent in that order, with Search selected

#### Scenario: Fuzzy filter is local

- **WHEN** the user types `skir` in the Favorites tab's filter and `Skyr` is favorited
- **THEN** `Skyr` appears in the filtered results and no network request is sent

#### Scenario: Row shows the last used amount

- **WHEN** the log drawer's Favorites tab lists a favorite whose `lastAmount` is 180 g
- **THEN** the row shows its name, the amount 180 g, and the calories per unit

#### Scenario: Never-logged row says so

- **WHEN** the log drawer's Favorites tab lists a favorite carrying no `lastAmount`
- **THEN** the row shows the calories per unit and a phrase stating the ingredient has not been logged yet

#### Scenario: Picker rows omit the last amount

- **WHEN** the recipe ingredient picker's Favorites tab lists a favorite whose `lastAmount` is 180 g
- **THEN** the row shows the name and the calories per unit, and no amount

#### Scenario: Empty state points at the star

- **WHEN** the user opens the Favorites tab with nothing favorited
- **THEN** an empty state is shown explaining how to favorite an ingredient

### Requirement: Picking a favorite flows through the existing confirm step

Picking an ingredient from the Favorites tab SHALL transition to the same confirm/amount step a Search pick uses, contributing the favorite's `name`, `unit`, `macrosPerUnit`, and `untracked` to the resulting entry.

In the log drawer, the confirm step's amount input SHALL be pre-filled with the favorite's `lastAmount` when it has one, and SHALL be empty otherwise. In the recipe ingredient picker the amount input SHALL open empty, matching how a Recent pick already behaves there — a recipe amount is a property of the recipe, not of the user's logging history.

Pressing Back from the confirm step SHALL return to the Favorites tab, not the Search tab.

#### Scenario: Pick pre-fills the last amount

- **WHEN** the user taps a favorite whose `lastAmount` is 80 in the log drawer
- **THEN** the confirm step renders with `80` in the amount input

#### Scenario: Never-used favorite opens empty

- **WHEN** the user taps a favorite that carries no `lastAmount`
- **THEN** the confirm step renders with an empty amount input

#### Scenario: Submitting logs a full entry

- **WHEN** the user taps a favorite and submits the amount
- **THEN** a full log entry is persisted with the favorite's name, unit, macros, and the submitted amount

#### Scenario: Picker amount step opens empty

- **WHEN** the user taps a favorite in the recipe ingredient picker
- **THEN** the amount step renders with an empty amount input

#### Scenario: Back returns to Favorites

- **WHEN** the user is on the confirm step after picking from Favorites and presses Back
- **THEN** the surface returns to the Favorites tab

### Requirement: Favorites list stays current after logging

Because `lastAmount` and `lastUsedAt` are derived from log history, the client SHALL refresh the favorites list after any mutation that changes that history — logging an ingredient, logging a recipe, editing a log entry, and removing an ingredient or recipe log.

#### Scenario: Logging updates the pre-filled amount

- **WHEN** the user logs a favorited ingredient with amount 120 and later opens the Favorites tab and taps it
- **THEN** the confirm step is pre-filled with `120`

#### Scenario: Removing the only log entry clears the last amount

- **WHEN** the only full log entry matching a favorite is deleted and the user opens the Favorites tab and taps it
- **THEN** the confirm step renders with an empty amount input
