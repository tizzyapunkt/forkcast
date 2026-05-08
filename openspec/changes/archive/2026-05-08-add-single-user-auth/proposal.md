## Why

forkcast is deployed on the open web with no access control, meaning anyone who discovers the URL can read and modify meal plans, recipes, and nutrition data. Since this is a single-owner personal app, a minimal but real authentication gate is needed before it's safe to use in production.

## What Changes

- A login screen guards all frontend routes — unauthenticated requests are redirected to `/login`
- The backend validates a session token on every API request, rejecting unauthorized access with `401`
- A static password (configured via environment variable) is the single credential; no user management UI
- Sessions are persisted via an HTTP-only cookie containing a signed JWT so the user stays logged in across page reloads
- A logout action clears the session cookie

## Capabilities

### New Capabilities

- `single-user-auth`: Guards the app behind a password login. Issues a signed JWT session cookie on success, validates it on every backend API call, and provides a logout action. No registration or multi-user support — one password, configured via `AUTH_PASSWORD` env var.

### Modified Capabilities

<!-- none -->

## Impact

- **Backend**: New `/auth/login` and `/auth/logout` endpoints; middleware applied to all existing API routes to validate the session cookie
- **Frontend**: New `/login` route and page; React Query auth state; route guard wrapping the app shell; logout button in the UI
- **Config**: `AUTH_PASSWORD` and `AUTH_JWT_SECRET` env vars required on the server
- **Dependencies**: `jsonwebtoken` (or equivalent) added to backend for JWT signing/verification
