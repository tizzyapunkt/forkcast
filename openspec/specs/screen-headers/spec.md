# screen-headers

## Purpose

Define the app-wide header rule: the indigo app header is the single place a screen is named. Primary tab screens carry their screen title in the header (Tagebuch intentionally shows the "forkcast" wordmark as the home anchor), and sub-screens carry a back arrow, the entity title, and an optional subtitle. A screen's title is never repeated as a heading in the scroll body.

## Requirements

### Requirement: Screen title lives in the app header

The app SHALL render the indigo app header on every primary screen such that the header names the
current screen. Primary tab screens MUST show their screen name as the header title: Planen →
"Wochenplan", Rezepte → "Rezepte", Einstellungen → "Einstellungen". Tagebuch MUST show the
"forkcast" wordmark as its header title (the intentional home anchor) instead of a screen name.

The screen title MUST NOT be repeated as a heading (`h1` or visually equivalent) in the scroll
body — the header is the single place the screen is named.

The Tagebuch and Wochenplan headers continue to carry their existing date/week navigation and
totals/rollup blocks inside the header; those blocks are governed by their own capabilities and
are unchanged by this requirement.

#### Scenario: Rezepte names itself in the header

- **WHEN** the user opens the Rezepte tab
- **THEN** the app header shows the title "Rezepte" and the scroll body contains no "Rezepte" heading

#### Scenario: Einstellungen names itself in the header

- **WHEN** the user opens the Einstellungen tab
- **THEN** the app header shows the title "Einstellungen" and the scroll body contains no
  "Einstellungen" heading (body section headings like "Ernährungsziel" are unaffected)

#### Scenario: Wochenplan names itself in the header

- **WHEN** the user opens the Planen tab
- **THEN** the app header shows the title "Wochenplan" together with the week navigation and
  week-level rollups, and the scroll body contains no "Wochenplan" heading

#### Scenario: Tagebuch keeps the wordmark

- **WHEN** the user opens the Tagebuch tab
- **THEN** the app header shows the "forkcast" wordmark (not "Tagebuch") together with the date
  navigation and day-totals block

### Requirement: Sub-screen header shows a back arrow, the entity title, and an optional subtitle

Sub-screens (Recipe Detail and Recipe Editor) SHALL use the same indigo app header with: a **white
back-arrow icon button** on the left edge of the header, the **entity title** to its right (the
recipe name on Detail; "Neues Rezept" / "Rezept bearbeiten" on the Editor), and an optional
subtitle line below the title (Detail shows "Ergibt {N} Portionen"). A long title MUST wrap inside
the header rather than truncate or overlap the arrow.

The entity title MUST NOT be repeated as a heading in the scroll body. The back arrow's navigation
semantics (return to list / cancel the editor) are governed by the `recipes` capability.

#### Scenario: Recipe detail header carries title and subtitle

- **WHEN** the user opens a recipe with name "Hähnchen mit Salz" and `yield = 4` in read mode
- **THEN** the app header shows a white back arrow, the title "Hähnchen mit Salz", and the subtitle
  "Ergibt 4 Portionen", and the scroll body contains no heading with the recipe name

#### Scenario: Recipe editor header carries the mode title

- **WHEN** the user opens the Recipe Editor for an existing recipe
- **THEN** the app header shows a white back arrow and the title "Rezept bearbeiten", and the
  scroll body contains no "Rezept bearbeiten" heading

#### Scenario: Long recipe name wraps inside the header

- **GIVEN** a recipe whose name exceeds one header line at mobile width
- **WHEN** the user opens it in read mode
- **THEN** the header title wraps to additional lines inside the header and the back arrow remains
  aligned with the first line
