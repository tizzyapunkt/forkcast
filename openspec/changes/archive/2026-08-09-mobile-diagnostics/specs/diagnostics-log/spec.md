# diagnostics-log

## ADDED Requirements

### Requirement: Bounded in-memory diagnostics log
The backend SHALL keep diagnostics entries in a bounded in-memory ring buffer. When the buffer is full, recording a new entry SHALL evict the oldest one. Each entry SHALL carry a timestamp, a kind (`http`, `error`, or `off`), a message, and an optional detail string.

#### Scenario: Buffer evicts oldest entries at capacity
- **WHEN** more entries than the buffer capacity have been recorded
- **THEN** reading the log returns exactly the most recent `capacity` entries in chronological order, with the oldest entries gone

### Requirement: HTTP requests are recorded
The backend SHALL record every handled HTTP request as an entry containing the method, path, response status, and duration. Requests to the debug-logs endpoint itself SHALL NOT be recorded.

#### Scenario: Successful request is recorded
- **WHEN** an API request completes with status 200
- **THEN** the diagnostics log contains an `http` entry with the request's method, path, status `200`, and duration

#### Scenario: Rejected request is recorded
- **WHEN** an API request is rejected by the auth middleware with status 401
- **THEN** the diagnostics log contains an `http` entry with status `401`

#### Scenario: Debug-logs polling is not self-recorded
- **WHEN** `GET /debug/logs` is called
- **THEN** no `http` entry for that request is added to the diagnostics log

### Requirement: Handler errors are recorded
When a request handler throws, the backend SHALL record an `error` entry containing the error message and stack trace, and the error SHALL still propagate to the normal error response.

#### Scenario: Thrown error is captured
- **WHEN** a request handler throws an error
- **THEN** the diagnostics log contains an `error` entry with the error's message, and the client still receives an error response

### Requirement: Outbound Open Food Facts calls are recorded
The backend SHALL record every outbound Open Food Facts call as an `off` entry containing the operation (search or barcode), the response status or failure reason, and the duration. On a non-ok response, the entry detail and the thrown error message SHALL include a snippet (up to 300 characters) of the response body.

#### Scenario: Successful OFF search is recorded
- **WHEN** an Open Food Facts search completes with status 200
- **THEN** the diagnostics log contains an `off` entry with the operation, status `200`, and duration

#### Scenario: Failed OFF call records and surfaces the body snippet
- **WHEN** an Open Food Facts call returns a non-ok status with an explanatory body (e.g. a proxy block page)
- **THEN** the `off` entry's detail includes a snippet of that body, and the error thrown to the caller includes the same snippet in its message

#### Scenario: Network failure is recorded
- **WHEN** an Open Food Facts call fails without a response (timeout or network error)
- **THEN** the diagnostics log contains an `off` entry naming the failure reason

### Requirement: Debug-logs query endpoint
The backend SHALL expose `GET /debug/logs` behind the standard auth middleware, returning the buffered entries oldest-first as `{ "entries": [...] }`.

#### Scenario: Authenticated fetch returns entries
- **WHEN** `GET /debug/logs` is called with a valid session
- **THEN** the response is `200` with a JSON body containing the recorded entries in chronological order

#### Scenario: Unauthenticated fetch is rejected
- **WHEN** `GET /debug/logs` is called without a valid session
- **THEN** the response is `401`
