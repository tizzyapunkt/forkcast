## ADDED Requirements

### Requirement: Import recipe draft from one or more photos
The system SHALL expose a command that accepts an ordered, non-empty list of images of a single recipe and returns a recipe draft consisting of a name, yield, ordered ingredients, and ordered steps. The system MUST send all submitted images to the vision model in a single call, in the order provided, so the model can resolve content that spans multiple images.

A request with zero images, or with more than `RECIPE_IMPORT_MAX_IMAGES` images (default 8), MUST be rejected with `400`.

The command MUST NOT persist anything. The returned draft is intended for a follow-up review and save via the existing add-recipe command.

#### Scenario: Single-image import succeeds
- **WHEN** a client sends `POST /import-recipe-from-photos` with one image of a clear printed recipe
- **THEN** the response is `200` with a draft containing a non-empty `name`, `yield >= 1`, at least one ingredient, and an ordered list of `steps`
- **AND** no recipe is persisted as a side effect of the call

#### Scenario: Multi-image import preserves ordering
- **WHEN** a client sends `POST /import-recipe-from-photos` with three images representing pages 1, 2, 3 of an Instagram screenshot of one recipe
- **THEN** the response is `200` with a single draft whose `ingredients` and `steps` reflect content drawn from all three images
- **AND** ingredients or steps that flow across pages are not duplicated or split

#### Scenario: Empty image list rejected
- **WHEN** a client sends `POST /import-recipe-from-photos` with `images: []`
- **THEN** the response is `400` with an error indicating at least one image is required

#### Scenario: Too many images rejected
- **WHEN** a client sends `POST /import-recipe-from-photos` with more images than `RECIPE_IMPORT_MAX_IMAGES`
- **THEN** the response is `400` with an error indicating the maximum image count and the count submitted

### Requirement: Image size and media-type limits
The system SHALL reject requests where any image exceeds the per-image byte limit (`RECIPE_IMPORT_MAX_IMAGE_BYTES`, default 5 MB), where the combined decoded size exceeds the total byte limit (`RECIPE_IMPORT_MAX_TOTAL_BYTES`, default 20 MB), or where any image's `mediaType` is not one of `image/jpeg`, `image/png`, or `image/webp`. Error responses MUST identify the offending image's index in the submitted array when applicable, so the client can highlight it.

#### Scenario: Per-image size exceeded
- **WHEN** a client submits two images and the second image's decoded size exceeds the per-image limit
- **THEN** the response is `413` with an error body that names index `1` as the offending image

#### Scenario: Combined size exceeded
- **WHEN** a client submits images that individually fit under the per-image limit but together exceed the total limit
- **THEN** the response is `413` with an error indicating the total-size limit was exceeded

#### Scenario: Unsupported media type
- **WHEN** a client submits an image with `mediaType: "image/gif"`
- **THEN** the response is `400` with an error that names the offending image's index and the unsupported media type

### Requirement: Ingredient matching against existing catalog
The system SHALL, for each ingredient name extracted from the photos, attempt to match it against the existing ingredient catalog using the existing ingredient search service. When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit` and `macrosPerUnit`, while keeping the model-extracted `amount`. When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no match is found, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), and `unit` (if any), without macros.

#### Scenario: Matched ingredient
- **WHEN** the model extracts an ingredient name "olive oil" and the catalog returns a matching entry with `unit: "ml"` and known macros
- **THEN** the draft row contains the matched name, `unit: "ml"`, the matched `macrosPerUnit`, and the model's extracted `amount`
- **AND** the row is not flagged as unmatched

#### Scenario: Unit override flagged
- **WHEN** the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the draft row uses `unit: "g"` (catalog wins), keeps `amount: 2`, and is flagged `unitOverridden: true`

#### Scenario: Unmatched ingredient
- **WHEN** the model extracts an ingredient name that has no match in the catalog
- **THEN** the draft row is flagged as unmatched and carries only the extracted `name`, `amount`, and `unit`, with no `macrosPerUnit`

### Requirement: Missing amount surfaced, never guessed
When an ingredient amount or unit is not visible in any of the submitted photos, the system MUST return that field as missing rather than guess. Unmatched rows with missing amounts and matched rows with missing amounts MUST both be representable in the draft.

#### Scenario: Amount not shown in photos
- **WHEN** the model extracts an ingredient whose amount is not visible (e.g. "salt to taste")
- **THEN** the draft row carries the ingredient with no `amount`, and the row is included in the draft

### Requirement: Configuration error returned when AI provider not configured
When `ANTHROPIC_API_KEY` is missing at startup, the import endpoint SHALL return `503` with a stable error code (`ai-import-not-configured`) so the frontend can hide the import entry point. The rest of the API MUST continue to function unchanged.

#### Scenario: Unconfigured backend
- **WHEN** the backend starts without `ANTHROPIC_API_KEY` and a client calls `POST /import-recipe-from-photos`
- **THEN** the response is `503` with body containing `error: "ai-import-not-configured"`
- **AND** other endpoints continue to respond normally

### Requirement: Upstream AI errors are surfaced as bad-gateway
When the AI provider returns an error, times out, or returns a tool-call result that does not parse against the declared schema, the system SHALL respond with `502` and include a stable error code in the body. The system MUST NOT retry automatically.

#### Scenario: Provider returns a 5xx
- **WHEN** the upstream Anthropic API returns a 5xx error
- **THEN** the response is `502` with a body indicating the upstream failure

#### Scenario: Tool result fails to parse
- **WHEN** the model's tool-call output cannot be parsed as the declared draft schema
- **THEN** the response is `502` with a body indicating an extraction failure

### Requirement: Auth-protected like all other API routes
The import endpoint SHALL require a valid session cookie just like every other protected route. Unauthenticated calls MUST be rejected with `401` before any image is forwarded to the AI provider.

#### Scenario: Unauthenticated import attempt
- **WHEN** `POST /import-recipe-from-photos` is called without a valid session cookie
- **THEN** the response is `401` and no call is made to the AI provider

### Requirement: Observability of import calls
For each successful import, the system SHALL log the model id, the number of images submitted, the input/output token counts reported by the provider, and the call duration. No image bytes or extracted recipe text MAY be logged.

#### Scenario: Successful call observability
- **WHEN** an import call succeeds
- **THEN** an info-level log line is emitted containing `model`, `imageCount`, `inputTokens`, `outputTokens`, and `durationMs`
- **AND** the log line does not contain image bytes or recipe text

### Requirement: Drafts are not persisted
The import command MUST NOT write to the recipe repository or any other persistent store. Persistence happens only through the existing add-recipe command, which is invoked separately after the user reviews the draft.

#### Scenario: No persistence on import
- **WHEN** a client successfully imports a draft via `POST /import-recipe-from-photos`
- **THEN** the recipe repository is not modified
- **AND** a subsequent `GET /recipes` call returns the same list it would have returned before the import
