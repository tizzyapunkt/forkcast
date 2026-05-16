## ADDED Requirements

### Requirement: Augment build script extends foods.json from an exported unmatched-ingredient list

The repository SHALL ship a second TypeScript build script `backend/scripts/build-foods-augment.ts`, exposed as `pnpm --filter @forkcast/backend build:foods:augment <path>`, that takes the path to an exported unmatched-ingredients JSON file and augments the existing `backend/data/foods.json` and `backend/scripts/foods-seed-keys.ts` without overwriting unrelated entries. The script SHALL never regenerate entries that already exist in `foods.json` from scratch; it only appends new entries and/or adds synonyms to existing entries.

The script SHALL exit non-zero with a clear message and write nothing when:
- The input file does not exist, is not valid JSON, or does not match the export shape `{ entries: [...] }`.
- Any drafted new-food entry fails the existing food-entry validation rules (canonical name, synonyms shape, unit, macros, optional pieces, optional untracked).
- The `foods-seed-keys.ts` file cannot be parsed unambiguously for an append — in which case the script SHALL also tell the user exactly which new keys to add manually.

The script SHALL re-sort `foods.json` entries by `id` ascending and write pretty-printed JSON ending in a single trailing newline.

#### Scenario: Augment adds a synonym to an existing entry

- **WHEN** the input contains an unmatched entry `Karotte`, the existing `foods.json` contains an entry with `id: moehre`, `name: Möhre`, `synonyms: ["carrot"]`, and the user accepts the Haiku-suggested synonym verdict
- **THEN** the resulting `foods.json` contains the same `moehre` entry with `synonyms: ["carrot", "Karotte"]` (or equivalent dedup-preserving order)
- **AND** no other entries in `foods.json` are modified

#### Scenario: Augment adds a new food entry

- **WHEN** the input contains an unmatched entry `Buchweizenmehl`, no existing entry covers it, and the user accepts the new-food verdict
- **THEN** the resulting `foods.json` contains a new entry whose `id` is the accepted proposed key (kebab-case), with canonical name, synonyms, unit, macros (validated), and optional pieces produced by the nutrition draft
- **AND** the entry is sorted into the correct position by `id` ascending
- **AND** `foods-seed-keys.ts`'s `FOODS_SEED_KEYS` array has the new key appended (using the plain-string form for tracked entries, or `{ key, untracked: true }` for untracked ones)

#### Scenario: Augment rejects invalid drafted entries

- **WHEN** the new-food drafting call returns an entry whose `macrosPer100.calories` is negative
- **THEN** the script exits non-zero with a message identifying the offending proposed key
- **AND** neither `foods.json` nor `foods-seed-keys.ts` is written

#### Scenario: Augment refuses to corrupt foods-seed-keys.ts

- **WHEN** `foods-seed-keys.ts` has been modified in a way the conservative parser cannot handle and there is at least one accepted new-food verdict
- **THEN** the script exits non-zero with a message listing the accepted new keys that the user must add to the seed file manually
- **AND** `foods.json` is also not written, so the seed file and the catalog stay in sync

### Requirement: Augment script uses a per-item human-in-the-loop with Haiku-suggested verdicts

For each unmatched entry in the input, the augment script SHALL call the Anthropic API with the `claude-haiku-4-5-20251001` model and a tool-use schema that returns exactly one of three verdicts:

- `{ verdict: 'synonym-of', existingId: string, confidence: 'high' | 'medium' | 'low' }`
- `{ verdict: 'new-food', proposedKey: string }` where `proposedKey` matches the existing `id` rules (lowercase, ASCII, kebab-case, German romanisation)
- `{ verdict: 'skip', reason: string }`

The script SHALL print the unmatched name, its `count`, and a brief view of its `samples`, followed by the Haiku verdict and a single-character action menu: `[a]ccept / [e]dit / [s]kip / [r]ename`. The script SHALL apply changes only when the user explicitly accepts (or accepts an edited verdict).

The script SHALL also accept a `--dry-run` flag. With `--dry-run`, the prompts still appear, but the script writes nothing — it prints a final summary of what would change instead.

The new-food drafting call (when a `new-food` verdict is accepted) SHALL use the `claude-opus-4-7` model and the same tool schema/system prompt used by the existing `build:foods` script, so per-100 macros stay consistent between fresh-seeded and augmented entries.

#### Scenario: Haiku proposes a synonym, user accepts

- **WHEN** an unmatched entry `Karotte` produces `{ verdict: 'synonym-of', existingId: 'moehre', confidence: 'high' }` and the user types `a`
- **THEN** the script applies the synonym addition to `foods.json` (subject to write deferral until all items are processed) and does not call Opus for that entry

#### Scenario: User edits a verdict before accepting

- **WHEN** Haiku proposes `{ verdict: 'new-food', proposedKey: 'rotekarotte' }` and the user types `e` then chooses `synonym-of moehre`
- **THEN** the script applies the edited synonym addition rather than calling Opus to draft a new food

#### Scenario: User skips an entry

- **WHEN** the user types `s` for an item
- **THEN** the script does not modify `foods.json` or `foods-seed-keys.ts` for that item, and the input unmatched store is also unchanged (the user clears the collected store explicitly via the UI)

#### Scenario: Dry run prints the diff but writes nothing

- **WHEN** the user runs `pnpm build:foods:augment <path> --dry-run` and accepts a mix of verdicts
- **THEN** the script prints a summary of the synonym additions and new-food drafts that would have been applied
- **AND** the on-disk `foods.json` and `foods-seed-keys.ts` are byte-identical to their state before the run

#### Scenario: New-food drafting uses the existing Opus build tool

- **WHEN** the user accepts a `new-food` verdict for `buchweizenmehl`
- **THEN** the script calls Opus with the same build-foods tool schema and system prompt used by `build:foods` and applies the same per-entry validation before writing
