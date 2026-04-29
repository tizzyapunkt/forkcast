## ADDED Requirements

### Requirement: Persistent bottom navigation bar
The frontend SHALL render a persistent bottom navigation bar across all primary screens (Log, Recipes, Settings). The bar MUST contain exactly three tabs in the order Log, Recipes, Settings, each with an icon and a label, and MUST highlight the tab corresponding to the currently active screen.

The bar MUST be fixed to the bottom of the viewport and MUST NOT obscure scrollable content (the main content area MUST be padded so its bottom edge clears the bar).

#### Scenario: Default destination
- **WHEN** the app loads
- **THEN** the Log tab is active and the bottom navigation shows Log highlighted

#### Scenario: Switch destination
- **WHEN** the user taps the Recipes tab
- **THEN** the active screen becomes Recipes and the Recipes tab is highlighted

#### Scenario: Bar visible on every primary screen
- **WHEN** the user is on any of Log, Recipes, or Settings
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
