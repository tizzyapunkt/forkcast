# barcode-product-capture

## Purpose

When a barcode lookup misses, extract a product (name, unit, per-100 macros) from packaging photos via the AI vision setup, let the user review and edit it, persist it to a local store keyed by barcode, and resolve that barcode locally on future lookups. This replaces the `barcode-not-found` dead-end for products that are missing from Open Food Facts (common for local and store-brand products), without ever writing to the build-script-owned curated `foods.json` catalog.

## Requirements

### Requirement: Extract a product draft from packaging photos

The system SHALL expose a command that accepts a scanned `barcode` and an ordered, non-empty list of packaging photos, sends all photos to the vision model in a single call, and returns a product draft consisting of `barcode`, `name`, `unit` (`g` or `ml`), and `macrosPer100` (`calories`, `protein`, `carbs`, `fat`). The model reads the product name from the front of the package and the nutrition values from the per-100 column of the nutrition table.

The `barcode` MUST be a non-empty string; a request without it MUST be rejected with `400`. A request with zero images, or with more than the configured maximum number of images, MUST be rejected with `400`.

The command MUST NOT persist anything. The returned draft is intended for a follow-up review, edit, and save via the save-scanned-product command.

#### Scenario: Packaging photos yield a product draft
- **WHEN** a client sends `POST /extract-product-from-photos` with a barcode and a clear photo of a nutrition table that states `pro 100 g` values
- **THEN** the response is `200` with a draft carrying the submitted `barcode`, a non-empty `name`, `unit: "g"`, and a `macrosPer100` object with finite, non-negative `calories`, `protein`, `carbs`, and `fat`
- **AND** nothing is persisted as a side effect (the barcode does not become resolvable on a subsequent lookup)

#### Scenario: Liquid product reads per-100-ml basis
- **WHEN** the nutrition table states values `pro 100 ml`
- **THEN** the draft carries `unit: "ml"` and `macrosPer100` read from that column

#### Scenario: Missing barcode rejected
- **WHEN** a client sends `POST /extract-product-from-photos` with images but no `barcode` (or an empty one)
- **THEN** the response is `400` with an error indicating the barcode is required, and no call is made to the AI provider

#### Scenario: Empty image list rejected
- **WHEN** a client sends `POST /extract-product-from-photos` with `images: []`
- **THEN** the response is `400` with an error indicating at least one image is required

#### Scenario: Too many images rejected
- **WHEN** a client submits more images than the configured maximum
- **THEN** the response is `400` with an error indicating the maximum image count and the count submitted

### Requirement: Image size and media-type limits

The extract command SHALL reuse the recipe-import image limits: it MUST reject requests where any image exceeds the per-image byte limit, where the combined decoded size exceeds the total byte limit, or where any image's `mediaType` is not one of `image/jpeg`, `image/png`, or `image/webp`. Error responses MUST identify the offending image's index in the submitted array when applicable.

#### Scenario: Per-image size exceeded
- **WHEN** a client submits an image whose decoded size exceeds the per-image limit
- **THEN** the response is `413` with an error body that names the offending image's index

#### Scenario: Combined size exceeded
- **WHEN** a client submits images that individually fit under the per-image limit but together exceed the total limit
- **THEN** the response is `413` with an error indicating the total-size limit was exceeded

#### Scenario: Unsupported media type
- **WHEN** a client submits an image with `mediaType: "image/gif"`
- **THEN** the response is `400` with an error that names the offending image's index and the unsupported media type

### Requirement: Nutrition values are read, never invented

The product extractor's tool schema and system prompt SHALL require the model to transcribe the per-100 nutrition values exactly as printed and to read the product name from the package, without inventing values. The parser SHALL accept the tool output only when `name` is a non-empty string, `unit` is `g` or `ml`, and `calories` is a finite number ≥ 0; `protein`, `carbs`, and `fat` each default to `0` when the model omits them but MUST be finite and ≥ 0 when present. When the tool output fails these checks, the command MUST surface an extraction failure (see "Upstream AI errors are surfaced as bad-gateway").

#### Scenario: Name taken from the package front
- **WHEN** the front of the package reads "Himbeer-Heidelbeer-Mix" and the nutrition table is on the back
- **THEN** the draft `name` is the product name from the front, not a value copied from the nutrition table

#### Scenario: Macro absent on label defaults to zero
- **WHEN** the nutrition table shows energy and macronutrients but the model returns no `protein` value
- **THEN** the draft's `macrosPer100.protein` is `0` and the other read values are preserved

### Requirement: Configuration error returned when AI provider not configured

When `ANTHROPIC_API_KEY` is missing at startup, the extract endpoint SHALL return `503` with the stable error code `ai-import-not-configured` so the frontend can hide the capture entry point. The rest of the API MUST continue to function unchanged.

#### Scenario: Unconfigured backend
- **WHEN** the backend starts without `ANTHROPIC_API_KEY` and a client calls `POST /extract-product-from-photos`
- **THEN** the response is `503` with body containing `error: "ai-import-not-configured"`
- **AND** other endpoints continue to respond normally

### Requirement: Upstream AI errors are surfaced as bad-gateway

When the AI provider returns an error, times out, or returns a tool-call result that does not parse against the declared product schema, the extract command SHALL respond with `502` and include a stable error code in the body. The system MUST NOT retry automatically.

#### Scenario: Provider returns a 5xx
- **WHEN** the upstream Anthropic API returns a 5xx error
- **THEN** the response is `502` with a body indicating the upstream failure

#### Scenario: Tool result fails to parse
- **WHEN** the model's tool-call output cannot be parsed as the declared product schema (e.g. missing name, non-finite calories)
- **THEN** the response is `502` with a body indicating an extraction failure

### Requirement: Auth-protected like all other API routes

The extract and save endpoints SHALL require a valid session cookie just like every other protected route. Unauthenticated calls MUST be rejected with `401` before any image is forwarded to the AI provider and before any store mutation.

#### Scenario: Unauthenticated extract attempt
- **WHEN** `POST /extract-product-from-photos` is called without a valid session cookie
- **THEN** the response is `401` and no call is made to the AI provider

### Requirement: Observability of extract calls

For each successful extraction, the system SHALL log the model id, the number of images submitted, the input/output token counts reported by the provider, and the call duration. No image bytes, the barcode, or the extracted product name MAY be logged.

#### Scenario: Successful call observability
- **WHEN** an extract call succeeds
- **THEN** an info-level log line is emitted containing `model`, `imageCount`, `inputTokens`, `outputTokens`, and `durationMs`
- **AND** the log line does not contain image bytes, the barcode, or the product name

### Requirement: Persist a reviewed product to the local barcode store

The system SHALL expose a command `POST /save-scanned-product` that accepts `{ barcode, name, unit, macrosPer100 }`, validates it, and persists it to a runtime-writable local store keyed by `barcode`, recording a `capturedAt` timestamp. Saving a barcode that already exists in the store MUST overwrite the existing entry (upsert by barcode). The response MUST be the persisted product mapped to an `IngredientSearchResult` with `source: "SCAN"`, `unit` carried through, and `macrosPerUnit` equal to each `macrosPer100` value divided by 100 — the same per-unit convention used by the OFF and FOODS results — so the client can log it through the existing select path.

The store MUST NOT write to `foods.json`; the curated foods catalog stays build-script-owned and is untouched by this command.

A payload missing `barcode`, missing or blank `name`, with a `unit` other than `g`/`ml`, or with a non-finite/negative macro value MUST be rejected with `400`.

#### Scenario: Save returns a SCAN-sourced search result
- **WHEN** a client sends `POST /save-scanned-product` with `{ barcode: "4337256176103", name: "Himbeer-Heidelbeer-Mix", unit: "g", macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 } }`
- **THEN** the response carries an `IngredientSearchResult` with `id` equal to the barcode, `source: "SCAN"`, `name: "Himbeer-Heidelbeer-Mix"`, `unit: "g"`, and `macrosPerUnit: { calories: 0.54, protein: 0.009, carbs: 0.084, fat: 0.007 }`
- **AND** the product is now stored against that barcode

#### Scenario: Re-saving the same barcode overwrites
- **WHEN** a barcode already present in the store is saved again with corrected macros
- **THEN** the store holds exactly one entry for that barcode, carrying the corrected values

#### Scenario: Invalid payload rejected
- **WHEN** a client sends a save request with a blank `name`, a `unit` of `"kg"`, or a negative `calories`
- **THEN** the response is `400` and the store is not modified

### Requirement: Stored barcodes resolve on lookup

The barcode lookup SHALL consult the local scanned-products store before Open Food Facts. When the scanned barcode exists locally, the lookup MUST return the stored product as an `IngredientSearchResult` with `source: "SCAN"` without querying Open Food Facts. When the barcode is not in the local store, the lookup MUST fall back to Open Food Facts exactly as before; when neither source has it, the lookup MUST return the existing not-found result.

#### Scenario: Previously captured barcode resolves locally
- **GIVEN** a product was saved to the local store for barcode "4337256176103"
- **WHEN** a client looks up that barcode via `GET /search-ingredients/barcode/4337256176103`
- **THEN** the response is `200` with the stored product, `source: "SCAN"`
- **AND** Open Food Facts is not queried

#### Scenario: Unknown barcode falls back to Open Food Facts
- **WHEN** a barcode that is not in the local store is looked up and Open Food Facts has it
- **THEN** the response is the Open Food Facts product with `source: "OFF"`, unchanged from current behavior

#### Scenario: Barcode in neither source is not found
- **WHEN** a barcode is in neither the local store nor Open Food Facts
- **THEN** the response is `404`, unchanged from current behavior

### Requirement: Capture flow replaces the barcode not-found dead-end

When a barcode lookup misses, the ingredient search panel SHALL offer a "Photograph packaging" action instead of only a "try again" button. Choosing it opens photo capture (reusing the existing photo-staging pattern), submits the staged photos with the scanned barcode to the extract command, and on success presents an editable review of the extracted product. The capture entry point MUST be hidden or disabled with an explanatory hint when the AI provider is not configured (the extract endpoint returns `503 ai-import-not-configured`).

#### Scenario: Not-found offers packaging capture
- **WHEN** a scanned barcode is not found and the AI provider is configured
- **THEN** the panel shows a "Photograph packaging" action alongside the option to scan again

#### Scenario: Capture hidden when AI not configured
- **WHEN** a scanned barcode is not found and the extract endpoint reports `ai-import-not-configured`
- **THEN** the "Photograph packaging" action is not offered (or is disabled with a hint), and the user can still scan again

### Requirement: User reviews and edits the extracted product before it is logged

The review screen SHALL render the extracted `name` and per-100 macros (`calories`, `protein`, `carbs`, `fat`) and the `unit` in editable fields so the user can correct AI misreads before anything is saved or logged. Confirming the review SHALL save the edited values via the save-scanned-product command and then pass the resulting `IngredientSearchResult` to the existing ingredient-select path so the product can be logged exactly like an Open Food Facts hit. The edited values — not the raw extracted ones — MUST be what is saved.

#### Scenario: Edited macro is what gets saved
- **WHEN** the extractor returns `calories: 54` and the user corrects it to `52` in the review form, then confirms
- **THEN** the save request carries `calories: 52`, and the product subsequently resolvable for that barcode reflects the corrected value

#### Scenario: Confirmed product flows into logging
- **WHEN** the user confirms the reviewed product
- **THEN** the product is selected through the same path an Open Food Facts barcode hit uses, ready to be logged with an amount
