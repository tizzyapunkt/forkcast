## MODIFIED Requirements

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
