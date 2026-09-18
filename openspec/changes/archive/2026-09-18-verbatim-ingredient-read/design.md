## Context

See proposal.md, "Why", for the problem and where it comes from in the code. The constraints that shape the approach:

- The only "reader" is the vision model inside one `extract_recipe` tool call. There is no OCR text to fall back on, so if the model doesn't write the verbatim line down, it's lost.
- `parseToolInput` rewrites `amount`/`unit` for piece rows before anything else sees them. `provenance.raw` is the post-parse `RawIngredient`.
- The frontend API client doesn't validate the response (`fetchJson<RecipeDraft>`), so an additive field arrives untouched.
- The use case builds draft rows field by field and never spreads `raw` into a row, so a new field on `RawIngredient` reaches provenance only.
- The raw line currently renders in one place (`recipe-ingredient-editor.tsx`) through `formatRawIngredient`. The unmatched panel (`review-import-screen.tsx`) and the resolve sheet header (`resolve-pane.tsx`) show `name amount unit` from the draft row.

## Goals / Non-Goals

**Goals:**

- The "gelesen" line shows what was printed, and never shows an estimate as if it had been read.
- One source (`raw.sourceText`) and one formatter for every place the raw line appears.
- Zero effect on matching, amounts, flags, persistence and logging.

**Non-Goals:**

- **Resolved rows keeping their raw line.** A row resolved from the unmatched panel is appended to the list and gets no provenance (`syncRowProvenance` fills appends with `undefined`). That stays as it is. Carrying provenance through `onResolved` is a separate, small change if wanted.
- **Using `sourceText` for matching or for resolution proposals.** It is display-only. Feeding the full line to search would reintroduce the prep/size noise that name normalization removes on purpose.
- **Removing the draft amount or note from the unmatched panel row.** They show what will be saved. The raw line is added alongside them.
- **The barcode product extractor.** It's a different tool and isn't affected.

## Decisions

### 1. Have the model transcribe the line instead of reconstructing it

Add an optional `sourceText` string to each ingredient in the `extract_recipe` schema.

- *Alternative: reformat from existing structured fields only.* This is cheap and needs no prompt change, but it can never be "what was printed". Size words (`mittelgroße`), prep modifiers, fraction glyphs (`½`), ranges (`1-2`) and the original unit word (`Zehen`, and `EL` when the model mapped it to `tbsp`) are already gone after extraction. The name is normalized too. This approach is kept only as the fallback (Decision 4).
- *Alternative: a separate OCR pass.* Rejected. It adds a dependency, latency and cost. It also has to line up OCR lines with extracted ingredients, and the model already does that alignment in the same call.

### 2. Place `sourceText` first in the ingredient properties and exempt it from every other rule

The model tends to fill fields in schema order. Putting the transcription first means it is written before the model starts normalizing the name and resolving amounts, so the read-then-interpret order matches how the fields relate.

The prompt currently has strong rules about naming (food noun only), quantities (convert, estimate) and routing prep text to `note`. It gets a separate "Transcription rule" block stating that `sourceText` is exempt from all of them. The block includes worked examples that match the spec scenarios: `1 mittelgroße Zwiebel, gewürfelt`, `2 EL Olivenöl`, `½ TL Kreuzkümmel`, `Salz und Pfeffer` split into two rows, and a stripped bullet. The field description repeats the core of that rule, because descriptions are what the model sees next to the field.

### 3. Optional in the schema, "always" in the prompt; drop invalid values rather than fail

A missing `name` fails the import with a 502. A missing verbatim line shouldn't: the fallback covers it.

The parser trims the value. It drops empty values and values over 200 characters, which is the same drop-don't-truncate policy as `note`. Truncating would make a verbatim claim false. 200 characters leaves room for long lines such as `1 Dose (400 g) gehackte Tomaten, abgetropft, oder 4 frische Tomaten` while still catching a model that dumps the whole ingredient block into one field.

### 4. The fallback formatter prefers the recipe's own framing

The order in `formatRawIngredient` becomes:

1. `sourceText`, returned verbatim when present.
2. `pieceQuantity`: `formatPieceCount(amount)` + `unitLabel`, then the name. The name is left out when it folds (case- and diacritic-insensitive) to the same string as `unitLabel`, so it doesn't read `1 Zwiebel Zwiebel`.
3. `rawDisplayUnitLabel`: `rawDisplayAmount` (when present) + label + name. This is the existing branch, moved ahead of the canonical amount.
4. The canonical `amount` + `unit` + name. Reaching this branch means the model stated a mass directly.
5. The name alone.

This ordering follows from how the parser works: a piece row's `amount` is always derived from the estimate. So "never show an estimate as read" means checking for pieces before checking the amount. Checking for a raw display quantity before the canonical amount handles the prompt's "attempt a canonical conversion" instruction the same way.

### 5. Pre-format the line once and pass a string to the resolve sheet

`ResolvePane` is shared with the create host, where there is no import and no provenance. `ResolveItem` gets an optional `rawLine?: string`. The review screen formats it from the draft-index provenance, and the pane renders it only when it's present. This keeps the pane free of provenance types.

`collectUnmatched` already iterates by draft index, so each `UnmatchedEntry` also carries `provenance?.ingredients[index]`, the same pairing `pairInitialRowProvenance` uses for matched rows.

### 6. One `RawReadLine` element for all three call sites

The subdued `text-xs text-muted-foreground/80 truncate` paragraph with the `gelesen: „…"` copy and its aria-label now appears three times. It gets extracted into a small feature-level component next to `ingredient-provenance.ts`, in `features/recipes/`. It is domain-aware (it uses the German "read" copy), so it doesn't belong in `components/ui/`. It takes the formatted string and the row name, for the aria-label.

## Risks / Trade-offs

- **[The model paraphrases instead of transcribing]**: for example it normalizes `½` to `0.5`, translates, or tidies casing. → Mitigation: the prompt gives explicit worked examples and a "do not" list. The parser can't detect a paraphrase, so this is checked by a manual smoke import of a real photo with fractions and size words. If paraphrasing turns out to be common, tightening the prompt is enough and the specs don't change.
- **[Extra output tokens]**: roughly 10–20 per ingredient, a few hundred per recipe. → Accepted. It's negligible next to image input tokens.
- **[Busier unmatched panel row]**: name + amount + note + raw line. → Mitigation: the raw line uses the same subdued, truncated style as matched rows. In the common case the note repeats part of the raw line, which is acceptable because the panel is transient.
- **[Duplicate lines on split rows]**: `Salz und Pfeffer` appears on both rows. → This is intended. It records what was read for each row.

## Migration Plan

None. The field is additive and optional end to end. Drafts and provenance are never persisted, so there's no stored data to migrate. Rollback is a plain revert.
