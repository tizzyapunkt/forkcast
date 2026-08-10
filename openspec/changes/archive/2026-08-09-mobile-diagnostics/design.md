# mobile-diagnostics — design

## Context

The PWA runs on a phone with no devtools; the backend runs on a server whose stdout is unreachable on the go. Today the only error surfacing is whatever a feature happens to render (e.g. the search error state added in #16), and even that collapses detail — `OpenFoodFactsService` throws `403 Forbidden` and discards the response body that would explain *who* sent the 403 (OFF itself, a proxy, an egress filter). The debugging loop we want: open the app on the phone → Settings → Diagnose → copy bundle → paste into Claude Code mobile.

## Goals / Non-Goals

**Goals:**

- Recent backend activity (requests, errors, outbound OFF calls) retrievable from the phone through the app itself.
- Client-side errors captured without opening devtools.
- One-tap export of everything as a paste-ready text bundle.
- Zero new dependencies, zero persistence infrastructure.

**Non-Goals:**

- No log persistence across backend restarts or page reloads (in-memory buffers only — the window of "what just went wrong" is what matters).
- No log levels/filtering UI, no live tail/streaming, no remote log drain.
- No automatic error reporting/telemetry — the user pulls, nothing pushes.

## Decisions

### 1. Ring buffer as a domain module, recorder as a port

`DiagnosticsLog` lives in `backend/src/domain/diagnostics/` — a plain class with `record(entry)` / `recent()`, bounded at 500 entries, no framework imports. The domain also defines the `DiagnosticsRecorder` port (just `record`). `OpenFoodFactsService` takes an optional recorder; HTTP middleware and the query handler live in `http/diagnostics/` as adapters. This keeps hexagonal boundaries: infrastructure depends on the domain port, never the reverse.

*Alternative considered*: a global singleton logger. Rejected — untestable wiring and hidden coupling for no gain; `index.ts` already does constructor injection everywhere.

Entry shape (kept flat for easy text rendering):

```ts
{ at: string /* ISO */, kind: 'http' | 'error' | 'off', message: string, detail?: string }
```

### 2. Request logging via Hono middleware, mounted before auth

`makeRequestLogMiddleware(recorder)` records `METHOD /path → status (Nms)` after `next()` and records thrown errors (message + stack) as `kind: 'error'` before rethrowing. Mounted **before** the auth middleware so 401s and login failures are visible — those are exactly the "why doesn't the app work" cases. Entries for `GET /debug/logs` itself are skipped to avoid the viewer polluting what it views.

### 3. `GET /debug/logs` behind the existing auth middleware

Returns `{ entries: [...] }` (oldest → newest). Registered after `app.use('*', makeAuthMiddleware(...))` like every other protected route. No pagination — the buffer is small and bounded.

### 4. OFF calls get first-class instrumentation + body snippet in errors

The service records one entry per outbound call (endpoint label, status, duration). On a non-ok response it reads up to ~300 chars of the body and puts the snippet in **both** the diagnostics entry and the thrown error message (`Open Food Facts request failed: 403 Forbidden — Host not in allowlist…`). The composite search already propagates these messages to the UI, so the snippet reaches the user even without opening the Diagnose screen. Reading the body is safe: the SDK hands us the raw `Response` and nothing else consumes it on the error path.

### 5. Frontend capture is a module singleton installed at startup

`lib/client-log.ts` (pure infrastructure, no React — the screen lives in `features/diagnostics/`): bounded array (200 entries), `installClientDiagnostics()` called once from `main.tsx` — wraps `console.error`/`console.warn` (call-through, never swallow) and adds `window` listeners for `error` and `unhandledrejection`. `fetchJson` records failed API calls (path, status/network error) via a tiny import — no signature change for callers.

*Alternative considered*: an off-the-shelf in-page console (eruda). Rejected — heavyweight dependency, alien UI, and it can't show backend logs, which are the harder half of the problem.

### 6. Diagnose screen is a Settings sub-view; copy produces one text bundle

Follows the existing settings-screen composition pattern (like `user-foods-panel`). Server entries come via React Query (`refetchOnWindowFocus: false`, manual refresh button). "Diagnose kopieren" builds one plain-text bundle — app context (URL, user agent, time), client entries, server entries, each as `HH:MM:SS [kind] message — detail` lines — and writes it with `navigator.clipboard.writeText`. Plain text beats JSON here: the consumer is a chat prompt, not a machine.

## Risks / Trade-offs

- [Buffer lost on backend restart] → acceptable: the failure being debugged usually recurs; reproduce, then copy.
- [Client buffer lost on page reload after a crash] → server-side request/error log still has the API half; revisit sessionStorage persistence only if this bites in practice.
- [Log content is user-visible via clipboard] → entries deliberately contain no secrets: no request bodies, no cookies/headers — only method, path, status, durations, error messages.
- [`console.warn` wrap could recurse if the recorder itself warns] → recorder never logs; wrap has a re-entrancy guard.
