## ADDED Requirements

### Requirement: Recipe entity shape
The system SHALL model a `Recipe` as an aggregate consisting of `id` (string), `name` (non-empty string), `yield` (positive integer representing the number of portions the recipe produces), `ingredients` (ordered list of full ingredients — `{ name, unit, macrosPerUnit, amount }`), `steps` (ordered list of non-empty strings, each describing one cooking step), `createdAt` (ISO datetime), and `updatedAt` (ISO datetime).

A recipe MUST have at least one ingredient. Steps MAY be empty (a recipe with no steps is a pure ingredient batch).

#### Scenario: Minimal valid recipe
- **WHEN** a recipe is created with `name="Oats Bowl"`, `yield=1`, one ingredient, and no steps
- **THEN** the recipe is accepted and persisted with `steps=[]`

#### Scenario: Recipe with steps
- **WHEN** a recipe is created with `name="Bolognese"`, `yield=4`, multiple ingredients, and three steps
- **THEN** the recipe is accepted and the steps are stored in the given order

#### Scenario: Empty ingredient list rejected
- **WHEN** a recipe is created with no ingredients
- **THEN** the system rejects the request with a validation error and does not persist anything

#### Scenario: Empty name rejected
- **WHEN** a recipe is created with an empty or whitespace-only `name`
- **THEN** the system rejects the request with a validation error

#### Scenario: Non-positive yield rejected
- **WHEN** a recipe is created with `yield=0` or `yield=-1`
- **THEN** the system rejects the request with a validation error

### Requirement: Add recipe
The system SHALL expose a command to add a new recipe. On success, the system MUST assign a fresh `id`, set `createdAt` and `updatedAt` to the current time, persist the recipe, and return it.

#### Scenario: Add a recipe via HTTP
- **WHEN** a client sends `POST /add-recipe` with a valid body
- **THEN** the response is `200` (or `201`) with the persisted recipe including its assigned `id`, `createdAt`, and `updatedAt`

#### Scenario: Add with invalid body
- **WHEN** a client sends `POST /add-recipe` with a body that fails validation (missing name, empty ingredients, non-positive yield, …)
- **THEN** the response is `400` with an error describing the validation failure, and no recipe is persisted

### Requirement: List recipes
The system SHALL expose a query that returns every persisted recipe, sorted alphabetically by `name` (case-insensitive).

#### Scenario: No recipes
- **WHEN** a client sends `GET /recipes` and no recipes exist
- **THEN** the response is `200` with body `[]`

#### Scenario: Populated list
- **WHEN** recipes "Bolognese", "Apple Pie", and "carrot soup" exist
- **THEN** `GET /recipes` returns them in the order Apple Pie, Bolognese, carrot soup

### Requirement: Get recipe by id
The system SHALL expose a query that returns a single recipe by its `id`.

#### Scenario: Existing recipe
- **WHEN** a client sends `GET /recipes/:id` for an existing recipe
- **THEN** the response is `200` with the full recipe

#### Scenario: Missing recipe
- **WHEN** a client sends `GET /recipes/:id` for an `id` that does not exist
- **THEN** the response is `404`

### Requirement: Update recipe
The system SHALL expose a command to update a recipe's `name`, `yield`, `ingredients`, and/or `steps`. The command MUST accept partial updates: any field omitted is left unchanged. On success, `updatedAt` MUST be set to the current time and the updated recipe is returned. The same validation rules as creation apply to any field that is being updated (e.g. an `ingredients` update MUST contain at least one ingredient).

Updating a recipe MUST NOT modify any previously logged `LogEntry` records that reference it. Logged entries are independent snapshots.

#### Scenario: Rename a recipe
- **WHEN** a client sends `PATCH /recipe/:id` with body `{ "name": "Rocket Bolognese" }`
- **THEN** the recipe's `name` is updated, `updatedAt` advances, all other fields stay the same

#### Scenario: Update yield and ingredients atomically
- **WHEN** a client sends `PATCH /recipe/:id` with both `yield` and `ingredients`
- **THEN** both fields are updated together (or both reverted on validation failure)

#### Scenario: Update with invalid field
- **WHEN** a client sends `PATCH /recipe/:id` with `{ "yield": 0 }`
- **THEN** the response is `400` and the recipe is unchanged

#### Scenario: Update missing recipe
- **WHEN** a client sends `PATCH /recipe/:id` for an unknown `id`
- **THEN** the response is `404`

#### Scenario: Past logs untouched by update
- **WHEN** a recipe has been logged into the meal log and is then updated (e.g. an ingredient amount changes)
- **THEN** the previously created `LogEntry` rows retain their original `ingredient` snapshots

### Requirement: Delete recipe
The system SHALL expose a command to delete a recipe by `id`. On success, the recipe is removed from storage. Deleting a recipe MUST NOT cascade to any `LogEntry` rows that reference it; those entries remain intact, retaining their `recipeId` (the meal-log capability separately handles the now-orphaned reference).

#### Scenario: Delete existing recipe
- **WHEN** a client sends `DELETE /recipe/:id` for an existing recipe
- **THEN** the response is `204` and subsequent `GET /recipes/:id` returns `404`

#### Scenario: Delete missing recipe
- **WHEN** a client sends `DELETE /recipe/:id` for an unknown `id`
- **THEN** the response is `404`

#### Scenario: Logged entries survive recipe deletion
- **WHEN** a recipe has been logged into the meal log and the recipe is then deleted
- **THEN** the `LogEntry` rows produced from that recipe remain in storage with their original ingredient snapshots and their original `recipeId` value

### Requirement: Recipes UI — list and create
The frontend SHALL provide a Recipes screen, reachable from the bottom navigation, that lists all recipes and exposes a "New recipe" affordance. The recipe form MUST allow entering `name`, `yield`, an ordered list of ingredients (each via the same ingredient picker the log drawer uses), and an ordered list of steps (free-text per step). Saving the form invokes the add-recipe command.

#### Scenario: Empty state
- **WHEN** the user opens the Recipes screen and no recipes exist
- **THEN** an empty state with a "New recipe" call-to-action is shown

#### Scenario: Create from screen
- **WHEN** the user fills the recipe form with a name, yield, at least one ingredient, and zero or more steps, then submits
- **THEN** the recipe is added, the form closes, and the recipe appears in the list

#### Scenario: Validation feedback
- **WHEN** the user attempts to save a recipe with a missing name or no ingredients
- **THEN** the form surfaces inline validation errors and does not submit

### Requirement: Recipes UI — edit and delete
From the recipes list, the user SHALL be able to open a recipe and either view it (read mode showing ingredients and cooking steps), edit it (mutates name/yield/ingredients/steps, saves via update-recipe), or delete it (with a confirm step).

#### Scenario: Edit a recipe
- **WHEN** the user opens a recipe, switches to edit mode, modifies a field, and saves
- **THEN** the update-recipe command is sent and the list reflects the change

#### Scenario: Delete with confirmation
- **WHEN** the user taps "Delete" on a recipe
- **THEN** a confirmation prompt is shown; only on confirm is the delete-recipe command sent

#### Scenario: Cooking view
- **WHEN** the user opens a recipe in read mode
- **THEN** the screen shows the recipe name, yield, the ingredient list with amounts and units, and the ordered cooking steps
