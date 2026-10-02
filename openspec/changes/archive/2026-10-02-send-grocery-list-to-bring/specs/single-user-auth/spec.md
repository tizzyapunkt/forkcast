## MODIFIED Requirements

### Requirement: Protected API routes require valid session
All API routes (except `/auth/login` and `/auth/logout`) SHALL reject requests that do not carry a valid, unexpired session cookie. The one further exception is the Bring! import page (`GET /bring-import/{token}`). It is authorised by the import token in its path instead of a session (per `bring-import`) and serves nothing else. A Bring! import token MUST NOT be accepted as a session cookie on any route.

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

#### Scenario: Import page reachable without session
- **WHEN** `GET /bring-import/{token}` is requested with a valid import token and no session cookie
- **THEN** the request proceeds to the import page

#### Scenario: Import token rejected as a session
- **WHEN** a protected route is called with a Bring! import token as the session cookie
- **THEN** the response is `401`
