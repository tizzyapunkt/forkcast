## ADDED Requirements

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
