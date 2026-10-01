## ADDED Requirements

### Requirement: Ingredient name is persisted trimmed
On both `add-recipe` and `update-recipe`, the system SHALL persist each ingredient row's `name` with surrounding whitespace removed. A name that is empty after trimming MUST still be rejected with a validation error. Trimming MUST NOT alter any other field of the row.

#### Scenario: Name trimmed on persistence
- **WHEN** a recipe is created with an ingredient whose `name` is `"  Skyr  "`
- **THEN** the recipe is persisted with that ingredient's `name` equal to `"Skyr"`

#### Scenario: Renamed row saved via update
- **GIVEN** an existing recipe with the ingredient `{ name: "Skyr Natur 0,2% Fett - Arla - 450 g", unit: "g", amount: 150, macrosPerUnit }`
- **WHEN** a client sends `PATCH /recipe/:id` with the same ingredients except that row's `name` is `"Skyr"`
- **THEN** the persisted row is `{ name: "Skyr", unit: "g", amount: 150, macrosPerUnit }` with its macros unchanged

#### Scenario: Whitespace-only name still rejected
- **WHEN** a recipe is updated with an ingredient whose `name` is `"   "`
- **THEN** the response is `400` and the recipe is unchanged

### Requirement: Rename an ingredient row in the recipe editor
Each ingredient row in the recipe editor (new recipe, edit recipe, AI-import review) SHALL offer a rename action separate from the name's replace-via-picker action. It turns the name into an inline text field pre-filled with the current name. Committing replaces only the row's `name`. All other fields of the row MUST stay unchanged. The catalog and other recipes MUST NOT be touched.

#### Scenario: Rename keeps nutrition and quantities
- **GIVEN** a row `{ name: "Bio Haferflocken Zartblatt", unit: "g", amount: 60, macrosPerUnit: oats, note: "über Nacht eingeweicht" }`
- **WHEN** the user opens the row's rename action, types `"Haferflocken"`, and confirms
- **THEN** the row becomes `{ name: "Haferflocken", unit: "g", amount: 60, macrosPerUnit: oats, note: "über Nacht eingeweicht" }`

#### Scenario: Rename keeps piece quantity and untracked flag
- **GIVEN** an untracked row with `displayQuantity` and a piece-tracked row with `pieceQuantity`
- **WHEN** the user renames each of them
- **THEN** the untracked row keeps `untracked: true` and its `displayQuantity`, and the piece row keeps its `pieceQuantity` unchanged

#### Scenario: Enter and blur commit
- **WHEN** the user edits the name field and presses Enter, or moves focus away from it
- **THEN** the trimmed value becomes the row's name and the row shows the name as text again

#### Scenario: Escape cancels
- **WHEN** the user edits the name field and presses Escape
- **THEN** the row keeps its previous name and the field closes

#### Scenario: Empty name restores the previous name
- **WHEN** the user clears the name field (empty or whitespace-only) and commits
- **THEN** the row keeps its previous name

#### Scenario: Enter does not submit the recipe form
- **WHEN** the user presses Enter inside the rename field
- **THEN** the rename is committed and the surrounding recipe form is not submitted

#### Scenario: Tapping the name still replaces
- **WHEN** the user taps the row's name (not the rename action)
- **THEN** the picker opens in replace mode, as before

#### Scenario: Renamed name is saved
- **GIVEN** an existing recipe opened in edit mode
- **WHEN** the user renames a row and saves the recipe
- **THEN** the update-recipe payload carries the new name on that row and the reopened recipe shows it

#### Scenario: Rename available in AI-import review
- **WHEN** the user reviews an AI-imported recipe
- **THEN** every ingredient row offers the rename action, and renaming does not change the row's raw-read line

### Requirement: Name an Open Food Facts or scanned product when adding it to a recipe
When the user picks an `OFF` or `SCAN` search result in the recipe ingredient picker's add mode, the amount step SHALL also show a name field pre-filled with the result's name. The added row MUST carry the trimmed field value as its `name`. An empty field falls back to the result's name. `CATALOG` results MUST NOT show the field. Replace mode is unaffected and skips the amount step as before.

#### Scenario: Shortened OFF name stored on the new row
- **WHEN** the user picks the OFF result `"Skyr Natur 0,2% Fett - Arla - 450 g"`, changes the name field to `"Skyr"`, enters `150`, and adds it
- **THEN** the recipe gains the row `{ name: "Skyr", unit: "g", amount: 150, macrosPerUnit }` with the OFF result's macros

#### Scenario: Untouched name field keeps the product name
- **WHEN** the user picks an OFF result and adds it without editing the name field
- **THEN** the new row's `name` equals the OFF result's name

#### Scenario: Cleared name field falls back
- **WHEN** the user clears the name field and adds the product
- **THEN** the new row's `name` equals the OFF result's name

#### Scenario: Scanned product offers the name field
- **WHEN** the user picks a `SCAN` result in add mode
- **THEN** the amount step shows the pre-filled name field

#### Scenario: Catalog result has no name field
- **WHEN** the user picks a `CATALOG` result in add mode
- **THEN** the amount step shows only the amount input, as before
