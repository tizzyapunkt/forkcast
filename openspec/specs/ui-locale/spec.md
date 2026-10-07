# ui-locale

## Purpose

Defines which UI languages forkcast supports, how the active language is chosen and remembered on a device, and how dates, numbers and labels follow it, so the whole app reads consistently in German or English.

## Requirements

### Requirement: The app supports German and English UI locales

The frontend SHALL support exactly two UI locales, `de` (German) and `en` (English). Every user-facing string SHALL exist in both locales, and a message key present in one locale but missing in the other MUST fail the type check or test suite rather than render a fallback at runtime.

#### Scenario: Every German message has an English counterpart
- **WHEN** the message sets are checked
- **THEN** the English set provides every key the German set provides, with the same argument shape for parameterised messages

#### Scenario: Screens render in English
- **WHEN** the active locale is `en` and the user opens the daily log, the week plan, recipes, the grocery list and settings
- **THEN** no German UI copy appears on those screens (user data such as food names is out of scope of this scenario)

### Requirement: The initial locale follows the browser language

When no locale has been chosen on the device, the app SHALL derive the locale from the browser's preferred language: a language tag starting with `de` selects `de`, and any other tag (or none) selects `en`.

#### Scenario: German browser starts in German
- **WHEN** the app loads for the first time on a device whose preferred language is `de-AT`
- **THEN** the UI renders in German

#### Scenario: Non-German browser starts in English
- **WHEN** the app loads for the first time on a device whose preferred language is `fr-FR`
- **THEN** the UI renders in English

### Requirement: The user can override the locale in settings

The settings screen SHALL offer a language control with the options German and English, showing the active locale as selected. Choosing a locale SHALL apply it to the whole UI and persist it on the device, so later starts use the chosen locale regardless of the browser language. The choice is per device and is not synced to the backend.

#### Scenario: Switching to English persists
- **WHEN** a user on a German browser selects English in settings and later reopens the app
- **THEN** the UI renders in English

#### Scenario: Stored choice wins over browser language
- **WHEN** the device has `de` stored as the chosen locale and the browser's preferred language is `en-US`
- **THEN** the UI renders in German

### Requirement: Formatting follows the active locale

Dates, weekday names, times, decimal numbers and file sizes SHALL be formatted using the active locale. The document's `lang` attribute SHALL equal the active locale. Decimal input fields SHALL accept both `,` and `.` as the decimal separator in either locale.

#### Scenario: English date navigation
- **WHEN** the active locale is `en` and the date navigation shows Monday, 5 October
- **THEN** the label uses English weekday and month abbreviations (e.g. `Mon 5 Oct`)

#### Scenario: English decimals
- **WHEN** the active locale is `en` and a value of 1.5 is displayed
- **THEN** it renders as `1.5`, and as `1,5` when the locale is `de`

#### Scenario: Document language
- **WHEN** the active locale is `en`
- **THEN** the root `html` element carries `lang="en"`

### Requirement: Ingredient search requests carry the active locale

Every ingredient search request the frontend sends SHALL include the active locale, so catalog results come back named in the user's language.

#### Scenario: English search request
- **WHEN** the active locale is `en` and the user searches for an ingredient
- **THEN** the search request carries `locale=en`
