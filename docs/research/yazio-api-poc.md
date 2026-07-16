# Research: YAZIO API as ingredient-search source (PoC assessment)

**Date:** 2026-07-16
**Question:** Is a PoC worth it to move from Open Food Facts (OFF) to the reverse-engineered YAZIO API, given OFF's recent unreliability?

**Verdict: Yes — but as an *additional* source behind the existing `IngredientSearchService` port, not as a replacement.** The PoC is cheap (the port is two methods, the composite already handles multi-source merging and per-source failure), the data-quality upside for German products is real, but the unofficial API is a legal/stability dead end as a *sole* dependency for a project that wants to stay productizable.

---

## 1. Context in this codebase

- OFF sits behind the `IngredientSearchService` port (`searchByName`, `searchByBarcode`) in
  `backend/src/infrastructure/ingredient-search/open-food-facts.service.ts`.
- `CompositeIngredientSearchService` already fans out to `FOODS | USER | SCAN | OFF` via
  `Promise.allSettled`, tolerates individual source failures, and the frontend has a source
  toggle. Adding a `YAZIO` source is structurally trivial.
- OFF pain is documented in-repo: the classic full-text search endpoints (`cgi/search.pl`,
  `/api/v2/search`) are permanently offline; search only exists on the separate
  Search-a-licious service (beta, moving target). A migration to an own Search-a-licious
  client was merged and reverted (commits `5c2a750` / `28ce2bf`). The pinned SDK is
  `2.0.0-alpha.30` — itself an alpha.

## 2. What the reverse-engineered YAZIO API offers

There is **no official YAZIO API**. The community has documented the private app API:

| Repo | What it is | State |
|---|---|---|
| [saganos/yazio_public_api](https://github.com/saganos/yazio_public_api) | Swagger for API **v15** (`https://yzapi.yazio.com/v15`), MIT | Stale, no barcode endpoint documented |
| [juriadams/yazio](https://github.com/juriadams/yazio) | Zero-dependency TS client (`yazio` on npm): oauth, products, user, diary | Active-ish, single maintainer, **no license file visible**, "docs following shortly" |
| [fliptheweb/yazio-mcp](https://github.com/fliptheweb/yazio-mcp) | MCP server on top of juriadams/yazio | Active (v0.0.14, June 2026) |
| [controlado/go-yazio](https://github.com/controlado/go-yazio) | Go client | — |
| [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) (`SparkyFitnessServer/integrations/yazio/yazioService.ts`) | **Production integration as external food provider**, incl. barcode workaround | Shipped 2026, best real-world reference |

### Auth

- OAuth2 **password grant** against `POST /oauth/token`: the YAZIO app's `client_id`/`client_secret`
  (extracted from the app, hardcoded in every community client) **plus a real YAZIO user account**
  (free account works). Token caching + refresh needed (SparkyFitness: 60s expiry skew,
  inflight dedup).

### Endpoints (current integrations use **v18**: `https://yzapi.yazio.com/v18`)

- `GET /products/search?query=…&countries=…&locales=…` — name search; returns `product_id`,
  `name`, `producer`, `score`, `is_verified`, serving info, and a compact `nutrients` object.
- `GET /products/{id}` — full detail: ~24 nutrients, `servings[]`, `base_unit`, **`eans[]`**,
  `is_verified`, `countries`, `language`.
- Nutrients are keyed `energy.energy`, `nutrient.protein`, `nutrient.carb`, `nutrient.fat`, …
  and are **per gram** (SparkyFitness applies a heuristic to detect per-gram vs per-serving
  payloads and rescales). Mapping to `MacrosPerUnit` per 100 g is straightforward (×100).

### Barcode — the weak spot

There is **no documented EAN lookup endpoint**. SparkyFitness fakes it: search with the EAN
string as `query`, take ≤20 candidates, fetch `/products/{id}` per candidate, filter by
`eans[]` (skipping 502s). That's an N+1 request pattern with no hit guarantee.
→ **Barcode should stay on OFF** (OFF's product-by-barcode endpoint is a static/stable API
and was *not* part of the outage problem — only full-text search was).

## 3. Assessment

### Pro YAZIO

- **Data quality for the German market** is the core upside: curated + verified entries
  (`is_verified`), clean serving definitions, far less junk/duplicate noise than OFF.
- Commercial infrastructure → de-facto good uptime (the app depends on it).
- Response shape maps cleanly onto `IngredientSearchResult` (incl. `servingSize`/`servingQuantity`).
- Effort is genuinely small: token client + search + detail mapping + tests ≈ 1–2 days.
  A plain-`fetch` adapter (like the reverted `SearchALiciousClient`) avoids depending on the
  unlicensed npm client.

### Contra / risks

1. **ToS & legal:** private API, app credentials extracted from the client, YAZIO's terms
   won't permit third-party access. Fine as a personal-use experiment; **a blocker for
   "become a product later"** (CLAUDE.md). OFF is ODbL open data — YAZIO data may not be
   redistributed at all.
2. **Breakage without notice:** version already moved v15 → v18; every community client
   carries a "may stop working at any time" disclaimer. Account bans are a plausible
   failure mode.
3. **Requires a YAZIO account** + secret management (env vars in `backend/.env`).
4. **No barcode endpoint** (see above).
5. Unknown rate limits → needs polite client behavior (timeout, backoff, maybe result caching).

### Alternatives for the actual problem (OFF downtime)

- **Keep OFF for barcode** (unaffected by the search outage) and treat YAZIO as the
  name-search source — this is the natural split.
- **Local OFF mirror**: OFF publishes full dumps/Parquet; a German-filtered slice behind the
  existing port would fix uptime *and* stay ODbL-clean. More effort (ETL + storage), but the
  clean long-term fix if productization gets serious.
- fddb has no public API; USDA FDC is US-centric; Nutritionix is paid/US. No better German
  source exists openly.

## 4. Recommended PoC scope

1. `YazioIngredientSearchService` implementing `IngredientSearchService` — plain `fetch`,
   no SDK dependency, 8s timeout, diagnostics recorder entries (mirroring the OFF service).
2. OAuth password-grant token client with cached refresh; credentials via `backend/.env`
   (`YAZIO_USERNAME`, `YAZIO_PASSWORD`, `YAZIO_CLIENT_ID`, `YAZIO_CLIENT_SECRET`) —
   service disabled when unset.
3. Add `YAZIO` to `IngredientResultSource` + composite + frontend source toggle.
4. `searchByBarcode` → not implemented (return `null` / keep OFF).
5. Success criteria: side-by-side search quality on ~20 typical German queries
   (Quark, Skyr, Aldi/Lidl products, …) vs OFF; measure latency and hit relevance.
6. Explicitly mark the source as experimental/best-effort in code comments and README.

**Exit strategy stays cheap:** everything hides behind the existing port; if YAZIO breaks or
objects, delete one adapter.
