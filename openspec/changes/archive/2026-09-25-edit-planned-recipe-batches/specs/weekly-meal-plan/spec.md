## MODIFIED Requirements

### Requirement: Copy a planned day to the next day
The planner SHALL let the user **copy a day's planned meals onto the following day**. The action MUST be
confirmed before it runs. On confirm, the system clones every `LogEntry` of the source day onto the next
day — each clone receives a fresh `id` and `loggedAt` and the next day's `date`, with its `slot`,
`ingredient`, `recipeId` and `recipePortions` preserved. Each **recipe batch** of the source day MUST be
copied as a **new, independent batch**: all clones of one source batch share one fresh `recipeBatchId`
that differs from the source's and from every other copied batch's. Entries without a `recipeBatchId`
stay without one. The copy is **additive**: it adds to whatever the target day already contains and
does not clear it first; the confirm dialog states this. The clone MUST be atomic (all entries copied or
none).

The system SHALL expose this as a command `copyLogDay(fromDate, toDate)` over HTTP as
`POST /copy-log-day { fromDate, toDate }`.

#### Scenario: Copy a day's meals to the next day
- **GIVEN** Monday has three entries and Tuesday is empty
- **WHEN** the user invokes "Tag kopieren" on Monday and confirms
- **THEN** Tuesday gains three new entries (fresh ids, `date` = Tuesday) mirroring Monday's slots and
  ingredients, and Monday is unchanged

#### Scenario: Copied recipe batch is independent of its source
- **GIVEN** Monday's dinner holds a 3-entry Chili batch
- **WHEN** Monday is copied onto Tuesday
- **THEN** Tuesday's three Chili clones share one `recipeBatchId` that differs from Monday's, keep
  `recipeId` and `recipePortions`, and render as one Chili group

#### Scenario: Two batches stay two batches
- **GIVEN** Monday holds two batches (lunch and dinner) and one ad-hoc entry
- **WHEN** Monday is copied onto Tuesday
- **THEN** Tuesday gains two batches with two distinct fresh batch ids, and the ad-hoc clone carries no
  `recipeBatchId`

#### Scenario: Removing a copied batch leaves the source
- **GIVEN** Monday was copied onto Tuesday, including a Chili batch
- **WHEN** the user removes the Chili batch on Tuesday
- **THEN** Monday's Chili batch is unchanged

#### Scenario: Copy is additive
- **GIVEN** Tuesday already has one entry
- **WHEN** the user copies Monday's three entries onto Tuesday
- **THEN** Tuesday has four entries (the existing one plus the three copies)

#### Scenario: Confirm required
- **WHEN** the user taps "Tag kopieren" but cancels the confirm
- **THEN** no entries are copied

#### Scenario: Atomic copy
- **WHEN** `copyLogDay` runs
- **THEN** either every source entry is cloned onto the target day or none is — no partial copy

#### Scenario: HTTP endpoint
- **WHEN** a client sends `POST /copy-log-day` with `{ fromDate, toDate }`
- **THEN** the response indicates success and the cloned entries are persisted on `toDate`
