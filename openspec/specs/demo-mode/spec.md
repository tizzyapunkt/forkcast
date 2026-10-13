# demo-mode Specification

## Purpose

Lets anyone try forkcast in their browser without installing it, with no server holding their data: the real app runs entirely in the page, on believable sample data in the visitor's language.

## Requirements

### Requirement: The demo runs entirely in the browser
The demo build SHALL serve every API request the app makes from inside the page, using the same request handling as the self-hosted backend. It SHALL need no forkcast server: the demo is static files. No request for the visitor's data SHALL leave the browser.

#### Scenario: Using the demo without a backend
- **WHEN** a visitor opens the demo and logs a food, plans a recipe and opens the grocery list
- **THEN** each action works and no request goes to a forkcast server

### Requirement: Demo data stays in the visitor's browser
The demo SHALL store its data in the visitor's browser only, separately for each browser. The data SHALL survive a reload and SHALL NOT be visible to other visitors.

#### Scenario: Reload keeps the data
- **WHEN** a visitor logs a food in the demo and reloads the page
- **THEN** the logged food is still there

#### Scenario: Another browser starts fresh
- **WHEN** a second visitor opens the demo in another browser
- **THEN** they see freshly seeded sample data, not the first visitor's changes

### Requirement: First visit seeds sample data in the visitor's language
On a visit with no demo data, the demo SHALL seed sample data before showing the app: a nutrition goal, weight entries, recipes and a planned current week, with food and recipe names in the active UI language (English or German). The catalog SHALL be the same starting catalog a fresh self-hosted install gets.

#### Scenario: English browser
- **WHEN** a visitor whose browser language is English opens the demo for the first time
- **THEN** the app shows the current week planned, with English food and recipe names

#### Scenario: German browser
- **WHEN** a visitor whose browser language is German opens the demo for the first time
- **THEN** the app shows the current week planned, with German food and recipe names

### Requirement: First visit explains the demo
On the first visit in a browser, the demo SHALL show a disclaimer before the visitor uses the app. It SHALL say that this is a demo running locally in the browser, that the data stays in this browser, and that features which need a server are turned off. It SHALL name those features. Once dismissed, it SHALL NOT appear again in that browser, including after a reset.

#### Scenario: First visit
- **WHEN** a visitor opens the demo in a browser for the first time
- **THEN** the disclaimer is shown, naming the turned-off features, and the visitor can dismiss it to use the app

#### Scenario: Later visits
- **WHEN** a visitor who dismissed the disclaimer reloads the demo or resets it
- **THEN** the disclaimer is not shown again

### Requirement: The demo says it is a demo and can be reset
The demo SHALL show a banner on every screen saying it is a demo whose data stays in this browser. The banner SHALL offer a reset that discards all demo data and seeds fresh sample data in the active language.

#### Scenario: Banner is visible
- **WHEN** a visitor opens any screen of the demo
- **THEN** the demo banner is visible

#### Scenario: Reset
- **WHEN** a visitor has changed demo data and chooses reset in the banner
- **THEN** the app shows freshly seeded sample data and the visitor's changes are gone

### Requirement: Switching language offers a reset in the new language
When the active UI language differs from the language the demo data was seeded in, the banner SHALL offer to reset the demo in the active language. Until the visitor chooses it, the existing data SHALL stay unchanged.

#### Scenario: Switch from German to English
- **WHEN** the demo was seeded in German and the visitor switches the UI language to English
- **THEN** the banner offers "Reset demo in English", and the German sample data stays until the visitor chooses it

#### Scenario: Reset in the new language
- **WHEN** the visitor chooses the offered reset in English
- **THEN** the demo is seeded again with English names and the offer disappears

### Requirement: The demo has no login
The demo SHALL open straight into the app, without a login page, and SHALL show no logout action.

#### Scenario: Opening the demo
- **WHEN** a visitor opens the demo
- **THEN** the app is shown without asking for a password, and Settings has no logout button

### Requirement: Features that need a server or an API key are hidden
The demo SHALL hide every feature that needs an AI key or a public server: recipe import from photos, product capture from photos, AI fill in the catalog editor, AI resolution of unmatched ingredients, sending the grocery list to Bring!, and the diagnostics screen. Everything else SHALL work as in the self-hosted app.

#### Scenario: Recipes screen
- **WHEN** a visitor opens the recipes screen in the demo
- **THEN** there is no action to import a recipe from photos

#### Scenario: Grocery list
- **WHEN** a visitor opens the grocery list in the demo
- **THEN** copying the list works and there is no Bring! action

#### Scenario: Catalog editor and settings
- **WHEN** a visitor opens the catalog editor and Settings in the demo
- **THEN** there is no AI fill button and no diagnostics link

### Requirement: Open Food Facts is queried from the visitor's browser
With the Open Food Facts source on, the demo SHALL send name searches and barcode lookups from the visitor's browser straight to Open Food Facts, without credentials or custom headers. When Open Food Facts cannot be reached or the browser blocks the request, the search SHALL still show catalog results.

#### Scenario: Barcode lookup
- **WHEN** a visitor scans or types a barcode Open Food Facts knows
- **THEN** the product is found, with the request sent from the visitor's browser

#### Scenario: Blocked Open Food Facts search
- **WHEN** a visitor searches with the catalog and Open Food Facts sources on and the Open Food Facts request fails
- **THEN** the catalog results are shown

### Requirement: The demo cannot be installed
The demo SHALL NOT offer installation as an app: it SHALL have no web app manifest and no service worker.

#### Scenario: Install prompt
- **WHEN** a visitor opens the demo in a browser that supports installing web apps
- **THEN** the browser offers no install of the demo

### Requirement: The demo is published with the website
The demo SHALL be published at `/demo/` on the website's host whenever the website is published, built from the same commit.

#### Scenario: Demo URL
- **WHEN** a visitor opens `https://check-forkcast.tizzy.dev/demo/`
- **THEN** the demo loads

### Requirement: The privacy policy covers the demo
The website's privacy policy in English and German SHALL state that the demo stores its data only in the visitor's browser and that Open Food Facts searches and barcode lookups go from the visitor's browser to Open Food Facts, which sees the visitor's IP address.

#### Scenario: Reading the privacy policy
- **WHEN** a visitor reads the privacy policy in English or German
- **THEN** it has a section on the demo covering browser storage and Open Food Facts requests
