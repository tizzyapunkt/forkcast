# ai-recipe-import

## Purpose

Extract a draft recipe from one or more user-supplied photos of a single recipe using a vision LLM, match each parsed ingredient against the existing ingredient catalog, and return an editable draft. The draft is held only in memory/transit — persistence happens only via the existing `add-recipe` command after user review.
## Requirements
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

The system SHALL, for each ingredient name extracted from the photos, attempt to match it using a strict source cascade: first the curated FOODS source (including runtime-learned synonyms), then — only when FOODS returns zero candidates — the user-foods overlay (`USER`), then — only when both return zero candidates — scanned products (`SCAN`) via name search. The first tier returning at least one candidate wins; lower tiers MUST NOT be consulted. Open Food Facts MUST NOT be queried during import matching.

When a match is found, the draft ingredient row MUST adopt the matched ingredient's `unit`, `macrosPerUnit`, and `untracked` flag, while keeping the model-extracted `amount`, and MUST carry the winning tier as its `source` (`FOODS`, `USER`, or `SCAN`). When the model-extracted unit conflicts with the matched ingredient's catalog unit, the catalog unit MUST win and the row MUST be flagged `unitOverridden: true`. When no tier produces a match, the row MUST be flagged as unmatched and carry only the extracted `name`, `amount` (if any), `unit` (if any), `pieceQuantity` (if any), and `note` (if any), without macros and without an `untracked` flag (the user sets it manually in the review UI if needed).

When the model returns piece-quantity fields for an ingredient (see "Resolve piece quantities to gram weights"), the matching pipeline MUST preserve them on the draft row, subject to:
- If the resolved catalog `unit` is `g` or `ml`, `pieceQuantity` is preserved verbatim and the catalog `unit` is used.
- If the resolved catalog `unit` is anything other than `g` or `ml` (e.g. `tbsp`, `piece`), `pieceQuantity` MUST be dropped and the row falls back to the catalog unit's macros, because piece quantities are only meaningful when the row is mass-tracked.
- The `unitOverridden` flag MUST be raised when the model's `unit` differs from the catalog `unit`, regardless of whether `pieceQuantity` is set.

When the extractor returns a `note` field on an ingredient, the matching pipeline MUST preserve it verbatim on the resulting draft row, regardless of match outcome. The note MUST NOT influence matching, normalization, or any post-match flag. The note rides along on both matched and unmatched rows.

#### Scenario: Matched ingredient

- **WHEN** the model extracts an ingredient name "olive oil" and the FOODS tier returns a matching entry with `unit: "ml"` and known macros
- **THEN** the draft row contains the matched name, `unit: "ml"`, the matched `macrosPerUnit`, and the model's extracted `amount`
- **AND** the row is not flagged as unmatched

#### Scenario: Overlay food matched when curated has no hit

- **WHEN** the model extracts `Kirschtomaten`, the FOODS tier returns zero candidates, and the user-foods overlay contains a `Kirschtomaten` entry
- **THEN** the draft row is matched against the overlay entry with `source: 'USER'`

#### Scenario: Scanned product matched when curated and overlay have no hit

- **WHEN** the model extracts `Skyr`, both FOODS and USER tiers return zero candidates, and a scanned product named `Skyr` exists
- **THEN** the draft row is matched against the scanned product with `source: 'SCAN'`

#### Scenario: Higher tier wins without consulting lower tiers

- **WHEN** the model extracts an ingredient for which the FOODS tier returns at least one candidate
- **THEN** the USER and SCAN tiers are not searched for that ingredient

#### Scenario: OFF never queried during import

- **WHEN** an import draft is matched end to end
- **THEN** no Open Food Facts search is performed for any ingredient

#### Scenario: Unit override flagged

- **WHEN** the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the draft row uses `unit: "g"` (catalog wins), keeps `amount: 2`, and is flagged `unitOverridden: true`

#### Scenario: Unmatched ingredient

- **WHEN** the model extracts an ingredient name that has no match in any cascade tier
- **THEN** the draft row is flagged as unmatched and carries only the extracted `name`, `amount`, `unit`, `pieceQuantity` (when present), and `note` (when present), with no `macrosPerUnit` and no `untracked` flag

#### Scenario: Piece quantity preserved through mass-unit match

- **WHEN** the model extracts `{ name: "Zwiebel", amount: 150, unit: "g", pieceAmount: 1, pieceUnitLabel: "Zwiebel", gramsPerPiece: 150 }` and the catalog match for "Zwiebel" has `unit: "g"` with known macros
- **THEN** the draft row contains the matched name, `unit: "g"`, matched macros, `amount: 150`, and `pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`

#### Scenario: Piece quantity dropped through non-mass match

- **WHEN** the model extracts `{ name: "Knoblauch", amount: 6, unit: "g", pieceAmount: 2, pieceUnitLabel: "Zehe", gramsPerPiece: 3 }` and the catalog match for "Knoblauch" has `unit: "tbsp"`
- **THEN** the draft row uses the catalog `unit: "tbsp"`, drops the `pieceQuantity`, and is flagged `unitOverridden: true`

#### Scenario: Untracked inherited from FOODS match

- **WHEN** the model extracts `{ name: "salt", amount: 5, unit: "g" }` and the catalog match for `salz` has `unit: "g"` and `untracked: true`
- **THEN** the matched draft row carries `untracked: true` (the flag is inherited from the FOODS match)

#### Scenario: Tracked match yields no untracked flag on the draft row

- **WHEN** the model extracts an ingredient that matches a tracked FOODS entry
- **THEN** the matched draft row carries `untracked: false` (or omits the field) — the row is treated as tracked

#### Scenario: Note preserved on matched row

- **WHEN** the model extracts `{ name: "Ingwer", amount: 5, unit: "g", note: "fein gehackt" }` and the catalog match for `Ingwer` has `unit: "g"` with known macros
- **THEN** the matched draft row contains `note: "fein gehackt"` alongside the matched fields

#### Scenario: Note preserved on unmatched row

- **WHEN** the model extracts `{ name: "Yuzu-Schale", amount: 2, unit: "g", note: "fein abgerieben" }` and no cascade tier has a match for `Yuzu-Schale`
- **THEN** the unmatched draft row contains `note: "fein abgerieben"` alongside the extracted name, amount, and unit

#### Scenario: Note absent when extractor omits it

- **WHEN** the model extracts an ingredient with no `note` field on it
- **THEN** the resulting draft row has no `note` field, regardless of match outcome

### Requirement: Missing amount surfaced, never guessed
When an ingredient amount or unit is not visible in any of the submitted photos, the system MUST return that field as missing rather than guess. Unmatched rows with missing amounts and matched rows with missing amounts MUST both be representable in the draft.

The "never guess" rule applies to the *amount the recipe states*. It does NOT apply to the typical-weight-per-piece estimate the model produces for piece-counted ingredients (see "Resolve piece quantities to gram weights"), which is intentionally an estimate and is surfaced as such in the review UI.

#### Scenario: Amount not shown in photos
- **WHEN** the model extracts an ingredient whose amount is not visible (e.g. "salt to taste")
- **THEN** the draft row carries the ingredient with no `amount`, no `unit`, and no `pieceQuantity`, and the row is included in the draft

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

### Requirement: Resolve piece quantities to gram weights
When the source recipe states an ingredient as a count (e.g. "1 onion", "½ medium zucchini", "2 cloves garlic", "1 medium tomato"), the vision model SHALL — within the same `extract_recipe` tool call — return both the literal piece framing and a gram-weight estimate, using these fields on the ingredient object:

- `pieceAmount` (number, optional): the count as written, e.g. `1`, `0.5`, `2`. Fractional values are permitted.
- `pieceUnitLabel` (string, optional): the noun the recipe used to describe the piece, in the original language, e.g. `"onion"`, `"medium zucchini"`, `"clove"`, `"Knoblauchzehe"`.
- `gramsPerPiece` (number, optional): the model's estimate of a typical mass for one such piece, in grams.

When piece fields are present, the model MUST also populate `amount` and `unit` with the resolved total mass: `amount = pieceAmount * gramsPerPiece` and `unit = "g"` (or `"ml"` only when the recipe explicitly frames the piece as a liquid quantity, e.g. "juice of 1 lemon"). When the recipe states the ingredient by mass directly, the model MUST omit the piece fields.

The system SHALL surface the resolved `pieceQuantity` on the draft row using the shape `{ amount: pieceAmount, unitLabel: pieceUnitLabel, gramsPerPiece }`, so the review UI can render both the count and the gram-weight estimate. The user can edit either side before saving.

#### Scenario: Solid count ingredient
- **WHEN** the recipe states "1 onion" with no further detail
- **THEN** the draft row has `unit: "g"`, `amount` equal to the model's estimated total grams, and `pieceQuantity = { amount: 1, unitLabel: "onion", gramsPerPiece: <estimate> }`

#### Scenario: Fractional piece
- **WHEN** the recipe states "½ medium zucchini"
- **THEN** the draft row has `unit: "g"`, `amount` equal to `0.5 * gramsPerPiece`, and `pieceQuantity = { amount: 0.5, unitLabel: "medium zucchini", gramsPerPiece: <estimate> }`

#### Scenario: Multi-piece ingredient
- **WHEN** the recipe states "2 cloves garlic"
- **THEN** the draft row has `unit: "g"`, `amount` equal to `2 * gramsPerPiece`, and `pieceQuantity = { amount: 2, unitLabel: "clove", gramsPerPiece: <estimate> }`

#### Scenario: Mass-stated ingredient leaves piece fields empty
- **WHEN** the recipe states "200 g flour"
- **THEN** the draft row has `unit: "g"`, `amount: 200`, and no `pieceQuantity`

#### Scenario: Liquid by piece
- **WHEN** the recipe states "juice of 1 lemon" and the model estimates ~30 ml of juice per lemon
- **THEN** the draft row has `unit: "ml"`, `amount: 30`, and `pieceQuantity = { amount: 1, unitLabel: "lemon", gramsPerPiece: 30 }`

### Requirement: Validate model-returned piece arithmetic
On parsing the tool output, the system SHALL validate the piece fields:

- If `pieceAmount` is present, both `pieceUnitLabel` (non-empty string) and `gramsPerPiece` (positive finite number) MUST also be present; otherwise the system SHALL drop all piece fields for that ingredient and treat it as mass-only.
- If `gramsPerPiece` is present without `pieceAmount`, the system SHALL drop `gramsPerPiece` and treat the ingredient as mass-only.
- If `pieceAmount * gramsPerPiece` does not equal `amount` within a 5% tolerance, the system SHALL recompute `amount = pieceAmount * gramsPerPiece` and use that value, trusting the explicit per-piece weight over the aggregate.
- If `unit` is anything other than `g` or `ml` while piece fields are present, the system SHALL drop the piece fields (a non-mass total is incompatible with a per-piece gram weight).

These adjustments MUST happen during draft construction; the user MUST NOT see inconsistent piece arithmetic in the review UI.

#### Scenario: Missing companion field drops piece info
- **WHEN** the model returns `{ name: "onion", amount: 150, unit: "g", pieceAmount: 1 }` (no `pieceUnitLabel`, no `gramsPerPiece`)
- **THEN** the draft row carries `amount: 150` with no `pieceQuantity`

#### Scenario: Inconsistent piece arithmetic recomputed
- **WHEN** the model returns `{ name: "onion", amount: 200, unit: "g", pieceAmount: 1, pieceUnitLabel: "onion", gramsPerPiece: 150 }`
- **THEN** the draft row carries `amount: 150` (recomputed from `1 * 150`) and `pieceQuantity = { amount: 1, unitLabel: "onion", gramsPerPiece: 150 }`

#### Scenario: Piece fields with non-mass unit dropped
- **WHEN** the model returns `{ name: "olive oil", amount: 2, unit: "tbsp", pieceAmount: 2, pieceUnitLabel: "tbsp", gramsPerPiece: 14 }`
- **THEN** the draft row carries `amount: 2`, `unit: "tbsp"`, and no `pieceQuantity`

### Requirement: Review UI shows piece quantity and weight together
The frontend review-import screen SHALL render piece-tracked ingredient rows with both the piece count and the resolved weight visible (e.g. `1 onion (≈ 150 g)`), and SHALL allow the user to edit either the piece count or `gramsPerPiece` before saving the recipe. Editing the piece count MUST recompute `amount` using the existing `gramsPerPiece`. Editing `gramsPerPiece` MUST recompute `amount` using the existing piece count. The same detachment behavior defined in the `recipes` capability applies if the user edits the mass `amount` directly.

The review UI MUST visually distinguish AI-estimated `gramsPerPiece` values so the user knows the figure is an estimate that they can correct.

#### Scenario: Piece-tracked draft row rendered with both quantities
- **WHEN** the importer returns a draft row with `pieceQuantity = { amount: 1, unitLabel: "onion", gramsPerPiece: 150 }` and `amount: 150`, `unit: "g"`
- **THEN** the review-import screen renders the row as `1 onion (≈ 150 g)` with the gram weight visually marked as an AI estimate

#### Scenario: User adjusts gramsPerPiece before saving
- **WHEN** the user changes `gramsPerPiece` from `150` to `200` on a piece-tracked draft row with `pieceAmount = 1`
- **THEN** the row updates to show `1 onion (≈ 200 g)` and saving the recipe persists `amount = 200` with `pieceQuantity.gramsPerPiece = 200`

### Requirement: Review UI surfaces and allows toggling the untracked flag
The frontend review-import screen SHALL render the `untracked` flag on every draft ingredient row that carries it, with the same visual treatment used in the recipe form (muted styling and/or a small badge). The screen SHALL also provide a toggle on every row — including unmatched rows that arrived without a flag — that lets the user mark the row as untracked or clear the flag before saving the recipe. Saving the recipe MUST persist whatever `untracked` value the user left on each row.

#### Scenario: Inherited untracked flag visible in review
- **WHEN** the importer returns a draft with one row inheriting `untracked: true` from a FOODS match
- **THEN** the review screen renders that row visually muted with the untracked toggle in the on state

#### Scenario: User toggles unmatched row to untracked
- **WHEN** the user opens an imported draft, finds an unmatched row "fresh thyme", and toggles it to untracked
- **THEN** the form state for that row carries `untracked: true` and the row's visual treatment switches to muted

#### Scenario: User clears an inherited untracked flag
- **WHEN** the importer returns a row with inherited `untracked: true` and the user toggles it off before saving
- **THEN** the row is saved with `untracked: false` (or absent)

#### Scenario: Saved recipe reflects review-time toggle state
- **WHEN** the user saves the imported recipe after toggling some rows
- **THEN** the persisted recipe carries `untracked` per row exactly as left in the review UI

### Requirement: Review screen replaces a misrecognized ingredient via the picker
The frontend AI-import review screen SHALL allow the user to replace a misrecognized ingredient on any matched row by opening the existing ingredient picker via the row's name (per the `recipes` capability "Replace ingredient via picker" requirement). The user MUST NOT be required to delete the row and re-add it from scratch in order to correct a wrong AI match.

The replace MUST follow the same per-field rules as the manual editor: keep `amount`, replace `name`/`unit`/`macrosPerUnit`/`untracked`, and keep or drop `pieceQuantity` per the new pick's unit. Saving the recipe after a replace MUST send the swapped row in the `add-recipe` payload.

When a row's `pieceQuantity` was AI-estimated (visible via the estimate badge) and the user swaps the ingredient, the estimate badge MUST be cleared for that row regardless of whether `pieceQuantity` is preserved or dropped — the user has now made an explicit pick.

#### Scenario: Mismatched ingredient corrected via swap
- **GIVEN** an imported draft contains a matched row `{ name: "Olivenöl", unit: "ml", amount: 30 }` but the photo actually showed sunflower oil
- **WHEN** the user taps the row's name in the review screen, picks "Sonnenblumenöl" from the picker
- **THEN** the review screen now shows the row as `Sonnenblumenöl, 30 ml` (amount preserved)
- **AND** saving the recipe sends `name: "Sonnenblumenöl"`, `unit: "ml"`, the picked `macrosPerUnit`, and `amount: 30` in the `add-recipe` payload

#### Scenario: Tracked → untracked swap in review
- **WHEN** the user replaces a tracked row in the review screen with a FOODS-untracked seasoning (e.g. "Salz")
- **THEN** the row is rendered with `untracked: true` (muted style, "Nicht gezählt" indicator) and saving the recipe sends `untracked: true` for that row

#### Scenario: AI-estimated piece weight cleared after swap
- **GIVEN** a draft row with `pieceQuantity` flagged as an AI estimate (estimate badge visible)
- **WHEN** the user swaps the ingredient via the picker
- **THEN** the estimate badge is no longer shown for that row, regardless of whether `pieceQuantity` was preserved or dropped by the swap rules

#### Scenario: Discard via swap, not via remove + add
- **WHEN** the user wants to correct any matched row in the review screen
- **THEN** the swap action (tap-the-name → pick) is sufficient — there is no requirement to first delete the row using the row's ✕ button

### Requirement: Extractor captures literal display quantity for untracked-eligible rows
The vision model's `extract_recipe` tool schema SHALL accept two additional optional fields on each ingredient that capture the literal textual amount and unit as written in the recipe, for cases where the unit is outside the canonical `MeasurementUnit` enum (`g | ml | oz | cup | tbsp | tsp | piece`):

- `rawDisplayAmount` (number, optional): the literal amount as written, e.g. `1`, `0.5`, `2`. Fractional values permitted.
- `rawDisplayUnitLabel` (string, optional): the literal textual unit as written, e.g. `"TL"`, `"EL"`, `"Prise"`, `"Schuss"`, `"Teelöffel"`, or `"n. Geschmack"` when the recipe uses a qualitative phrase.

The model MUST populate these fields when the recipe states the ingredient using a unit outside the canonical enum (typical for seasonings/spices/herbs). When the recipe states the ingredient using a canonical unit, the model SHOULD omit these fields. When the ingredient has no quantity at all (e.g. "Salz n. Geschmack"), the model MAY populate `rawDisplayUnitLabel` alone with the qualitative phrase and omit `rawDisplayAmount`.

The "never guess" rule on stated amounts continues to apply (see `Missing amount surfaced, never guessed`): the model MUST NOT invent `rawDisplayAmount` or `rawDisplayUnitLabel`. These fields capture only what is literally present in the photos.

#### Scenario: Teaspoon seasoning captured
- **WHEN** the recipe states "1 TL Salz"
- **THEN** the model returns the ingredient with `rawDisplayAmount: 1` and `rawDisplayUnitLabel: "TL"`

#### Scenario: Pinch captured without amount
- **WHEN** the recipe states "eine Prise Pfeffer"
- **THEN** the model returns the ingredient with `rawDisplayAmount: 1` and `rawDisplayUnitLabel: "Prise"` (the model may interpret "eine" as `1` since it is the literal count word)

#### Scenario: Qualitative quantity captured
- **WHEN** the recipe states "Salz n. Geschmack" with no numeric amount
- **THEN** the model returns the ingredient with `rawDisplayUnitLabel: "n. Geschmack"` and no `rawDisplayAmount`, no `amount`, no `unit`

#### Scenario: Canonical unit omits raw display fields
- **WHEN** the recipe states "200 g Mehl"
- **THEN** the model returns the ingredient with `amount: 200, unit: "g"` and no `rawDisplayAmount`, no `rawDisplayUnitLabel`

### Requirement: Importer populates displayQuantity on untracked matches
When the importer constructs a draft ingredient row from the extractor output and the catalog match, the system SHALL populate `displayQuantity` on the draft row when ALL of the following hold:

- The row was matched to a FOODS entry whose `untracked === true` (the matched draft row carries `untracked: true`).
- The extractor returned `rawDisplayUnitLabel` (non-empty after trim) on the source ingredient.

The populated `displayQuantity` MUST be `{ amount: rawDisplayAmount ?? 1, unitLabel: rawDisplayUnitLabel.trim() }`. The `amount` defaults to `1` when the model returned a qualitative phrase without a numeric value (e.g. "Prise" alone).

When the matched FOODS entry is tracked (not untracked), the importer MUST drop `rawDisplayAmount` and `rawDisplayUnitLabel` from the matched draft row — `displayQuantity` is only meaningful on untracked rows per the `recipes` capability. Unmatched rows MUST NOT carry `displayQuantity` regardless of raw display fields (they have no `untracked` flag yet; the user toggles it in the review UI, and may add a `displayQuantity` there).

When the matched-untracked row has no extractor `rawDisplayUnitLabel`, `displayQuantity` MUST be left absent on the draft row. The review UI's "+ Menge ergänzen" affordance lets the user add it later.

The canonical `amount` on the matched-untracked row MUST follow the relaxed rule from the `recipes` capability: when neither the canonical extracted `amount` nor a piece-derived total is available, `amount` MUST be set to `0` so the row is persistable.

#### Scenario: Matched-untracked with TL captured
- **WHEN** the extractor returns `{ name: "Salz", rawDisplayAmount: 1, rawDisplayUnitLabel: "TL" }` and the catalog match is a FOODS entry with `untracked: true` and `unit: "g"`
- **THEN** the draft row carries `name: "Salz", unit: "g", untracked: true, displayQuantity: { amount: 1, unitLabel: "TL" }`

#### Scenario: Matched-untracked with Prise but no amount
- **WHEN** the extractor returns `{ name: "Pfeffer", rawDisplayUnitLabel: "Prise" }` (no `rawDisplayAmount`) and the catalog match is a FOODS entry with `untracked: true`
- **THEN** the draft row carries `untracked: true, displayQuantity: { amount: 1, unitLabel: "Prise" }`

#### Scenario: Matched-tracked drops raw display fields
- **WHEN** the extractor returns `{ name: "Mehl", amount: 200, unit: "g", rawDisplayAmount: 200, rawDisplayUnitLabel: "g" }` and the catalog match is a tracked FOODS entry
- **THEN** the draft row carries `amount: 200, unit: "g", untracked: false (or absent)`, no `displayQuantity`

#### Scenario: Matched-untracked without rawDisplayUnitLabel
- **WHEN** the extractor returns `{ name: "Salz", amount: 5, unit: "g" }` (no raw display fields) and the catalog match is a FOODS entry with `untracked: true`
- **THEN** the draft row carries `untracked: true, amount: 5, unit: "g"`, no `displayQuantity`

#### Scenario: Unmatched row does not carry displayQuantity
- **WHEN** the extractor returns `{ name: "fresh thyme", rawDisplayAmount: 1, rawDisplayUnitLabel: "sprig" }` and the catalog has no match
- **THEN** the draft row is flagged unmatched and carries the extracted `name`, no `displayQuantity`

#### Scenario: Matched-untracked with no extracted amount persists as zero
- **WHEN** the extractor returns `{ name: "Salz", rawDisplayUnitLabel: "n. Geschmack" }` and the catalog match is a FOODS entry with `untracked: true`
- **THEN** the draft row carries `untracked: true, amount: 0, unit: <catalog unit>, displayQuantity: { amount: 1, unitLabel: "n. Geschmack" }`

### Requirement: Review UI carries displayQuantity through to save
The frontend AI-import review screen SHALL preserve any `displayQuantity` returned by the importer on each matched-untracked draft row, render it via the same editor used by the manual recipe form (per the `recipes` capability "Recipe form displayQuantity editor" requirement), and include it in the `add-recipe` payload when the user saves.

When the user toggles a previously-tracked row to untracked in the review UI, the editor MUST expose the `+ Menge ergänzen` affordance so the user can add a `displayQuantity` before saving. When the user toggles a previously-untracked row to tracked, any `displayQuantity` on that row MUST be cleared (so the save payload is valid).

#### Scenario: Imported displayQuantity round-trips on save
- **GIVEN** the importer returned a matched-untracked row with `displayQuantity: { amount: 1, unitLabel: "TL" }`
- **WHEN** the user reviews the draft and saves without further edits
- **THEN** the `add-recipe` payload carries `untracked: true` and `displayQuantity: { amount: 1, unitLabel: "TL" }` on that row, and the persisted recipe reflects the same values

#### Scenario: User adds displayQuantity to imported untracked row
- **GIVEN** the importer returned a matched-untracked row with no `displayQuantity` (extractor saw no amount/unit)
- **WHEN** the user taps `+ Menge ergänzen`, enters `1 EL`, and saves
- **THEN** the `add-recipe` payload carries `displayQuantity: { amount: 1, unitLabel: "EL" }` on that row

#### Scenario: User toggles to untracked then adds displayQuantity
- **GIVEN** an imported tracked row that the user toggles to untracked
- **WHEN** the user taps `+ Menge ergänzen`, enters `1 Prise`, and saves
- **THEN** the row is saved with `untracked: true` and `displayQuantity: { amount: 1, unitLabel: "Prise" }`

#### Scenario: User toggles to tracked clears displayQuantity
- **GIVEN** an imported untracked row carrying `displayQuantity: { amount: 1, unitLabel: "TL" }`
- **WHEN** the user toggles the row to tracked and saves
- **THEN** the `add-recipe` payload carries `untracked: false` (or absent) and no `displayQuantity` on that row

### Requirement: Optional debug payload on the import response

When the backend is configured to emit debug information (env var `RECIPE_IMPORT_DEBUG=true` at startup; the variable accepts only the literal strings `true` or `false`, case-insensitive, and defaults to `false`), the import endpoint SHALL return an additional `debug` object on the recipe draft response. The `debug` object MUST contain a per-ingredient breakdown that lets a developer diagnose ingredient-matching mismatches without re-running the import.

For each ingredient extracted by the vision model, the `debug.ingredients` entry MUST include:
- `raw`: the ingredient as returned by the model, verbatim (name, amount, unit, piece-quantity fields, raw display fields if present), before any matching.
- `candidates`: the top N candidates returned by the winning cascade tier for the raw name, in rank order. The cap N is fixed at 5. Each candidate exposes `name`, `source` (`FOODS`, `USER`, or `SCAN`), `unit`, and `untracked`.
- `chosen`: the candidate picked as the match, or `null` when no match was found. `chosen` MUST be reference-equal in content to the corresponding entry in `candidates` (typically the first), or `null`.
- `flags`: a flat object with the post-match flags that fired on this row: `unitOverridden`, `pieceQuantityDropped`, `untrackedInherited` (booleans).

When `RECIPE_IMPORT_DEBUG` is not configured, the `debug` field MUST be absent from the response entirely (not `null`, not an empty object), so existing clients are unaffected.

The `debug` payload MUST NOT be persisted anywhere. It exists only on the request-scoped response.

#### Scenario: Debug field omitted by default
- **WHEN** the backend starts without `RECIPE_IMPORT_DEBUG` set and a client calls `POST /import-recipe-from-photos` with a valid image
- **THEN** the response is `200` with the existing draft shape
- **AND** the response body has no `debug` property

#### Scenario: Debug field present when enabled
- **WHEN** the backend starts with `RECIPE_IMPORT_DEBUG=1` and a client calls `POST /import-recipe-from-photos` with a valid image whose extraction yields two ingredients
- **THEN** the response is `200` with a `debug.ingredients` array of length 2
- **AND** each entry contains `raw`, `candidates`, `chosen`, and `flags`

#### Scenario: Matched row carries chosen and unit-override flag
- **WHEN** debug is enabled and the model extracts `{ name: "tomato paste", amount: 2, unit: "tbsp" }` and the catalog match has `unit: "g"`
- **THEN** the debug entry for that ingredient has a non-null `chosen` with `unit: "g"`
- **AND** `flags.unitOverridden` is `true`
- **AND** `flags.pieceQuantityDropped` is `false`
- **AND** `flags.untrackedInherited` is `false`
- **AND** `candidates[0]` matches the `chosen` candidate

#### Scenario: Cascade-tier source visible per candidate
- **WHEN** debug is enabled and an ingredient matches in the USER tier after a FOODS miss
- **THEN** the debug entry's `candidates` carry `source: 'USER'` and `chosen.source` is `'USER'`

#### Scenario: Unmatched row carries null chosen
- **WHEN** debug is enabled and the model extracts an ingredient name that has no match in any cascade tier
- **THEN** the debug entry has `chosen: null`
- **AND** `candidates` is an empty array
- **AND** all `flags` are `false`

#### Scenario: Piece-quantity drop is flagged
- **WHEN** debug is enabled and the model extracts `{ name: "Knoblauch", amount: 6, unit: "g", pieceAmount: 2, pieceUnitLabel: "Zehe", gramsPerPiece: 3 }` and the catalog match has `unit: "tbsp"`
- **THEN** the debug entry's `flags.pieceQuantityDropped` is `true`
- **AND** `flags.unitOverridden` is `true`

#### Scenario: Untracked inheritance is flagged
- **WHEN** debug is enabled and the model extracts `{ name: "salt", amount: 5, unit: "g" }` and the catalog match has `unit: "g"` and `untracked: true`
- **THEN** the debug entry's `flags.untrackedInherited` is `true`

#### Scenario: Candidate cap
- **WHEN** debug is enabled and the winning tier returns more than 5 candidates for a raw ingredient name
- **THEN** the debug entry's `candidates` array has length exactly 5, in the original rank order

### Requirement: Debug box on the import review screen

The "Add Recipe from Photo" review screen SHALL render a collapsible "Debug" box at the bottom of the screen when, and only when, the import response includes a `debug` field. The box MUST be collapsed by default; expanding it reveals one block per ingredient showing:

- the raw extracted name (and amount/unit/piece fields if present),
- the chosen match's name, source, and unit (or an explicit "unmatched" indicator if `chosen` is null),
- the list of top candidates in rank order with name, source, and unit,
- the flags that fired (`unitOverridden`, `pieceQuantityDropped`, `untrackedInherited`) when true.

The box MUST NOT render at all when `draft.debug` is undefined. The box's labels MAY remain in English (this is a developer tool, not user-facing copy).

#### Scenario: Box hidden when debug field absent
- **WHEN** the review screen receives a draft whose response has no `debug` field
- **THEN** no element with the debug box role/test-id is in the rendered output

#### Scenario: Box visible when debug field present
- **WHEN** the review screen receives a draft whose response has a `debug` field with at least one ingredient entry
- **THEN** the debug box is rendered, collapsed by default, with a toggle to expand it

#### Scenario: Expanded box shows raw, chosen, candidates, and flags
- **WHEN** the user expands the debug box on a draft whose `debug.ingredients[0]` has `raw.name = "tomato paste"`, `chosen.name = "Tomatenmark"`, three candidates, and `flags.unitOverridden = true`
- **THEN** the rendered block contains the raw name, the chosen name, all three candidate names in order, and a visible `unitOverridden` indicator

### Requirement: Ingredient `name` field carries the food noun only

The extractor's `extract_recipe` tool schema and system prompt SHALL require that the `name` field on every extracted ingredient contains only the food noun, without preparation, cut, or quality modifiers (e.g. "fein gehackt", "geschält", "in Scheiben", "frisch gewolft"). When the source recipe writes such modifiers inline with the ingredient name, the model MUST move the prep instruction into the ingredient's `note` field (see "Extractor captures preparation modifier in ingredient note") and leave `name` clean.

Leading adjectives that change the food itself — i.e. that change the nutrition profile or identity, such as "Zuckerfreier Ahornsirup", "Geräucherter Lachs", "Gemahlener Zimt" — SHALL be preserved on `name` and SHALL NOT be moved to `note`.

Prep modifiers MUST NOT be duplicated into `steps`. When the source recipe states the prep only inline on the ingredient line (e.g. `"1 TL Ingwer, fein gehackt"`), the `note` field on the ingredient row is the canonical home for that information; `steps` SHALL describe the cooking process and SHALL NOT carry standalone freestanding prep instructions that already live on the ingredient row.

#### Scenario: Inline prep modifier moved to ingredient note

- **WHEN** the source recipe states an ingredient line `"1 TL Ingwer, fein gehackt"` followed by a single step `"Alles vermischen und 5 min köcheln"`
- **THEN** the model returns the ingredient with `name: "Ingwer"` (no comma-suffix) and `note: "fein gehackt"`, and the returned `steps` are the cooking steps from the source recipe (no synthesised standalone prep step)

#### Scenario: Leading qualifier preserved

- **WHEN** the source recipe states `"100 ml Zuckerfreier Ahornsirup"`
- **THEN** the model returns the ingredient with `name: "Zuckerfreier Ahornsirup"` unchanged — the leading qualifier is part of the food identity — and no `note` is produced for that row unless an additional prep modifier was present

#### Scenario: No prep modifier produces no note

- **WHEN** the source recipe states `"200 g Mehl"` with no inline modifier
- **THEN** the model returns the ingredient with `name: "Mehl"` and no `note` field on that row

### Requirement: Extractor captures preparation modifier in ingredient note

The `extract_recipe` tool schema SHALL include an optional `note` field on each ingredient (a string). The system prompt SHALL instruct the model to populate `note` with the preparation, cut, or quality modifier that was bundled inline with the ingredient name in the source recipe (e.g. `"fein gehackt"`, `"geschält"`, `"in Scheiben"`, `"frisch gewolft"`) and to keep `name` to the food noun only.

The parser SHALL trim the value. Empty strings (after trim) MUST be dropped (treated as absent on the resulting `RawIngredient`). Values whose trimmed length exceeds 80 characters MUST be dropped (treated as absent) — overlong notes are likely a misuse of the field by the model, and dropping them never fails the whole import.

When the extractor returns no inline prep modifier for an ingredient, the `note` field MUST be absent on the resulting `RawIngredient`. The extractor MUST NOT invent prep notes that are not present in the source recipe.

The `note` value MUST be in the original language of the source recipe (consistent with the `name` and `steps` fields).

#### Scenario: Note populated from inline prep modifier

- **WHEN** the source recipe contains the line `"1 EL Olivenöl"` followed by `"2 Knoblauchzehen, fein gehackt"`
- **THEN** the extractor returns the second ingredient with `name: "Knoblauchzehen"` and `note: "fein gehackt"`

#### Scenario: Empty extracted note dropped

- **WHEN** the model returns an ingredient with `note: ""` or `note: "   "`
- **THEN** the parser produces a `RawIngredient` with no `note` field

#### Scenario: Overlong extracted note dropped

- **WHEN** the model returns an ingredient with a `note` whose trimmed length exceeds 80 characters
- **THEN** the parser produces a `RawIngredient` with no `note` field, and the rest of the ingredient (name, amount, unit, etc.) is preserved

#### Scenario: Note trimmed on extraction

- **WHEN** the model returns an ingredient with `note: "  in Scheiben  "` (surrounding whitespace)
- **THEN** the parser produces a `RawIngredient` with `note: "in Scheiben"` (trimmed)

#### Scenario: Note absent when source has no prep modifier

- **WHEN** the source recipe states `"500 g Hähnchenbrustfilet"` with no inline modifier
- **THEN** the model returns the ingredient with `name: "Hähnchenbrustfilet"` and no `note` field

### Requirement: Review import screen surfaces ingredient note

The review-import screen SHALL display the `note` from each draft ingredient row, when present, as a subtitle beneath the ingredient name. The note SHALL be visible on both matched and unmatched rows. The review screen MUST carry the note through to the eventual save payload (the `add-recipe` call that persists the reviewed draft) without modification.

When the user replaces an ingredient via the picker on the review screen, the note from the previous row MUST NOT be carried over onto the replacement row by default — a different food typically means different prep, and the user can re-enter the note explicitly if it still applies.

#### Scenario: Matched row note rendered on review

- **WHEN** the review screen renders a draft with a matched ingredient `{ name: "Ingwer", note: "fein gehackt", ... }`
- **THEN** the screen shows `"Ingwer"` on the primary line and `"fein gehackt"` as a subtitle on that row

#### Scenario: Unmatched row note rendered on review

- **WHEN** the review screen renders a draft with an unmatched ingredient `{ name: "Yuzu-Schale", note: "fein abgerieben", ... }`
- **THEN** the screen shows `"Yuzu-Schale"` on the primary line, surfaces the row as unmatched, and shows `"fein abgerieben"` as a subtitle

#### Scenario: Note carried through save

- **WHEN** the user reviews a draft with an ingredient that has `note: "in Scheiben"` and saves the recipe without altering the note
- **THEN** the `add-recipe` payload sent to the backend carries that ingredient row with `note: "in Scheiben"`

#### Scenario: Replacing an ingredient clears the note
- **WHEN** the user invokes the picker on a draft row that has a `note` and selects a different ingredient as the replacement
- **THEN** the resulting draft row carries the replacement ingredient with no `note` field, regardless of what the previous row had

### Requirement: Match attempt falls back to a normalized name across the cascade

When the full source cascade (FOODS → USER → SCAN) returns zero candidates for `raw.name`, the system SHALL compute a normalized form of `raw.name` by stripping a single trailing `, …` clause and a single trailing `(…)` parenthetical, then collapsing whitespace. If the normalized form differs from the raw form, the system SHALL retry the full cascade once with the normalized name. Leading adjectives MUST NOT be stripped during normalization.

When the retry returns at least one candidate, the row SHALL be matched as if the winning tier had returned that candidate for the raw name — all existing matching rules (unit override, piece-drop, untracked inheritance, etc.) apply unchanged. When the retry also returns zero candidates, the row is flagged unmatched.

#### Scenario: Comma-suffix normalization rescues a match

- **WHEN** the extractor returns `{ name: "Ingwer, fein gehackt", amount: 5, unit: "g" }` and the FOODS tier has an entry whose canonical name is `"Ingwer"`
- **THEN** the cascade runs twice (first with `"Ingwer, fein gehackt"`, then with `"Ingwer"`) and the draft row is matched against the `Ingwer` entry with `amount: 5, unit: "g"`

#### Scenario: No retry when raw and normalized are identical

- **WHEN** the extractor returns `{ name: "unicorn dust", amount: 1, unit: "tsp" }` and the cascade returns zero candidates
- **THEN** the cascade is not retried (normalization yields `"unicorn dust"` unchanged) and the row is flagged unmatched

#### Scenario: No retry when raw name already matches

- **WHEN** the extractor returns `{ name: "Ingwer", amount: 5, unit: "g" }` and the FOODS tier returns at least one candidate
- **THEN** the cascade runs exactly once and the row is matched
