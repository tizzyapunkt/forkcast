## ADDED Requirements

### Requirement: Cooked portions of a recipe batch

A recipe batch SHALL carry a **cooked portions** value: how many portions are cooked, as opposed to
`recipePortions`, the portions logged as eaten. It is stored as an optional `cookedPortions?: number`
on every `LogEntry` of the batch. When absent, the batch's cooked portions equal its `recipePortions`.
Cooked portions MUST NOT affect any nutrition value: entry, slot, day and week totals stay based on
logged amounts. Entries persisted before this change MUST load unchanged.

The system SHALL expose a command `SetCookedPortions` that, given `{ recipeBatchId, date, cookedPortions }`,
sets `cookedPortions` on every entry of that batch on `date`, and on no entry on another date. The value
MUST be a positive number **not below** the batch's `recipePortions`. The command MUST fail with a
validation error otherwise, and with a not-found error when no entry on `date` carries `recipeBatchId`.
It SHALL be exposed as `POST /set-cooked-portions` (`200` with the updated entries, `400`, `404`).

Every entry that joins a batch afterwards (via "Add an ingredient to a logged recipe batch") MUST take
the batch's `cookedPortions`, so all entries of a batch on a date always agree. Copying a day MUST keep
`cookedPortions` on the copied batch.

In the UI (daily log and planner), the batch banner SHALL show the cooked portions when they differ
from the logged portions (e.g. "1 Port. · für 2 gekocht") and SHALL offer a control to change them.
The control MUST NOT offer values below the logged portions.

#### Scenario: Cook for two, eat one

- **GIVEN** a Chili batch on `2026-09-29` logged at 1 portion
- **WHEN** the user sets its cooked portions to 2
- **THEN** every entry of that batch on `2026-09-29` carries `cookedPortions = 2`, the banner shows
  "1 Port. · für 2 gekocht", and the day's kcal and macro totals are unchanged

#### Scenario: Default equals logged portions

- **WHEN** a recipe is logged at 2 portions
- **THEN** its banner shows only "2 Port." and the batch's cooked portions are 2

#### Scenario: Below logged portions rejected

- **GIVEN** a batch logged at 2 portions
- **WHEN** `POST /set-cooked-portions` sets `cookedPortions = 1`
- **THEN** the response is `400` and nothing changes

#### Scenario: Unknown batch rejected

- **WHEN** `POST /set-cooked-portions` names a batch with no entries on `date`
- **THEN** the response is `404`

#### Scenario: Added ingredient follows the batch

- **GIVEN** a batch cooked for 3
- **WHEN** the user adds Spinat to the batch
- **THEN** the new Spinat entry carries `cookedPortions = 3`

#### Scenario: Copy keeps cooked portions

- **GIVEN** Monday's Chili batch cooked for 2
- **WHEN** Monday is copied onto Tuesday
- **THEN** Tuesday's copied Chili batch is also cooked for 2

#### Scenario: Set from the planner

- **GIVEN** the planner shows next Tuesday with a Chili batch
- **WHEN** the user raises its cooked portions to 2 from the banner
- **THEN** the banner shows "für 2 gekocht" there and in the daily log for that Tuesday
