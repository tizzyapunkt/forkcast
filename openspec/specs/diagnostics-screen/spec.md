# diagnostics-screen

## Purpose

Put the evidence in the user's hand on the device where the failure happened. A PWA on a phone exposes no console, so a client-side error is invisible and unreportable. The frontend captures its own bounded buffer of console errors, uncaught errors, unhandled rejections, and failed API calls; a Diagnose screen under Settings shows those alongside the backend entries from the `diagnostics-log` capability; and a single copy action produces one paste-ready text bundle — app context, client log, server log — designed to be dropped straight into a Claude Code mobile chat.

## Requirements

### Requirement: Client-side diagnostics capture
The frontend SHALL capture into a bounded in-memory buffer: `console.error` and `console.warn` calls, uncaught window errors, unhandled promise rejections, and failed API calls (path plus HTTP status or network-failure reason). Wrapped console methods SHALL still invoke the original console behavior. When the buffer is full, the oldest entry SHALL be evicted.

#### Scenario: console.error is captured and passed through
- **WHEN** application code calls `console.error("boom")`
- **THEN** the client diagnostics buffer contains an entry with the message, and the original `console.error` is still invoked

#### Scenario: Failed API call is captured
- **WHEN** an API request fails (non-ok status or network error)
- **THEN** the buffer contains an entry with the request path and the status or failure reason

#### Scenario: Unhandled rejection is captured
- **WHEN** a promise rejects with no handler
- **THEN** the buffer contains an entry describing the rejection reason

#### Scenario: Buffer stays bounded
- **WHEN** more entries than the buffer capacity are captured
- **THEN** only the most recent `capacity` entries remain, in chronological order

### Requirement: Diagnose screen in Settings
The Settings screen SHALL offer a "Diagnose" entry that opens a diagnostics view showing the captured client entries and the backend entries fetched from `GET /debug/logs`, each with timestamp and message. The view SHALL provide a manual refresh for the backend entries and SHALL show an error state (not fail silently) when fetching backend entries fails.

#### Scenario: Viewing diagnostics
- **WHEN** the user opens Settings → Diagnose
- **THEN** the view lists captured client entries and fetched backend entries with their timestamps

#### Scenario: Backend log fetch fails
- **WHEN** `GET /debug/logs` returns an error
- **THEN** the view shows an error state for the server section while the client entries remain visible

### Requirement: Copy diagnostics bundle
The diagnostics view SHALL provide a "Diagnose kopieren" action that copies a single plain-text bundle to the clipboard containing: app context (current URL, user agent, timestamp), the client entries, and the most recently fetched backend entries. The action SHALL confirm success visibly.

#### Scenario: Copying the bundle
- **WHEN** the user taps "Diagnose kopieren"
- **THEN** the clipboard contains one plain-text document with an app-context header, a client-log section, and a server-log section, and the UI confirms the copy
