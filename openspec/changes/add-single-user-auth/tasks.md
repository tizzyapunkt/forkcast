## 1. Backend: Dependencies & Environment

- [x] 1.1 Add `jose` to backend dependencies (`pnpm --filter @forkcast/backend add jose`)
- [x] 1.2 Add env var validation at startup in `src/index.ts` — crash with a clear error if `AUTH_PASSWORD` or `AUTH_JWT_SECRET` are missing or empty

## 2. Backend: Auth Domain

- [x] 2.1 Create `src/domain/auth/auth.service.ts` — expose `verifyPassword(input, expected)` using `crypto.timingSafeEqual` and `signSession(secret)` / `verifySession(token, secret)` using `jose`
- [x] 2.2 Write unit tests for `auth.service.ts` covering correct/wrong password, valid/expired/tampered JWT

## 3. Backend: Auth HTTP Handlers

- [x] 3.1 Create `src/http/auth/login.handler.ts` — `POST /auth/login` reads `password` from body, verifies, sets `HttpOnly; SameSite=Strict` cookie on success, returns `400` for missing field, `401` for wrong password
- [x] 3.2 Create `src/http/auth/logout.handler.ts` — `POST /auth/logout` sets `Max-Age=0` cookie and returns `200`
- [x] 3.3 Create `src/http/auth/me.handler.ts` — `GET /auth/me` validates session cookie and returns `200` or `401`
- [x] 3.4 Write integration tests for all three auth handlers

## 4. Backend: Auth Middleware & Wiring

- [x] 4.1 Create `src/http/auth/auth.middleware.ts` — Hono middleware that reads the session cookie, verifies the JWT, and calls `next()` or returns `401`
- [x] 4.2 Register auth routes (`/auth/login`, `/auth/logout`, `/auth/me`) in `src/index.ts` **before** the middleware
- [x] 4.3 Register `authMiddleware` with `app.use('*', authMiddleware)` after the auth routes in `src/index.ts`
- [x] 4.4 Write a middleware integration test confirming protected routes return `401` without a cookie and `200` with a valid one

## 5. Frontend: Auth API & Hook

- [x] 5.1 Create `src/api/auth.ts` — `checkSession()` (`GET /auth/me`), `login(password)` (`POST /auth/login`), `logout()` (`POST /auth/logout`)
- [x] 5.2 Create `src/features/auth/use-auth.ts` — React Query hook for `checkSession`; expose `isAuthenticated`, `isLoading`, `login`, `logout`
- [x] 5.3 Configure React Query global `onError` (or `useEffect` on query errors) to detect `401` responses from any query and transition auth state to unauthenticated

## 6. Frontend: Login Page

- [x] 6.1 Create `src/features/auth/login-page.tsx` — password field, submit button, error message on `401`, loading state during submission
- [x] 6.2 Write RTL tests for `LoginPage`: renders form, shows error on wrong password, shows app on success (using MSW handlers for `/auth/login`)

## 7. Frontend: Auth Guard

- [x] 7.1 Create `src/features/auth/auth-guard.tsx` — renders `<LoginPage>` while loading or unauthenticated, renders children when authenticated
- [x] 7.2 Wrap `<App />` with `<AuthGuard>` in `src/main.tsx`
- [x] 7.3 Write RTL tests for `AuthGuard`: unauthenticated → login page; authenticated → app content; `401` from API during session → login page

## 8. Frontend: Logout UI

- [x] 8.1 Add a logout button to `src/features/settings/settings-screen.tsx` that calls `logout()` from `use-auth.ts` and clears React Query cache on success
- [x] 8.2 Write an RTL test confirming the logout button triggers `POST /auth/logout` and transitions the UI to the login page
