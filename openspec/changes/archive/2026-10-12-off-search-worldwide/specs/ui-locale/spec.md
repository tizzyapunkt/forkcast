## MODIFIED Requirements

### Requirement: Ingredient search requests carry the active locale

Every ingredient search request the frontend sends SHALL include the active locale, so results come back in the user's language. Catalog results SHALL be named in that locale. When the search includes Open Food Facts, the backend SHALL search Open Food Facts in the active locale's language with no restriction to a country or market, so packaged products from any country can match. Each Open Food Facts result SHALL be named with its product name in the active locale when Open Food Facts has one, otherwise with its generic product name, otherwise with its name in the other supported locale. A product with none of these names SHALL be left out.

#### Scenario: English search request
- **WHEN** the active locale is `en` and the user searches for an ingredient
- **THEN** the search request carries `locale=en`

#### Scenario: Open Food Facts search is not limited to Germany
- **WHEN** the active locale is `en`, the Open Food Facts source is on, and the user searches for `peanut butter`
- **THEN** the backend asks Open Food Facts for English-language results with no country filter, and products sold outside Germany can appear in the results

#### Scenario: German search keeps German results first
- **WHEN** the active locale is `de`, the Open Food Facts source is on, and the user searches for `Erdnussbutter`
- **THEN** the backend asks Open Food Facts for German-language results with no country filter

#### Scenario: Result named in the active locale
- **WHEN** the active locale is `en` and an Open Food Facts hit has the generic name `Compote` and the English name `Skyr Pur`
- **THEN** the result is named `Skyr Pur`

#### Scenario: Generic name when the locale has none
- **WHEN** the active locale is `de` and an Open Food Facts hit has the generic name `Peanut Butter` and no German name
- **THEN** the result is named `Peanut Butter`

#### Scenario: Product named only in the active locale is kept
- **WHEN** the active locale is `en` and an Open Food Facts hit has no generic name but the English name `Skyr Mandarin Pie`
- **THEN** the result appears, named `Skyr Mandarin Pie`
