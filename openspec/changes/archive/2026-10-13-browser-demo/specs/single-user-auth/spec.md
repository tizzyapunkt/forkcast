## MODIFIED Requirements

### Requirement: Frontend guards all views behind authentication
The frontend SHALL check authentication state on load. If the session is invalid or absent, it SHALL render only the login page. All app views (log, recipes, settings) SHALL be inaccessible without a valid session. The demo build is the exception: it has no login and renders the app directly (per `demo-mode`).

#### Scenario: Unauthenticated page load
- **WHEN** a user opens the app without a valid session
- **THEN** only the login page is rendered; no app content or navigation is visible

#### Scenario: Authenticated page load
- **WHEN** a user opens the app with a valid session cookie
- **THEN** the full app shell is rendered immediately without a redirect

#### Scenario: Session expiry during use
- **WHEN** an API request returns `401` during an active session (e.g. token expired)
- **THEN** the app transitions to the login page without requiring a full page reload

#### Scenario: Demo build
- **WHEN** a visitor opens the demo build
- **THEN** the app shell is rendered without a login page
