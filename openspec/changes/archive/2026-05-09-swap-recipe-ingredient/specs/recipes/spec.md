## ADDED Requirements

### Requirement: Replace ingredient via picker
The recipe ingredient editor SHALL provide a per-row "replace ingredient" action. The action MUST be reachable from the row's ingredient name, which MUST be rendered as a tappable button-styled element with a small visible affordance glyph (e.g. `↻`) next to the name to communicate that the area is interactive. Tapping the name (or the glyph) MUST open the existing ingredient picker in "replace" mode targeting that specific row.

In replace mode, the picker MUST:
- Render with a dialog title that communicates the replace context (distinct from the additive "add" title).
- Skip the picker's amount-confirmation step entirely. Picking a search result MUST immediately complete the replace and close the picker.

When the replace completes, the editor MUST update the targeted row in place using these per-field rules:

| Field | Rule |
|---|---|
| `name` | Replace with the picked result's `name` |
| `unit` | Replace with the picked result's `unit` |
| `macrosPerUnit` | Replace with the picked result's `macrosPerUnit` |
| `amount` | **Keep** the row's existing value unchanged |
| `pieceQuantity` | Keep verbatim if the picked `unit` is `g` or `ml`; drop entirely otherwise |
| `untracked` | Set to `true` if the picked result has `untracked: true`; otherwise omit/set to absent |

If the row was previously flagged as an AI-estimated `gramsPerPiece` (visible via the estimate badge), the estimate marker for that row MUST be cleared on swap, regardless of whether `pieceQuantity` is preserved or dropped.

The replace MUST NOT modify any other row in the editor.

The replace action MUST be available on every row in the editor — both in the manual recipe form (new + edit) and in the AI-import review screen (which uses the same editor).

#### Scenario: Replace preserves amount
- **GIVEN** a row `{ name: "Olivenöl", unit: "ml", macrosPerUnit: olivenoel, amount: 30 }`
- **WHEN** the user taps the row's name and picks "Sonnenblumenöl" from the picker
- **THEN** the row becomes `{ name: "Sonnenblumenöl", unit: "ml", macrosPerUnit: sonnenblumenoel, amount: 30 }` (amount preserved)

#### Scenario: Replace inherits untracked from new pick
- **GIVEN** a tracked row `{ name: "Olivenöl", untracked: undefined, amount: 30 }`
- **WHEN** the user taps its name and picks the FOODS-untracked entry "Salz" (with `untracked: true`)
- **THEN** the row becomes `{ name: "Salz", untracked: true, amount: 30, ... }`

#### Scenario: Replace clears inherited untracked when new pick is tracked
- **GIVEN** an untracked row `{ name: "Salz", untracked: true, amount: 5 }`
- **WHEN** the user taps its name and picks a tracked FOODS entry (e.g. "Zucker")
- **THEN** the row becomes `{ name: "Zucker", untracked: undefined, amount: 5 }` (the flag is cleared)

#### Scenario: Replace preserves pieceQuantity when new unit is mass
- **GIVEN** a row `{ name: "Zwiebel", unit: "g", amount: 150, pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }`
- **WHEN** the user taps the name and picks "Schalotte" (also `unit: "g"`)
- **THEN** the row becomes `{ name: "Schalotte", unit: "g", amount: 150, pieceQuantity: { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 } }` (piece info preserved)

#### Scenario: Replace drops pieceQuantity when new unit is non-mass
- **GIVEN** a row with `unit: "g"` and `pieceQuantity` set
- **WHEN** the user picks a replacement whose unit is `tbsp`
- **THEN** the row becomes a mass-only row with the new `unit: "tbsp"` and no `pieceQuantity`

#### Scenario: Estimate badge cleared on swap
- **GIVEN** a row whose `gramsPerPiece` was AI-estimated and is currently displaying the estimate badge
- **WHEN** the user swaps the ingredient via the picker (regardless of whether `pieceQuantity` is preserved or dropped)
- **THEN** the estimate badge is no longer rendered for that row

#### Scenario: Picker dialog title reflects replace context
- **WHEN** the user opens the picker via the replace action on a row
- **THEN** the picker's dialog title indicates a replace operation (distinct from the "add" title)

#### Scenario: Replace mode skips the amount step
- **WHEN** the user opens the picker in replace mode and picks a search result
- **THEN** the picker closes immediately and the row updates without surfacing the picker's amount-confirmation step

#### Scenario: Replace does not affect other rows
- **GIVEN** an editor with multiple rows
- **WHEN** the user swaps row index `i`
- **THEN** every row other than `i` is unchanged in name/unit/macros/amount/pieceQuantity/untracked

#### Scenario: Cancelling the picker leaves the row unchanged
- **WHEN** the user opens the picker via the replace action and dismisses (Abbrechen / overlay click) without picking a result
- **THEN** the targeted row is unchanged

#### Scenario: Replace is available in edit mode of an existing recipe
- **GIVEN** an existing recipe opened in edit mode
- **WHEN** the user taps a row's name and picks a different ingredient
- **THEN** the row updates per the rules above and the recipe can be saved via the existing update-recipe flow with the swapped row reflected in the payload
