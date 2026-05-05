## Context

The current `CompositeIngredientSearchService` always fans out to both BLS (local, in-memory) and Open Food Facts (external HTTP) in parallel on every name search. BLS covers whole foods well; OFF adds packaged products but introduces network latency and a hard external dependency. The user wants to experiment with BLS-only as the default and opt into OFF when needed, without restructuring the service layer significantly.

## Goals / Non-Goals

**Goals:**
- Add a `sources` query parameter to `GET /search-ingredients?q=...` that controls which sources are queried (`bls`, `off`, or both; default: `bls`)
- Add a persistent UI toggle in the `SearchPanel` that enables/disables OFF (stored in `localStorage`, default: disabled)
- Skip OFF entirely (no HTTP call) when it is not in the requested source set

**Non-Goals:**
- Per-user server-side settings or database-backed preferences
- Affecting barcode lookup (remains OFF-only, unchanged)
- Removing or deprecating the OFF service

## Decisions

### D1: Source selection via request-time query parameter, not a server flag

**Decision:** The frontend passes `?sources=bls` or `?sources=bls,off` on each search request. The backend validates and acts on it per-call.

**Alternatives considered:**
- Server-side feature flag / env var: would require a restart to change; no UI flexibility
- Filter results client-side: wastes the network call to OFF; doesn't save latency

**Rationale:** Keeps the toggle stateless on the backend, cheap to implement, and easy to extend (e.g., future sources). The source preference lives in `localStorage` on the frontend — no auth or user profile needed.

### D2: `sources` param is a comma-separated string, parsed into a `Set` in the handler

**Decision:** Accept `?sources=bls` or `?sources=bls,off`. Unknown values are ignored. If the param is absent or empty, default to `['bls']`.

**Rationale:** Simple string parsing, no new dependency. The handler owns validation; the composite service receives an explicit list of enabled sources.

### D3: `CompositeIngredientSearchService.searchByName` accepts an optional `sources` param

**Decision:** Extend `IngredientSearchService` port interface's `searchByName` signature to accept `sources?: Set<'BLS' | 'OFF'>`. When `sources` omits a provider, that provider is not queried.

**Alternatives considered:**
- Create a new port/adapter for the toggling logic: more ceremony than needed for this scope
- Constructor-inject a `sources` set and create a new composite per request: lifecycle complexity

**Rationale:** Minimal signature change. Leaf implementations (`InMemoryBlsService`, `OpenFoodFactsService`) ignore the parameter — it's only meaningful at the composite level.

### D4: Frontend stores the OFF toggle in `localStorage`

**Decision:** `SearchPanel` reads/writes a boolean `off-enabled` key in `localStorage`. Default is `false`.

**Rationale:** Persists across page reloads without any backend round-trip. Simple enough for a personal app; revisit if multi-device sync becomes relevant.

## Risks / Trade-offs

- **Interface change cascades** → All implementations of `IngredientSearchService` must accept (and ignore) the new optional param. Low risk given only 3 implementations exist (BLS, OFF, Composite).
- **Cache key mismatch** → React Query's `queryKey` must include the `sources` selection, otherwise toggling OFF won't re-fetch. Mitigated by including a `sources` identifier in the query key.
- **Default behaviour change** → The backend now defaults to BLS-only when `sources` is absent; any other clients (e.g., manual curl) will no longer get OFF results by default. Acceptable for a personal app with no external callers.

## Open Questions

- Should the toggle label show "Open Food Facts" in full or abbreviate to "OFF"? (UX detail, decide at implementation time)
- Should the `sources` default live in a shared constant (backend + frontend) or be documented only? (Keep it simple: document in code comment for now)
