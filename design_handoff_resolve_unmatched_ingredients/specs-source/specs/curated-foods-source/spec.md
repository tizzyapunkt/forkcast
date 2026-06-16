# curated-foods-source — delta

## MODIFIED Requirements

### Requirement: Frontend renders source-attribution badge per result

The frontend search result list SHALL render a small visual badge next to each result showing its `source` (`FOODS`, `USER`, `OFF`, or `SCAN`). The list key for each result SHALL be `${source}:${id}` to remain unique across sources.

#### Scenario: Badge visible on each row

- **WHEN** the search panel renders a non-empty result list
- **THEN** every row has a badge corresponding to the result's `source` field

#### Scenario: Same id across sources renders distinct rows

- **WHEN** an OFF result and a FOODS result happen to share the same `id` value
- **THEN** both rows render without React duplicate-key warnings

## REMOVED Requirements

### Requirement: Generic search-result shape exposes FOODS and OFF as the only sources

**Reason**: The source enumeration grows: the user-foods overlay introduces `USER`, and scanned products (`SCAN`, already shipped by barcode-product-capture) participate in name search. A closed two-value enum no longer describes the system.
**Migration**: See the ADDED requirement "Generic search-result shape enumerates the supported sources".

### Requirement: Augment build script extends foods.json from an exported unmatched-ingredient list

**Reason**: The unmatched-ingredient export no longer exists. The augment input becomes the user-foods overlay export, which carries full phone-confirmed entries instead of bare name counts.
**Migration**: See the ADDED requirement "Augment build script promotes the user-foods overlay export into the curated catalog". Old-format export files are rejected with a clear error naming the expected shape.

### Requirement: Augment script uses a per-item human-in-the-loop with Haiku-suggested verdicts

**Reason**: Triage (synonym vs. new food vs. skip) now happens at runtime on the phone, human-confirmed per item. The script no longer needs Haiku verdicts; its job shrinks to reviewed promotion.
**Migration**: See the ADDED requirement "Augment script keeps a per-item human-in-the-loop for promotion".

## ADDED Requirements

### Requirement: Generic search-result shape enumerates the supported sources

The `IngredientSearchResult` type (backend and frontend) SHALL expose a `source: 'FOODS' | 'USER' | 'OFF' | 'SCAN'` discriminator alongside its `id: string`. Any other source literal (in particular `'BLS'`) SHALL NOT be a valid value of `source`.

#### Scenario: OFF mapper sets source and id

- **WHEN** an OFF product is mapped to a search result
- **THEN** the result has `source: 'OFF'` and `id` equal to the OFF product code

#### Scenario: FOODS mapper sets source and id

- **WHEN** a FOODS entry is mapped to a search result
- **THEN** the result has `source: 'FOODS'` and `id` equal to the entry's id

#### Scenario: USER mapper sets source and id

- **WHEN** a user-foods overlay entry is mapped to a search result
- **THEN** the result has `source: 'USER'` and `id` equal to the entry's id

### Requirement: Augment build script promotes the user-foods overlay export into the curated catalog

The `build:foods:augment <path>` script SHALL take the path to a user-foods overlay export file with shape `{ "foods": <FoodEntry[]>, "synonyms": <{ foodId, synonym }[]> }` and promote its content into `backend/data/foods.json` and `backend/scripts/foods-seed-keys.ts` without overwriting unrelated entries:

- Each `synonyms` item SHALL be applied as a synonym addition to the curated entry named by `foodId` (deduplicated, canonical-name rule preserved). Items whose `foodId` does not exist in `foods.json` SHALL be surfaced to the user for manual handling and skipped without failing the run.
- Each `foods` item SHALL be drafted into a curated entry via the Anthropic API, passing the phone-confirmed entry (name, synonyms, unit, macros, pieces, untracked) as a hint, and validated with the existing food-entry rules before writing. The accepted entry's key SHALL be appended to `FOODS_SEED_KEYS` (plain string for tracked, `{ key, untracked: true }` for untracked).

The script SHALL exit non-zero with a clear message and write nothing when the input file does not exist, is not valid JSON, or does not match the overlay export shape (including old unmatched-ingredient export files); when any drafted entry fails validation; or when `foods-seed-keys.ts` cannot be parsed unambiguously for an append — in which case it SHALL tell the user exactly which keys to add manually. The script SHALL re-sort `foods.json` by `id` ascending and write pretty-printed JSON ending in a single trailing newline.

#### Scenario: Overlay synonym applied to curated entry

- **WHEN** the export contains `{ foodId: "oliven", synonym: "grüne Oliven" }`, `foods.json` has entry `oliven`, and the user accepts
- **THEN** the `oliven` entry's `synonyms` gains `"grüne Oliven"` and no other entries change

#### Scenario: Overlay food promoted with confirmed values as hint

- **WHEN** the export contains a confirmed `Kirschtomaten` entry and the user accepts the promotion
- **THEN** the drafting call receives the confirmed entry as a hint, the validated result is inserted into `foods.json` sorted by `id`, and `FOODS_SEED_KEYS` gains the new key

#### Scenario: Old export format rejected

- **WHEN** the input file has the retired unmatched-ingredient shape `{ entries: [...] }`
- **THEN** the script exits non-zero naming the expected `{ foods, synonyms }` shape and writes nothing

#### Scenario: Orphaned synonym surfaced, run continues

- **WHEN** the export contains a synonym whose `foodId` is absent from `foods.json`
- **THEN** the script lists the orphaned item for manual handling and processes the remaining items normally

### Requirement: Augment script keeps a per-item human-in-the-loop for promotion

For each item in the overlay export, the augment script SHALL print the item (synonym addition or confirmed food entry) and a single-character action menu `[a]ccept / [e]dit / [s]kip` before applying it. Accept SHALL be the default action (the items were already confirmed on the phone). The script SHALL support a `--dry-run` flag that walks the same prompts but writes nothing, printing a final summary of what would change. The drafting call for accepted food promotions SHALL use the same model, tool schema, and system prompt as the `build:foods` script, sourced from the shared module also used by the runtime resolution flow, so curated entries stay uniform.

#### Scenario: Default-accept promotion

- **WHEN** the user presses enter (accept) on a confirmed food item
- **THEN** the item is drafted, validated, and queued for the write

#### Scenario: Skip leaves everything untouched for that item

- **WHEN** the user types `s` on an item
- **THEN** neither `foods.json` nor `foods-seed-keys.ts` is modified for that item

#### Scenario: Dry run writes nothing

- **WHEN** the script runs with `--dry-run` and the user accepts several items
- **THEN** a summary of the would-be changes is printed and both target files are byte-identical to before the run
