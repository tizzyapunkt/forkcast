## ADDED Requirements

### Requirement: Login with password
The system SHALL authenticate the user by comparing a submitted password against the `AUTH_PASSWORD` environment variable using timing-safe comparison. On success, it SHALL issue a signed JWT stored in an `HttpOnly; SameSite=Strict` cookie. On failure, it SHALL return a `401` response without revealing whether the password was wrong.

#### Scenario: Correct password
- **WHEN** a `POST /auth/login` request is made with the correct password
- **THEN** the response is `200` with a `Set-Cookie` header containing an `HttpOnly; SameSite=Strict` JWT cookie valid for 30 days

#### Scenario: Wrong password
- **WHEN** a `POST /auth/login` request is made with an incorrect password
- **THEN** the response is `401` with no cookie set

#### Scenario: Missing password field
- **WHEN** a `POST /auth/login` request is made with no password in the body
- **THEN** the response is `400`

### Requirement: Protected API routes require valid session
All API routes (except `/auth/login` and `/auth/logout`) SHALL reject requests that do not carry a valid, unexpired session cookie.

#### Scenario: Request with valid session cookie
- **WHEN** an API request is made with a valid JWT session cookie
- **THEN** the request proceeds and returns the normal response

#### Scenario: Request with no session cookie
- **WHEN** an API request is made without a session cookie
- **THEN** the response is `401`

#### Scenario: Request with expired session cookie
- **WHEN** an API request is made with a JWT cookie whose expiry has passed
- **THEN** the response is `401`

#### Scenario: Request with tampered session cookie
- **WHEN** an API request is made with a JWT cookie whose signature does not verify against `AUTH_JWT_SECRET`
- **THEN** the response is `401`

### Requirement: Session verification endpoint
The system SHALL expose `GET /auth/me` that returns `200` if the caller has a valid session and `401` otherwise. No body is required in the `200` response.

#### Scenario: Authenticated check
- **WHEN** `GET /auth/me` is called with a valid session cookie
- **THEN** the response is `200`

#### Scenario: Unauthenticated check
- **WHEN** `GET /auth/me` is called without a valid session cookie
- **THEN** the response is `401`

### Requirement: Logout clears session
The system SHALL expose `POST /auth/logout` that clears the session cookie regardless of whether the request is authenticated.

#### Scenario: Logout while authenticated
- **WHEN** `POST /auth/logout` is called with a valid session cookie
- **THEN** the response is `200` and the `Set-Cookie` header sets `Max-Age=0` to expire the cookie

#### Scenario: Logout while unauthenticated
- **WHEN** `POST /auth/logout` is called without a session cookie
- **THEN** the response is `200` (idempotent)

### Requirement: Startup fails without required environment variables
The system SHALL refuse to start if `AUTH_PASSWORD` or `AUTH_JWT_SECRET` are absent or empty, logging a descriptive error and exiting with a non-zero code.

#### Scenario: Missing AUTH_PASSWORD
- **WHEN** the server starts without `AUTH_PASSWORD` set
- **THEN** it logs an error and exits immediately before accepting connections

#### Scenario: Missing AUTH_JWT_SECRET
- **WHEN** the server starts without `AUTH_JWT_SECRET` set
- **THEN** it logs an error and exits immediately before accepting connections

### Requirement: Frontend guards all views behind authentication
The frontend SHALL check authentication state on load. If the session is invalid or absent, it SHALL render only the login page. All app views (log, recipes, settings) SHALL be inaccessible without a valid session.

#### Scenario: Unauthenticated page load
- **WHEN** a user opens the app without a valid session
- **THEN** only the login page is rendered; no app content or navigation is visible

#### Scenario: Authenticated page load
- **WHEN** a user opens the app with a valid session cookie
- **THEN** the full app shell is rendered immediately without a redirect

#### Scenario: Session expiry during use
- **WHEN** an API request returns `401` during an active session (e.g. token expired)
- **THEN** the app transitions to the login page without requiring a full page reload

### Requirement: Frontend provides login form
The frontend SHALL render a login form with a password field and a submit action. On successful authentication it SHALL display the full app. On failure it SHALL display an error message.

#### Scenario: Successful login
- **WHEN** the user submits the correct password in the login form
- **THEN** the login page is replaced by the full app shell

#### Scenario: Failed login
- **WHEN** the user submits an incorrect password
- **THEN** an error message is shown and the login form remains visible

### Requirement: Frontend provides logout action
The frontend SHALL expose a logout action (e.g. in the Settings screen) that calls `POST /auth/logout`, clears client-side query cache, and returns the user to the login page.

#### Scenario: Logout
- **WHEN** the user triggers the logout action
- **THEN** the session cookie is cleared, all cached data is cleared, and the login page is shown
