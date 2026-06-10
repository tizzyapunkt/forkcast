# bottom-navigation

## Purpose

Persistent bottom tab bar across the app providing top-level navigation between Log, Recipes, and Settings. Replaces the prior in-header settings gear; the header remains for the Log screen's date navigation and day-totals row only.
## Requirements
### Requirement: Persistent bottom navigation bar
The frontend SHALL render a persistent bottom navigation bar across all primary screens (Log, Planner,
Recipes, Settings). The bar MUST contain exactly four tabs in the order Log, Planner, Recipes, Settings,
each with an icon and a label, and MUST highlight the tab corresponding to the currently active screen.

The bar MUST be fixed to the bottom of the viewport and MUST NOT obscure scrollable content (the main
content area MUST be padded so its bottom edge clears the bar).

#### Scenario: Default destination
- **WHEN** the app loads
- **THEN** the Log tab is active and the bottom navigation shows Log highlighted

#### Scenario: Switch destination
- **WHEN** the user taps the Recipes tab
- **THEN** the active screen becomes Recipes and the Recipes tab is highlighted

#### Scenario: Planner destination
- **WHEN** the user taps the Planner tab
- **THEN** the active screen becomes the weekly Planner and the Planner tab is highlighted

#### Scenario: Bar visible on every primary screen
- **WHEN** the user is on any of Log, Planner, Recipes, or Settings
- **THEN** the bottom navigation bar is visible

#### Scenario: Content not occluded
- **WHEN** the active screen has scrollable content reaching the bottom
- **THEN** the content's last item remains fully scrollable into view above the bar

### Requirement: Bottom navigation coexists with the log drawer
The bottom navigation bar MUST be visually below the `LogIngredientDrawer` overlay when the drawer is open, so the drawer takes full focus. The user dismisses the drawer through its own affordances (overlay tap or Cancel button); once dismissed, the bottom navigation bar becomes tappable again. Drawer interactions MUST NOT be blocked by the bar.

#### Scenario: Drawer covers nav
- **WHEN** the log drawer is open
- **THEN** the drawer surface (panel and overlay) is rendered above the bottom navigation bar

#### Scenario: Overlay tap dismisses drawer; then nav is tappable
- **WHEN** the user taps the drawer overlay
- **THEN** the drawer closes and the bottom navigation bar becomes interactive — a subsequent tap on a tab switches destinations

### Requirement: Settings reachable only via bottom navigation
The settings gear in the application header SHALL be removed. Settings MUST be reachable solely via the Settings tab in the bottom navigation. The application header MUST remain in place on the Log screen for the date navigation and day-totals row, but MUST NOT contain a settings button anywhere.

#### Scenario: No gear in header
- **WHEN** the user is on the Log screen
- **THEN** the header shows the date navigation and day-totals row but no settings gear

#### Scenario: Settings via tab
- **WHEN** the user taps the Settings tab
- **THEN** the Settings screen renders

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

