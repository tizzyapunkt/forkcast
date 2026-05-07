## Context

forkcast is deployed publicly with no access control. All API routes and the frontend are open to anyone with the URL. The app has one owner (one user, forever). The backend is a plain Hono app (`src/index.ts`) with all routes defined flat — no middleware pipeline yet. The frontend is a React SPA with no routing library, currently rendering the full app unconditionally.

## Goals / Non-Goals

**Goals:**
- Block unauthenticated access to all API routes
- Redirect unauthenticated browser sessions to a login page
- Persist the authenticated session across page reloads and browser restarts
- Provide a logout action

**Non-Goals:**
- Multi-user support or registration
- Password change UI (env var is the source of truth)
- CSRF protection (out of scope for v1 — cookie is `SameSite=Strict`)
- Rate limiting on the login endpoint
- Remember-me / long-lived sessions (session cookie, expires on browser close)

## Decisions

### 1. HTTP-only cookie with signed JWT, not localStorage token

**Choice:** Signed JWT stored in an `HttpOnly; SameSite=Strict` cookie.

**Why over localStorage:** `HttpOnly` keeps the token out of JavaScript entirely, eliminating XSS token theft. `SameSite=Strict` prevents CSRF without needing a separate CSRF token.

**Why JWT over opaque session:** No server-side session store needed. The JWT payload carries `sub: "owner"` and an expiry. Verification is stateless — just re-sign with the secret and compare. Given a single user, revocation (logout) is done by clearing the cookie client-side; server-side blocklists are unnecessary.

**JWT secret:** `AUTH_JWT_SECRET` env var (minimum 32 chars enforced at startup). `AUTH_PASSWORD` env var holds the plaintext password to compare against.

**Token expiry:** 30 days. The user stays logged in until they explicitly log out.

### 2. Timing-safe password comparison, no bcrypt

**Choice:** `crypto.timingSafeEqual` (Node built-in) against the plaintext `AUTH_PASSWORD` env var.

**Why not bcrypt:** The password lives in an env var, not a database — there's no hash to store. Comparing env-var strings with timing-safe equality is safe and avoids adding a dependency. The threat model is remote guessing (mitigated by a strong password), not database exfiltration.

### 3. Hono middleware on all non-auth routes

**Choice:** Register a single `authMiddleware` on the Hono app before all existing route registrations. Auth routes (`POST /auth/login`, `POST /auth/logout`) are registered without the middleware.

**Why:** Minimal change to `index.ts` — drop in `app.use('*', authMiddleware)` after the auth routes. No need to refactor individual handlers.

**JWT library:** `jose` — it's a zero-dependency ESM-native library, avoiding the CommonJS interop issues of `jsonwebtoken`.

### 4. Frontend: React context + `useAuth` hook, no routing library

**Choice:** Wrap `<App />` with an `<AuthGuard>` component that calls `GET /auth/me` on mount. If the response is `401`, it renders `<LoginPage>` instead of the app shell. On success, renders children.

**Why not React Router:** The app has no URL-based routing today. Adding a routing library for one protected route is over-engineering.

**`GET /auth/me`:** A lightweight endpoint that returns `200` if the cookie is valid, `401` otherwise. React Query caches it; on `401` mutation from any query, the auth context transitions to `unauthenticated` and the guard re-renders with the login page.

### 5. Logout: server-side cookie clear

**Choice:** `POST /auth/logout` sets `Set-Cookie` with `Max-Age=0` to immediately expire the cookie, then the frontend invalidates all React Query caches and re-renders to the login page.

## Risks / Trade-offs

- **Single point of failure on env var** → If `AUTH_PASSWORD` or `AUTH_JWT_SECRET` are missing at startup, the app crashes immediately with a clear error message. No silent degradation.
- **No token revocation** → If the JWT secret changes (e.g. server redeploy with a new secret), existing tokens become invalid and the user must log in again. This is acceptable — it's a feature, not a bug.
- **30-day expiry with no refresh** → After 30 days the user is silently logged out on next visit. Acceptable for a personal app; the fix is just logging in again.
- **Plaintext password in env** → Standard 12-factor practice. The secret is in the environment, not the repo. The deployment must protect env vars appropriately.

## Migration Plan

1. Add `AUTH_PASSWORD` and `AUTH_JWT_SECRET` to the server environment before deploying
2. Deploy backend with auth middleware — existing sessions (none) are unaffected
3. Deploy frontend with `AuthGuard` — users are redirected to login
4. No data migration required

**Rollback:** Remove the `app.use('*', authMiddleware)` line and revert the frontend `AuthGuard` wrapper. No data is affected.
