## ADDED Requirements

### Requirement: Recipe ingredient editor shows per-row calories and macros for tracked ingredients
The recipe ingredient editor SHALL display each tracked ingredient row's calorie and macro contribution as a dedicated sub-line within the row. The sub-line MUST follow the format `{kcal} kcal · {P}g P · {C}g K · {F}g F`, where each value is integer-rounded.

Per-row values MUST be derived as `ingredient.macrosPerUnit.{calories,protein,carbs,fat} * ingredient.amount`. The values MUST update synchronously when the user edits the amount input, the piece-count input, or the grams-per-piece input — no debounce, no save, no network call. The editor is already fully controlled by the parent form's state, so each valid keystroke that updates `ingredient.amount` MUST also produce the corresponding update of the per-row line on the same render.

The sub-line MUST NOT be rendered for any row whose `untracked === true`. Untracked rows MUST NOT show calories or macros — neither the stored `macrosPerUnit` (which is ignored at consume time) nor placeholder zeros — because doing so would misrepresent rows the system explicitly excludes from nutrition rollups.

This requirement applies to the editor as used in both the manual recipe form (create + edit) and the AI-import review screen (which mounts the same component).

#### Scenario: Tracked row shows kcal and macros
- **GIVEN** the recipe form contains a tracked ingredient with `macrosPerUnit = { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15 }` and `amount = 200`
- **WHEN** the editor renders
- **THEN** the row displays `500 kcal · 52g P · 0g K · 30g F` as a sub-line under the name/amount row

#### Scenario: Untracked row hides the macro line entirely
- **GIVEN** the recipe form contains an ingredient with `untracked = true` and any `macrosPerUnit` / `amount`
- **WHEN** the editor renders
- **THEN** no calorie or macro sub-line is shown for that row — neither the stored values nor zero placeholders

#### Scenario: Macro line updates live as the amount input changes
- **GIVEN** a tracked ingredient with `macrosPerUnit = { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 }` and `amount = 100`, showing `165 kcal · 31g P · 0g K · 4g F`
- **WHEN** the user changes the amount input to `250`
- **THEN** the row's sub-line immediately reads `413 kcal · 78g P · 0g K · 9g F`, on the same render as the input change — without any debounce, save, or network call

#### Scenario: Macro line updates live as the piece count changes
- **GIVEN** a tracked ingredient with `pieceQuantity = { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`, `unit: 'g'`, `amount: 150`, `macrosPerUnit = { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 }`
- **WHEN** the user changes the piece count to `2` (which sets `amount = 300`)
- **THEN** the row's sub-line immediately reads the kcal+macro values derived from `amount = 300`

#### Scenario: Macro line updates live as grams-per-piece changes
- **GIVEN** a tracked ingredient with `pieceQuantity = { amount: 1, unitLabel: "Zwiebel", gramsPerPiece: 150 }`, `unit: 'g'`, `amount: 150`
- **WHEN** the user changes grams-per-piece to `200` (which sets `amount = 200`)
- **THEN** the row's sub-line immediately reads the kcal+macro values derived from `amount = 200`

#### Scenario: Toggling an ingredient to untracked hides its macro line
- **GIVEN** a tracked ingredient is rendering its kcal+macro sub-line
- **WHEN** the user activates the row's untracked toggle (`untracked` becomes `true`)
- **THEN** the macro sub-line disappears on the next render

#### Scenario: Toggling an ingredient back to tracked restores its macro line
- **GIVEN** an untracked ingredient with `macrosPerUnit` and `amount` set, currently rendering no macro sub-line
- **WHEN** the user deactivates the untracked toggle (`untracked` becomes `false` / removed)
- **THEN** the macro sub-line reappears, derived from the row's current `macrosPerUnit * amount`
