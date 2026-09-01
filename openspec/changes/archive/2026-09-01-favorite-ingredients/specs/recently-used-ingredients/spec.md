## MODIFIED Requirements

### Requirement: "Recent" tab in the log drawer
The log drawer SHALL present a "Recent" tab as the third tab, with the order Search → Favorites → Recent → Recipes → Quick. The default selected tab on drawer open remains "Search".

#### Scenario: Tab ordering
- **WHEN** the log drawer opens
- **THEN** the tab bar shows five tabs in the order: Search, Favorites, Recent, Recipes, Quick

#### Scenario: Default tab unchanged
- **WHEN** the log drawer opens
- **THEN** the Search tab is selected by default
