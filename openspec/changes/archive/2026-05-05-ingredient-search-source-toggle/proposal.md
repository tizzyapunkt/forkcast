## Why

The BLS database covers the vast majority of whole-food searches without needing a network call, making it faster and more reliable. Open Food Facts adds value for packaged/branded products, but adds latency and external dependency on every search — the toggle lets us default to BLS-only while making OFF opt-in to experiment with what we're missing.

## What Changes

- The `/search-ingredients` endpoint accepts a new optional `sources` query parameter that controls which sources (BLS, OFF, or both) are queried per request
- The frontend `SearchPanel` gains a small toggle to enable/disable Open Food Facts; default is **disabled** (BLS only)
- The frontend `useSearchIngredients` hook and API client forward the `sources` preference to the backend
- The `CompositeIngredientSearchService` respects the requested source set and skips disabled sources entirely (no fan-out, no wasted network call)

## Capabilities

### New Capabilities

- `ingredient-search-source-toggle`: Per-request source selection for ingredient search — backend accepts a `sources` param, frontend exposes a toggle defaulting to BLS-only, composite service skips sources not in the requested set

### Modified Capabilities

- `bls-ingredient-source`: The composite search requirement changes — sources are no longer always fanned out in parallel; OFF is only queried when explicitly included in the request

## Impact

- **Backend**: `CompositeIngredientSearchService`, `search-ingredients` HTTP handler — new `sources` param routing logic
- **Frontend**: `search-ingredients` API client, `useSearchIngredients` hook, `SearchPanel` component — toggle UI state + param forwarding
- **No new dependencies** — uses existing BLS and OFF services, no schema/persistence changes
