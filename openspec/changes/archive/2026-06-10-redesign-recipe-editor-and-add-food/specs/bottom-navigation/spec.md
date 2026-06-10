## ADDED Requirements

### Requirement: Bottom navigation hidden on recipe sub-screens
The bottom navigation bar SHALL be **hidden** whenever the user is inside a recipe sub-screen — the
Recipe Detail (read) view, the Recipe Editor (create or edit), or the AI-import review screen — so those
focused authoring/reading flows use the full height. The bar MUST reappear when the user returns to the
Recipes list (or any other primary screen). While the bar is hidden, the main content area MUST NOT
reserve bottom padding for it (so content is not clipped by phantom spacing).

This is an exception to "the bar is visible on every primary screen": the recipe sub-screens are not
primary screens, and the Recipes **list** itself remains a primary screen with the bar visible.

#### Scenario: Bar hidden on recipe detail
- **WHEN** the user opens a recipe in read (detail) mode
- **THEN** the bottom navigation bar is not shown

#### Scenario: Bar hidden in the recipe editor
- **WHEN** the user is creating or editing a recipe
- **THEN** the bottom navigation bar is not shown

#### Scenario: Bar restored on returning to the list
- **WHEN** the user leaves a recipe sub-screen back to the Recipes list
- **THEN** the bottom navigation bar is visible again and the content area is not clipped

#### Scenario: Bar visible on the Recipes list
- **WHEN** the user is on the Recipes list (not inside a recipe)
- **THEN** the bottom navigation bar is visible
