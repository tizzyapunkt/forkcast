# mobile-diagnostics — tasks

## 1. Backend: diagnostics domain + middleware

- [x] 1.1 TDD `DiagnosticsLog` ring buffer in `backend/src/domain/diagnostics/` (record, recent, eviction at capacity, `DiagnosticsRecorder` port)
- [x] 1.2 TDD `makeRequestLogMiddleware` in `backend/src/http/diagnostics/` (records method/path/status/duration, records thrown errors with stack and rethrows, skips `/debug/logs`)
- [x] 1.3 TDD `makeGetDebugLogsHandler` returning `{ entries }` oldest-first

## 2. Backend: OFF instrumentation + error body snippet

- [x] 2.1 TDD `OpenFoodFactsService` changes: optional injected recorder, one `off` entry per call (operation, status/failure reason, duration), body snippet (≤300 chars) in both entry detail and thrown error message on non-ok responses
- [x] 2.2 Wire everything in `index.ts`: shared `DiagnosticsLog`, request middleware before auth, `GET /debug/logs` after auth, recorder into `OpenFoodFactsService`

## 3. Frontend: client capture

- [x] 3.1 TDD `features/diagnostics/client-log.ts`: bounded buffer, `installClientDiagnostics()` wrapping console.error/warn (call-through, re-entrancy guard) + window `error`/`unhandledrejection` listeners
- [x] 3.2 TDD failed-API-call recording in `api/client.ts` (`fetchJson` records non-ok status and network failures with path)
- [x] 3.3 Install capture from `main.tsx`

## 4. Frontend: Diagnose screen

- [x] 4.1 TDD `fetchDebugLogs` API module + query
- [x] 4.2 TDD diagnostics view: client + server sections with timestamps, manual server refresh, server-fetch error state
- [x] 4.3 TDD copy bundle: plain-text document (app context header, client section, server section), clipboard write, visible success confirmation
- [x] 4.4 Add "Diagnose" entry to the Settings screen following the existing sub-view pattern; i18n strings

## 5. Verify

- [x] 5.1 `make check` green
- [x] 5.2 `make smoke` green; manual curl of `/debug/logs` shows request + OFF entries after a search
