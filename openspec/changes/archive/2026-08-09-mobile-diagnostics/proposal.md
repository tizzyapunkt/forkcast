# mobile-diagnostics

## Why

Developing forkcast on the go (Claude Code mobile on iOS) is blind-flight today: the PWA exposes no browser console and the backend logs are unreachable from the phone. When something breaks in production — e.g. the current "Open Food Facts returns no data" mystery — there is no way to see what actually happened, neither for the user nor for a Claude Code session that only has the repo. Diagnosing requires a laptop, which defeats the mobile workflow.

## What Changes

- The backend keeps a bounded in-memory diagnostics log (ring buffer): every HTTP request (method, path, status, duration), every uncaught handler error (message + stack), and every outbound Open Food Facts call (endpoint, status, duration, and a response-body snippet on failure).
- A new auth-protected query endpoint returns the recent backend log entries as JSON.
- The frontend captures client-side evidence into its own bounded buffer: `console.error`/`console.warn` calls, uncaught errors, unhandled promise rejections, and failed API calls (path, status, error message).
- A new Diagnose screen (reachable from Settings) shows client and server logs and offers a "Diagnose kopieren" action that copies a single paste-ready text bundle (app context + client log + server log) to the clipboard — designed to be pasted into a Claude Code mobile chat.
- Open Food Facts error messages now include a snippet of the error response body (e.g. proxy/block pages), so a 403 is self-explanatory instead of opaque (implementation detail, covered by unit tests, no spec change).

## Capabilities

### New Capabilities

- `diagnostics-log`: backend in-memory diagnostics ring buffer (HTTP requests, errors, outbound Open Food Facts calls) and the auth-protected endpoint that exposes recent entries.
- `diagnostics-screen`: frontend capture of console/errors/failed API calls, the Diagnose screen in Settings, and the copy-diagnostics text bundle.

### Modified Capabilities

<!-- none — OFF error-message wording is not spec'd; screen-headers/bottom-navigation requirements are unchanged (Diagnose is a Settings sub-view, not a new tab) -->

## Impact

- **Backend**: new `diagnostics` domain module (ring buffer, no framework imports) + Hono middleware adapter in `http/`; `OpenFoodFactsService` gains an injected diagnostics recorder; new `GET /debug/logs` route behind the existing auth middleware; `index.ts` wiring.
- **Frontend**: new `features/diagnostics/` folder (capture module + screen), a small hook in `api/client.ts` to record failed calls, an entry point in the Settings screen, and a route in the app shell.
- **No new dependencies, no persistence** — the buffer is in-memory and resets on restart, which is fine for a diagnostics window.
