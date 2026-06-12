# UI polish backlog — handoff 2 (`design_handoff_forkcast_2/`)

Visual-only deviations from the handoff-2 design. **None of these change spec'd behavior** — no
OpenSpec change needed; implement directly (TDD still applies where there's logic).
Items that DO touch spec'd behavior (header back-nav placement, macro string formats, recipe
expansion/grouping, planner parity, status-color semantics, amount default) are deliberately NOT
here — they go through the OpenSpec proposal.

Design references: `design_handoff_forkcast_2/design/*.jsx`, screenshots `01`–`08`, tokens in
`fc-tokens.css` (`--macro-*` tokens are new in handoff 2).

## Global

- [x] **Macro color tokens**: add `--macro-p / --macro-c / --macro-f` + brightened `--macro-p-on /
      -c-on / -f-on` (for use on the indigo header) to the Tailwind theme, as the single source of
      truth for every macro dot/bar/diagram. Values per `fc-tokens.css` (protein = green
      `hsl(146 52% 43%)` / on-header `hsl(145 60% 62%)`).
- [x] **Diary/planner header macro bars**: give the three macro cells the design's bar + label-dot
      look using the `--macro-*-on` colors. ⚠️ Decision (2026-06-11): the traffic-light STATUS
      coloring of the kcal line, "offen" chip, and macro VALUES stays — do NOT adopt the design
      screenshots' neutral white kcal line. Only the bars/dots take macro-identity colors.

## Ruled out (decided 2026-06-11 — do not "fix" to match the design)

- AmountStep prefill of 100 when no serving size exists — field stays empty (serving-size prefill
  keeps priority when available).
- Neutral white kcal/value coloring in the diary/planner headers — traffic-light status colors stay.

## Tagebuch (diary)

- [x] Slot-card kcal total: render in `--primary` / font-weight 700 (currently plain dark text).
- [x] Slot-card "+" button: 44px soft-accent square (rounded, `--accent-soft` bg, primary plus icon)
      — currently a bare glyph. Planner already uses the soft square; diary should match it.
- [x] Weight card: add the scale icon next to "Heutiges Gewicht"; link label "Gewicht-Tracker"
      (currently "Zum Gewicht-Tracker"); h2 at 16.5px to match meal-slot headings (checklist item 5).
- [x] Weight input placeholder: "z. B. 78,4" (German comma; currently "78.4").
- [x] Date label format: "Do. 11. Juni" without comma (currently "Do., 11. Juni") to match the design.

## Add-food sheet

- [x] AmountStep: render the live total as a separate summary card (muted bg, kcal 24px/800 in
      `--primary` left, macro triplet right) instead of a text line inside the food card.
- [x] AmountStep confirm button: add the check icon (label already includes the amount ✓).
- [x] Rezepte tab rows: add right-aligned "{kcal} kcal/P" figure and a chevron (currently name +
      "N Zut. · N Port." only).
- [x] RecipePortionStep: portions as a stepper (−/+) instead of a raw number input; add the live
      totals card that scales with the chosen portions. (Button label/hint text is handled in the
      OpenSpec change because it depends on the untracked-ingredients decision.)

## Rezepte list

- [x] Toolbar: two equal-width (flex:1) buttons — ghost "Aus Fotos" with camera icon, primary "Neu"
      (currently right-aligned next to the heading, labeled "+ Neues Rezept", no camera icon).
- [x] Recipe card: 44×44 rounded icon tile (`--accent-soft` bg, cook glyph in `--primary`) + kcal in
      `--primary`/700 + "/ Portion" suffix + faint ingredient-count line + trailing chevron.
      (The macro separator/label fix — middots, "KH" — comes with the format spec change.)

## Rezept-Detail

- [x] Actions row: right-aligned as the FIRST element of the scroll body — ghost "Bearbeiten" with
      pencil icon + danger trash ICON button (currently "Löschen" text button, placed above the title).
- [x] Pro-Portion card: header strip with `--accent-soft` bg, uppercase 11px eyebrow "PRO PORTION" in
      `--primary` (currently a plain two-row light card).
- [x] Drop the extra "Bei N Portionen" second row (not in the design; the Portionen stepper scales
      the ingredient list, the Pro-Portion strip stays per-portion). Verify nothing in
      `openspec/specs/recipes` pins it before removing.
- [x] Add the faint "Portionen" caption left of the stepper in the Zutaten heading row.

## Rezept-Editor

- [x] Hero card macro row: three colored-dot items "● Eiweiß {n} g · ● KH {n} g · ● Fett {n} g"
      using the `--macro-*` tokens (currently an inline text triplet next to the kcal number).
- [x] Hero card fill: subtle `linear-gradient(180deg, --accent-soft, --card)`.
- [x] "Zutaten · N" heading with live ingredient count (currently "Zutaten").
- [x] Ingredient note: collapsed by default behind a subtle "+ Notiz" ghost text button (plain text,
      no border/pill); opened state = italic inline input with pencil icon + remove "x". Currently an
      always-visible placeholder input per row. Auto-open when the row already has a note.
- [x] Keep the existing ↻ "Zutat ersetzen" control (app feature, not in the design) — place it in the
      title row next to "+ Notiz" / remove without breaking the design's row layout.

## Wochenplan (planner)

- [x] Day cards: show the date under the weekday badge ("Mo" / "1. Juni" — currently bare day
      number); macro triplet right-aligned on the kcal row (currently below it).
- [x] Expanded day: add the "TAG GESAMT" block (muted card with the three colored macro bars) above
      the meal slots.
- [x] Week rollups: style as the design's stat layout ("585 Ø kcal/Tag" prominent, "4/7 Tage geplant",
      "Ø MAKROS / TAG" colored bars). Placement inside the indigo header is part of the header-system
      spec change; the styling itself is UI-only.

## Einstellungen

- [x] "Ernährungsziel" as h2 over a card containing the goal inputs; kcal full-width, the three macro
      inputs in one 3-column row (currently stacked full-width, heading styled as h1).
