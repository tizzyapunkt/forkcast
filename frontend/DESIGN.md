---
name: forkcast
description: Planning-first weekly meal and macro tracker for one user, built to be operated fast under time pressure.
colors:
  training-indigo: "hsl(244 36% 44%)"
  training-indigo-foreground: "hsl(0 0% 100%)"
  training-indigo-gradient-start: "hsl(244 36% 47%)"
  training-indigo-gradient-end: "hsl(244 38% 40%)"
  bright-periwinkle: "hsl(249 72% 65%)"
  paper-white: "hsl(300 100% 99%)"
  lavender-surface: "hsl(240 100% 98%)"
  soft-lavender: "hsl(240 33% 94%)"
  lavender-border: "hsl(240 9% 78%)"
  ink: "hsl(0 0% 20%)"
  ink-muted: "hsl(0 0% 36%)"
  ink-faint: "#8a8a8a"
  alert-red: "hsl(0 84% 60%)"
  success-green: "#10b981"
  warning-amber: "#f59e0b"
  macro-protein: "hsl(146 52% 43%)"
  macro-carb: "hsl(28 80% 52%)"
  macro-fat: "hsl(199 70% 48%)"
  macro-protein-on: "hsl(145 60% 62%)"
  macro-carb-on: "hsl(34 95% 64%)"
  macro-fat-on: "hsl(196 92% 68%)"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "normal"
  body-mobile-input:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "normal"
  micro:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: "1rem"
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.training-indigo}"
    textColor: "{colors.training-indigo-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.training-indigo}"
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-destructive:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.training-indigo-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    textColor: "{colors.training-indigo}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
  input-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.lavender-surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: forkcast

## Overview

**Creative North Star: "The Training Kitchen"**

forkcast treats meal planning and fitness/weight goals as one discipline, not two apps stitched together: the same screen that plans Tuesday's dinner also reads against the macro goal driving it. The visual language matches that — a precision instrument built for someone with a full-time job and a young family, meant to be operated correctly in seconds, not admired. Training Indigo is the single signature note (primary actions, the sticky header gradient); everything else stays quiet — flat lavender-tinted neutrals, thin borders, no decorative texture — so the indigo and the three fixed macro-identity colors (protein green, carb amber, fat blue) are the only things that ever call for attention.

Density is deliberately high but never cramped: dense rows (ingredient amounts, log entries) use the `sm` control size and tabular numerals so figures line up; primary screens use the roomier `md` size that clears a comfortable tap target. The system has no ornamental flourish, no illustration, no imagery — it is entirely typographic and color-coded, and German-only (`lang="de"`, no i18n abstraction beyond the single locale).

**Key Characteristics:**
- One accent color (Training Indigo) for commitment/primary action; a brighter sibling (Bright Periwinkle) for focus and interactive accents only
- Flat-at-rest, bordered surfaces; shadow reserved for things floating above the page
- Fixed three-color macro identity system (protein/carb/fat) that never changes meaning
- System font stack only — no custom typeface, no display type
- Tight, native-app-like density with iOS-safe input sizing (16px minimum on mobile)

## Colors

Muted, cool, lavender-leaning neutrals with exactly one saturated accent family (indigo/periwinkle) and a fixed three-color macro-identity set layered on top.

### Primary
- **Training Indigo** (hsl(244 36% 44%) / #4e489a): The app's one committed color. Primary buttons, the active bottom-nav state via foreground text, the PWA theme color. Used sparingly — the `ghost` button variant uses indigo as *text*, never fills, to keep it quieter than `primary`.
- **Training Indigo Gradient** (start hsl(244 36% 47%) → end hsl(244 38% 40%), `160deg`): The sticky header's own two-stop gradient, slightly brighter/darker than the flat Training Indigo so the header reads as a distinct plane rather than a solid fill.

### Secondary
- **Bright Periwinkle** (hsl(249 72% 65%) / #7a67e6): Training Indigo's higher-energy sibling. Used for the focus ring/outline on every focusable control and the `accent` color scale — signals "this is interactive right now" without competing with the primary action.

### Neutral
- **Paper White** (hsl(300 100% 99%) / #fff9ff): App background and the base surface fields/inputs sit on.
- **Lavender Surface** (hsl(240 100% 98%) / #f5f5ff): Card, popover, and other raised-content backgrounds — one step warmer/denser than the page background so cards read as distinct without a shadow.
- **Soft Lavender** (hsl(240 33% 94%) / #ebebf5): Secondary/muted surfaces — the drag handle on bottom sheets, muted backgrounds.
- **Lavender Border** (hsl(240 9% 78%) / #c2c2cc): All borders and input strokes.
- **Ink** (hsl(0 0% 20%) / #333333): Primary text.
- **Ink Muted** (hsl(0 0% 36%) / #5c5c5c): Secondary text, hints, muted labels.
- **Ink Faint** (#8a8a8a): Tertiary text, lowest-emphasis captions.

### Status
- **Alert Red** (hsl(0 84% 60%) / #ef4444): Destructive actions and validation errors.
- **Success Green** (#10b981) / **Warning Amber** (#f59e0b): Reserved for status states outside the macro-identity system (not yet widely wired into components; token exists for upcoming states).

### Macro Identity
- **Protein Green** (hsl(146 52% 43%), brightened `-on` hsl(145 60% 62%) for the dark header): Protein dot, bar, and diagrammatic identity.
- **Carb Amber** (hsl(28 80% 52%), brightened `-on` hsl(34 95% 64%)): Carbohydrate identity.
- **Fat Blue** (hsl(199 70% 48%), brightened `-on` hsl(196 92% 68%)): Fat identity.

### Named Rules
**The One Indigo Rule.** Training Indigo fills at most one control per screen — the single primary action or the header. Every other button variant (`outline`, `ghost`, `destructiveOutline`) stays neutral or uses indigo as text only, never as a second fill competing with the primary action.

**The Macro Identity Rule.** Protein/carb/fat always render in their fixed green/amber/blue identity color for the dot and bar. Only the accompanying value text may re-tint for status (over/under goal); the identity color itself never changes meaning or gets reused for anything else.

## Typography

**Body Font:** ui-sans-serif, system-ui, -apple-system, sans-serif (no custom typeface — the platform's native font, matching the native-app-instrument feel)

**Character:** Purely functional. No display size exists anywhere in the system — the largest text in the app is an 18px semibold screen title. Numerals default to tabular figures wherever a value updates or a list of amounts must align.

### Hierarchy
- **Title** (600, 1.125rem/18px, 1.75rem line-height): Screen/sub-screen name in the sticky header (`AppHeader`) — the only heading-weight text in the app.
- **Body** (400, 0.875rem/14px, 1.25rem line-height): Default control and copy size on desktop (`sm:text-sm`).
- **Body (mobile input)** (400, 1rem/16px, 1.5rem line-height): Text/decimal inputs on mobile. Load-bearing, not stylistic — anything smaller triggers iOS Safari's auto-zoom on focus.
- **Label** (500, 0.75rem/12px, 1rem line-height): Field labels' dense variant, hints, error text, bottom-nav labels, macro header captions.
- **Micro** (0.6875rem/11px, 1rem line-height): The floor of the type scale — a single size, no smaller variant. Two uses: **eyebrow** (600, uppercase, `tracking-wider` — section labels like "Pro Portion", "Tagesziel", source/status badges) and **caption** (400–500, sentence case — sparing secondary annotations like a day-picker's date-of-month or a stat card's hint line). Reused across ~15 files (`per-portion-hero.tsx`, `recipe-detail.tsx`, `recipe-ingredient-editor.tsx`, `planner-screen.tsx`, `photo-staging.tsx`, and others).

### Named Rules
**The No-Display-Type Rule.** There is no hero/display type scale. The 18px header title is the ceiling; introducing anything larger breaks the instrument-not-billboard character.
**The Micro-Is-The-Floor Rule.** 11px is the smallest text the system uses — one size, not a shrinking ramp. Below `Label`, text is either an uppercase `tracking-wider` eyebrow or a sparing one-line caption; it is never a shrunk paragraph.

## Layout

Single-column, mobile-first layout that must never scroll horizontally (`overflow-x: clip` is a hard guard on `html, body` — see `.cursor/rules/no-horizontal-overflow-mobile.mdc`). A sticky `AppHeader` pins to the top; a 4-tab `BottomNav` pins to the bottom on mobile. Full-screen forms and pickers use a `BottomSheet` (portal-rendered, `82dvh` default height, drag handle) rather than a route change, keeping navigation context intact. No defined breakpoint/grid system beyond Tailwind's defaults and a `sm:` desktop density step (e.g. `text-base sm:text-sm` on inputs).

## Elevation & Depth

Flat by default. Cards and containers are separated from their surroundings by a 1px `Lavender Border`, not a shadow — depth is not part of the resting visual language. Shadow appears only on elements floating above the page: the sticky header (`shadow-sm`, separating it from scrolled content) and the `BottomSheet` (`shadow-lg`, a drawer overlaying the app). This is a confirmed, forward-going invariant, not just an observed default.

### Shadow Vocabulary
- **Header lift** (Tailwind `shadow-sm`): The sticky `AppHeader`, separating pinned chrome from scrolled content beneath it.
- **Overlay lift** (Tailwind `shadow-lg`): `BottomSheet` and other content that floats above the base page.

### Named Rules
**The Flat-at-Rest Rule.** Surfaces are flat and bordered at rest. Shadow is reserved for things that are literally floating above the page (sticky header, sheets, dialogs) — never used to add weight to an ordinary card or button.

## Shapes

Two-step radius scale, both smaller than the Tailwind default: `sm` (4px), `md` (6px), `lg` (8px, the root `--radius`), plus one larger `xl` (12px) reserved for the bottom sheet's top corners. Borders are always 1px, `Lavender Border`. No clipping, skew, or non-rectangular silhouettes anywhere in the system.

### Named Rules
**The Two-Radius Rule.** Interactive controls you act on directly — buttons, inputs, segmented-control options — use `md` (6px). Containers that hold content — cards — use `lg` (8px). Full-screen overlays — the bottom sheet — use `xl` (12px) on their leading edge only. Content always reads a shade softer than the controls that manipulate it.

## Components

Every component reads **precise and unhurried**: no motion beyond a plain color transition on hover/focus, tight but tap-safe sizing (44px targets via padding + line-height, not fixed heights), and nothing decorative.

### Buttons
- **Shape:** `rounded-md` (6px).
- **Primary:** Training Indigo fill, white text, `px-4 py-2 text-sm` (md) or `px-3 py-1 text-xs` (sm); hover darkens to 90% opacity.
- **Outline:** Paper White fill, `Lavender Border` stroke, ink text; hover fills `Soft Lavender`. Sits next to a primary action (cancel, alternate path).
- **Destructive / Destructive Outline:** Alert Red fill+white text (committing a delete) vs. Alert Red text+border only (opening a delete confirmation) — the outline variant stays deliberately quieter than the filled one.
- **Ghost:** Training Indigo text only, no fill or border — inline link-like actions inside dense lists/cards.
- **Icon:** Square `h-10 w-10`, no text padding.

### Cards / Containers
- **Corner Style:** `rounded-lg` (8px).
- **Background:** Lavender Surface.
- **Shadow Strategy:** None — see Elevation & Depth; a 1px border does the separation.
- **Border:** 1px, `Lavender Border`.
- **Internal Padding:** `p-4` (16px) default, `p-3` (12px) dense variant, or `none` when children own their own edges (divided lists, sticky rows).

### Inputs / Fields
- **Style:** `rounded-md` (6px), 1px `Lavender Border` stroke, Paper White background. `min-width: 0` is forced globally so fields never overflow narrow flex/grid containers.
- **Focus:** 2px Bright Periwinkle outline, 1px offset (not a border-color shift or glow) — applied uniformly via `:focus-visible` on `input`/`textarea`/`select`.
- **Numeric fields:** Right-aligned, tabular numerals (`DecimalInput` accepts both `,` and `.` as decimal separator, reformats to locale on blur, and never rejects a half-typed value while the field is focused).
- **Labels:** A `Field` wrapper wires label ↔ control ↔ hint/error via generated ids and `aria-describedby`/`aria-invalid` automatically.
- **Error:** Label text and message render in Alert Red; the message carries `role="alert"`.

### Segmented Control
- **Style:** Flex row of equal-width label-wrapped native radios (not buttons) so arrow-key group navigation is free. Unselected: `Lavender Border` outline. Selected: Training Indigo border + 10%-opacity Training Indigo fill + medium weight text.
- **Use:** Picking exactly one of a handful of mutually exclusive, always-visible options. Beyond phone-width option counts, the system falls back to `<select>` instead of wrapping this component.

### Navigation (Bottom Nav)
- **Style:** Fixed 4-column grid, Paper White background, 1px top border. Icon (lucide, 20px) above a 12px label. Active tab: `Ink` text + `aria-current="page"`; inactive: `Ink Muted`. No pill/indicator background on the active state — color and weight alone carry it.

### Bottom Sheet (signature component)
- **Style:** Portal-rendered to `<body>`, fixed to the viewport bottom, `rounded-t-xl` (12px) top corners only, `shadow-lg`, backdrop `bg-black/40`. A centered `h-1 w-10` `Soft Lavender` drag handle signals draggability even where drag isn't implemented. Default height `82dvh`; content-sized sheets pass a `max-h-…` override instead. Used for every full-screen form/picker/search flow in place of a route change.

### Header Macro Cells (signature component)
- **Style:** Three columns inside the indigo header gradient, each: a macro-identity dot (6px) + label in `white/70`, a tabular-numeral value in `white/90` (or a status color when over/under goal), and an optional macro-identity-colored fill bar (`white/20` track) showing 0–100% of goal. This is the one place the macro-identity colors get their brightened `-on` variants, for legibility on the dark gradient.

## Do's and Don'ts

### Do:
- **Do** keep Training Indigo to one fill per screen (the primary action or the header) — see The One Indigo Rule.
- **Do** use the fixed macro green/amber/blue for protein/carb/fat identity everywhere they appear, never reassigned.
- **Do** use `text-base` (16px) for any text input rendered on mobile — smaller sizes trigger iOS Safari's zoom-on-focus.
- **Do** route full-screen forms/pickers through `BottomSheet` rather than a new route, keeping the header/nav context in place.
- **Do** keep numeric values tabular (`tabular-nums`) wherever a figure updates or several must align in a column.

### Don't:
- **Don't** add a shadow to an element that isn't literally floating above the page (ordinary cards and buttons stay flat with a border).
- **Don't** introduce a display/hero type size — 18px semibold is the ceiling.
- **Don't** fill a second control with Training Indigo on the same screen as the primary action; use `outline` or `ghost` instead.
- **Don't** reuse a macro-identity color (protein/carb/fat) for anything other than that macro.
