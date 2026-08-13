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
  success-ink: "#047857"
  warning-amber: "#f59e0b"
  warning-ink: "#b45309"
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
  full: "9999px"
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
  button-icon:
    rounded: "{rounded.md}"
    height: "40px"
    width: "40px"
  button-accent:
    backgroundColor: "{colors.bright-periwinkle}"
    textColor: "{colors.training-indigo}"
    rounded: "{rounded.md}"
    height: "40px"
    width: "40px"
  input-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  select-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.lavender-surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  banner-destructive:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.alert-red}"
    rounded: "{rounded.md}"
    padding: "12px"
  banner-warning:
    backgroundColor: "{colors.warning-amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: forkcast

## Overview

**Creative North Star: "The Training Kitchen"**

forkcast treats meal planning and fitness/weight goals as one discipline, not two apps stitched together: the same screen that plans Tuesday's dinner also reads against the macro goal driving it. The visual language matches that — a precision instrument built for someone with a full-time job and a young family, meant to be operated correctly in seconds, not admired. Training Indigo is the single signature note (primary actions, the sticky header gradient); everything else stays quiet — flat lavender-tinted neutrals, thin borders, no decorative texture — so the indigo and the three fixed macro-identity colors (protein green, carb amber, fat blue) are the only things that ever call for attention.

Density is deliberately high but never cramped: dense rows (ingredient amounts, log entries) use the `sm` control size and tabular numerals so figures line up; primary screens use the roomier `md` size that clears a comfortable tap target. The system has no ornamental flourish, no illustration, no imagery — it is entirely typographic, icon-coded and color-coded, and German-only (`lang="de"`, no i18n abstraction beyond the single locale). Icons come from one library (lucide-react, ~19 files) at a consistent stroke; a Unicode glyph is never an icon.

Motion exists but is strictly informational, never decorative: a pulse on skeleton placeholders while data loads, a spinner on an action that takes longer than a moment, a 200ms height transition on the bottom sheet, and a width transition on macro goal bars. Nothing enters, slides, fades in or parallaxes. A global `prefers-reduced-motion` rule collapses every animation and transition to 0.01ms, so any motion added to this system must remain optional to comprehension.

**Key Characteristics:**
- One accent color (Training Indigo) for commitment/primary action; a brighter sibling (Bright Periwinkle) for focus and interactive accents only
- Flat-at-rest, bordered surfaces; shadow reserved for things floating above the page
- Fixed three-color macro identity system (protein/carb/fat) that never changes meaning
- System font stack only — no custom typeface, no display type
- Tight, native-app-like density with iOS-safe input sizing (16px minimum on mobile)
- One drawn icon set (lucide) and informational-only motion, both held to a fixed vocabulary

## Colors

Muted, cool, lavender-leaning neutrals with exactly one saturated accent family (indigo/periwinkle), a three-color status set, and a fixed three-color macro-identity set layered on top.

### Primary
- **Training Indigo** (hsl(244 36% 44%) / #4e489a): The app's one committed color. Primary buttons, the active bottom-nav state via foreground text, the PWA theme color. Used sparingly — the `ghost` button variant uses indigo as *text*, never fills, to keep it quieter than `primary`.
- **Training Indigo Gradient** (start hsl(244 36% 47%) → end hsl(244 38% 40%), `160deg`): The sticky header's own two-stop gradient, slightly brighter/darker than the flat Training Indigo so the header reads as a distinct plane rather than a solid fill.

### Secondary
- **Bright Periwinkle** (hsl(249 72% 65%) / #7a67e6): Training Indigo's higher-energy sibling. Used for the focus ring/outline on every focusable control and the `accent` color scale — signals "this is interactive right now" without competing with the primary action.

### Neutral
- **Paper White** (hsl(300 100% 99%) / #fff9ff): App background and the base surface fields/inputs sit on.
- **Lavender Surface** (hsl(240 100% 98%) / #f5f5ff): Card, popover, and other raised-content backgrounds — one step warmer/denser than the page background so cards read as distinct without a shadow.
- **Soft Lavender** (hsl(240 33% 94%) / #ebebf5): Secondary/muted surfaces — the drag handle on bottom sheets, skeleton placeholders, muted backgrounds.
- **Lavender Border** (hsl(240 9% 78%) / #c2c2cc): All borders and input strokes.
- **Ink** (hsl(0 0% 20%) / #333333): Primary text.
- **Ink Muted** (hsl(0 0% 36%) / #5c5c5c): Secondary text, hints, muted labels.
- **Ink Faint** (#8a8a8a): Tertiary text, lowest-emphasis captions.

### Status
All three status colors are live tokens, not reserves — every status surface in the app is built from them at low opacity with a matching border. Green and amber ship as a pair: a saturated **fill** for dots, bars and tinted surfaces, and a darker **ink** sibling for text, because the fills only reach ~2.5:1 on Paper White.
- **Alert Red** (hsl(0 84% 60%) / #ef4444): Destructive actions, validation errors, and the error banner (`bg-destructive/10`, `border-destructive/50`, red text) shown when a request fails. Needs no ink sibling — it already clears 4.5:1.
- **Success Green** (fill #10b981, ink #047857): Confirmation after a save that stays on the same screen — the nutrition-goal and body-profile forms render `bg-success/10` with `text-success-ink` rather than navigating away. Also the on-target day in the planner.
- **Warning Amber** (fill #f59e0b, ink #b45309): The "needs your attention, nothing is broken" state — the unmatched-ingredients panel on the import review screen (`bg-warning/5`, `border-warning/50`), the body-profile plausibility warning, the AI-estimate dot and badge on catalog/recipe editors, and the over-target day in the planner.

### Macro Identity
- **Protein Green** (hsl(146 52% 43%), brightened `-on` hsl(145 60% 62%) for the dark header): Protein dot, bar, and diagrammatic identity.
- **Carb Amber** (hsl(28 80% 52%), brightened `-on` hsl(34 95% 64%)): Carbohydrate identity.
- **Fat Blue** (hsl(199 70% 48%), brightened `-on` hsl(196 92% 68%)): Fat identity.

### Named Rules
**The One Indigo Rule.** Training Indigo fills at most one control per screen — the single primary action or the header. Every other button variant (`outline`, `ghost`, `destructiveOutline`) stays neutral or uses indigo as text only, never as a second fill competing with the primary action.

**The Macro Identity Rule.** Protein/carb/fat always render in their fixed green/amber/blue identity color for the dot and bar. Only the accompanying value text may re-tint for status (over/under goal); the identity color itself never changes meaning or gets reused for anything else.

**The Status-Token Rule.** Success, warning and error states are built from the `success` / `warning` / `destructive` tokens, never from a raw palette utility (`amber-50`, `emerald-600`, `red-100`). Audit test: a status surface whose class list contains a numbered Tailwind color is a bug, not a variant. Carb Amber and Warning Amber are different colors with different jobs — a warning never borrows the macro token, and a macro never borrows the status token.

**The Fill-Is-Not-Ink Rule.** `bg-success` / `bg-warning` paint dots, bars and tinted surfaces; status *text* uses `text-success-ink` / `text-warning-ink`. Audit test: `text-success` or `text-warning` on a light background is a contrast bug (~2.5:1) — the ink variants exist for exactly that position.

## Typography

**Body Font:** ui-sans-serif, system-ui, -apple-system, sans-serif (no custom typeface — the platform's native font, matching the native-app-instrument feel)

**Character:** Purely functional. No display size exists anywhere in the system — the largest text in the app is an 18px semibold screen title. Numerals default to tabular figures wherever a value updates or a list of amounts must align.

### Hierarchy
- **Title** (600, 1.125rem/18px, 1.75rem line-height): Screen/sub-screen name in the sticky header (`AppHeader`) — the only heading-weight text in the app. Its 28px line-height is load-bearing: it matches the back button's 36px tap target so the chevron centers on the title's first line.
- **Body** (400, 0.875rem/14px, 1.25rem line-height): Default control and copy size on desktop (`sm:text-sm`).
- **Body (mobile input)** (400, 1rem/16px, 1.5rem line-height): Text/decimal inputs on mobile. Load-bearing, not stylistic — anything smaller triggers iOS Safari's auto-zoom on focus.
- **Label** (500, 0.75rem/12px, 1rem line-height): Field labels' dense variant, hints, error text, bottom-nav labels, macro header captions.
- **Micro** (0.6875rem/11px, 1rem line-height): The floor of the type scale — a single size, no smaller variant. Two uses: **eyebrow** (600, uppercase, `tracking-wider` — section labels like "Pro Portion", "Tagesziel", source/status badges) and **caption** (400–500, sentence case — sparing secondary annotations like a day-picker's date-of-month, a photo-staging constraint hint, or a stat card's hint line). Reused across ~15 files (`per-portion-hero.tsx`, `recipe-detail.tsx`, `recipe-ingredient-editor.tsx`, `planner-screen.tsx`, `photo-staging.tsx`, and others).

### Named Rules
**The No-Display-Type Rule.** There is no hero/display type scale. The 18px header title is the ceiling; introducing anything larger breaks the instrument-not-billboard character.

**The Micro-Is-The-Floor Rule.** 11px is the smallest text the system uses — one size, not a shrinking ramp. Below `Label`, text is either an uppercase `tracking-wider` eyebrow or a sparing one-line caption; it is never a shrunk paragraph.

## Layout

Single-column, mobile-first layout that must never scroll horizontally (`overflow-x: clip` is a hard guard on `html, body` — see `.cursor/rules/no-horizontal-overflow-mobile.mdc`; `input, textarea, select { min-width: 0 }` is the matching guard on controls). A sticky `AppHeader` pins to the top; a 4-tab `BottomNav` pins to the bottom on mobile. Full-screen forms and pickers use a `BottomSheet` (portal-rendered, `82dvh` default height, drag handle) rather than a route change, keeping navigation context intact. Screen bodies are `p-4` with `space-y-4` between blocks; dense lists step down to `space-y-1`/`gap-2`. Image and thumbnail collections use a 2-column grid that becomes 3 at `sm` (640px) — the single defined breakpoint, beyond which only the `sm:text-sm` desktop density step applies.

## Elevation & Depth

Flat by default. Cards and containers are separated from their surroundings by a 1px `Lavender Border`, not a shadow — depth is not part of the resting visual language. Shadow appears only on elements floating above the page: the sticky header (`shadow-sm`, separating it from scrolled content) and the `BottomSheet` (`shadow-lg`, a drawer overlaying the app). Controls that sit *on top of an image* (photo reorder/remove buttons, the fullscreen photo viewer's chrome) are the one further exception: they use a translucent black scrim (`bg-black/60`, `hover:bg-black/75`) instead of a shadow, because the surface underneath is photographic and unpredictable. This is a confirmed, forward-going invariant, not just an observed default.

### Shadow Vocabulary
- **Header lift** (Tailwind `shadow-sm`): The sticky `AppHeader`, separating pinned chrome from scrolled content beneath it.
- **Popover lift** (Tailwind `shadow-sm`): Transient content anchored to a point rather than to the layout — the weight chart's value tooltip.
- **Overlay lift** (Tailwind `shadow-lg`): `BottomSheet` and the centered confirm dialog — content that covers the page.

That is the complete list. Three uses, two values; anything else in the app is flat.

### Named Rules
**The Flat-at-Rest Rule.** Surfaces are flat and bordered at rest. Shadow is reserved for things that are literally floating above the page (sticky header, popover, sheet, dialog) — never used to add weight to an ordinary card or button. A *selected* state is a fill and weight change, never a lift: the white-pill-with-shadow segmented control is a borrowed iOS idiom, not this system's. Audit test: if the element scrolls with the page, it has no shadow.

**The Scrim-Over-Photo Rule.** A control placed over user photography earns contrast from a translucent black scrim and white glyph, never from a shadow or a light chip. Photo content is unpredictable; the scrim is the only treatment guaranteed to stay legible.

## Shapes

Four rectangle steps, all smaller than the Tailwind default: `sm` (4px), `md` (6px), `lg` (8px, the root `--radius`), `xl` (12px). Each step has one job, assigned by what the element *is* — see the rule below. Fully round (`rounded-full`) is a separate, deliberate vocabulary reserved for things that are not rectangles at all: the sheet's drag handle, macro identity dots, macro fill bars, AI-estimate dots, and synonym chips. Borders are always 1px, `Lavender Border`. No clipping, skew, or non-rectangular silhouettes anywhere in the system.

Bare `rounded` is not part of the scale. Tailwind's default (4px) happens to equal `sm`, so the two spellings render identically and drift apart silently — write `rounded-sm`.

### Named Rules
**The Two-Radius Rule.** Interactive controls you act on directly — buttons, inputs, segmented-control options, icon buttons — use `md` (6px). Containers that hold content — cards, list shells, media frames, the icon plate that fronts a list row — use `lg` (8px). Overlays that float above the page use `xl` (12px): the bottom sheet on its leading edge, a centered confirm dialog on all four corners. Micro-elements below control size — badges, source chips, skeleton bars, native checkboxes — use `sm` (4px). Content always reads a shade softer than the controls that manipulate it.

Audit test: a `rounded-xl` outside an overlay, a `rounded-lg` on something you click, or a bare `rounded` anywhere is a bug.

**The Pill-Means-Not-A-Box Rule.** `rounded-full` marks an element that is a token, a dot or a track — a chip, a status dot, a progress bar, a drag handle. A rectangular control (button, input, card) never becomes a pill.

## Components

Every component reads **precise and unhurried**: motion limited to the informational vocabulary in Overview, tight but tap-safe sizing (targets built from padding + line-height, not fixed heights, except icon buttons), and nothing decorative.

### Buttons
- **Shape:** `rounded-md` (6px).
- **Primary:** Training Indigo fill, white text, `px-4 py-2 text-sm` (md) or `px-3 py-1 text-xs` (sm); hover darkens to 90% opacity.
- **Outline:** Paper White fill, `Lavender Border` stroke, ink text; hover fills `Soft Lavender`. Sits next to a primary action (cancel, alternate path).
- **Destructive / Destructive Outline:** Alert Red fill+white text (committing a delete) vs. Alert Red text+border only (opening a delete confirmation) — the outline variant stays deliberately quieter than the filled one.
- **Ghost:** Training Indigo text only, no fill or border — inline link-like actions inside dense lists/cards.
- **Quiet / Quiet Destructive:** icon actions that must not compete with their row. Neutral `Ink Muted` at rest; on hover `quiet` fills `Soft Lavender` and darkens to ink, `quietDestructive` fills `Alert Red`/10 and turns red. Every reorder, close, remove and dismiss control in the app is one of these two.
- **On Dark:** `white/90` with a `white/10` hover fill — chrome on the indigo header, the planner header, the date nav and the fullscreen photo viewer.
- **Accent:** a Bright-Periwinkle-tinted plate (`accent/10`, hover `accent/20`) with a Training Indigo glyph — the repeating "add to this slot" affordance on the diary and planner. Louder than `quiet`, deliberately quieter than `primary`: a screen carries four to six of them at once, so it must never read as the screen's primary action (The One Indigo Rule).
- **Scrim:** `bg-black/60` with white glyph, hover `black/75` — controls over user photography (The Scrim-Over-Photo Rule).
- **Sizes:** `md` (`px-4 py-2`), `sm` (`px-3 py-1`), `icon` (40px square), `iconSm` (36px square, the tap-target floor for dense rows).
- **Focus:** 2px Bright Periwinkle outline at 1px offset via `:focus-visible`, matching the input focus ring.
- **Disabled:** `opacity-50` plus `pointer-events-none` — the control stays in place and legible rather than disappearing.

A hand-written `inline-flex h-9 w-9 items-center justify-center …` string is a bug: it is `<Button variant="quiet" size="iconSm">`.

### Icons
- **Library:** lucide-react only, imported per icon. A Unicode glyph (`✕`, `↑`, `‹`, `→`) is never an icon; it renders at a different weight in every font stack and carries no consistent stroke.
- **Sizes:** 22px (header back chevron), 20px (bottom-nav tabs), 16px / `h-4 w-4` (inline and overlay controls), 14px / `h-3.5 w-3.5` (chip affordances).
- **Semantics:** always `aria-hidden="true"`; the surrounding button carries the `aria-label`. An icon-only control without a label is a bug.

### Touch Targets
- **44px+** for controls inside a full-screen overlay, where nothing else competes for the space (photo viewer close and paging).
- **40px** (`h-10 w-10`) for icon buttons and any control overlaid on a photo thumbnail.
- **36px** (`h-9 w-9`, often with `-my-1` so the row doesn't grow) is the floor for dense list and header rows.
- Anything smaller must not be the only way to perform an action.

### Cards / Containers
- **Corner Style:** `rounded-lg` (8px).
- **Background:** Lavender Surface.
- **Shadow Strategy:** None — see Elevation & Depth; a 1px border does the separation.
- **Border:** 1px, `Lavender Border`.
- **Internal Padding:** `p-4` (16px) default, `p-3` (12px) dense variant, or `none` when children own their own edges (divided lists, sticky rows).

### Inputs / Fields
- **Style:** `rounded-md` (6px), 1px `Lavender Border` stroke, Paper White background, in `md` (`px-3 py-2`) or `sm` (`px-2 py-1`). `min-width: 0` is forced globally so fields never overflow narrow flex/grid containers.
- **Select:** the same base as the text input, kept on the native `<select>` — the platform picker is faster to operate on a phone than any custom listbox, which is the whole point of this app. It forwards a ref so React Hook Form can register it.
- **Focus:** 2px Bright Periwinkle outline, 1px offset (not a border-color shift or glow) — applied uniformly via `:focus-visible` on `input`/`textarea`/`select`.
- **Numeric fields:** Right-aligned, tabular numerals (`DecimalInput` accepts both `,` and `.` as decimal separator, reformats to locale on blur, and never rejects a half-typed value while the field is focused).
- **Labels:** A `Field` wrapper wires label ↔ control ↔ hint/error via generated ids and `aria-describedby`/`aria-invalid` automatically.
- **Error:** Label text and message render in Alert Red; the message carries `role="alert"`.

### Segmented Control
- **Style:** Flex row of equal-width label-wrapped native radios (not buttons) so arrow-key group navigation is free. Unselected: `Lavender Border` outline. Selected: Training Indigo border + 10%-opacity Training Indigo fill + medium weight text.
- **Use:** Picking exactly one of a handful of mutually exclusive, always-visible options. Beyond phone-width option counts, the system falls back to `<select>` instead of wrapping this component.

### Status Banners
- **Style:** `rounded-md`, 1px status border at 50% opacity, status fill at 10% opacity, `p-3 text-sm` (`density="md"`) or `p-2 text-xs` (`density="sm"`, for dense surfaces like the photo grid). Three tones: `error` (destructive border/fill/text), `warning` (warning border/fill, ink body so long copy stays readable), `success` (success border/fill, `success-ink` text).
- **Announcement:** the `error` tone announces as `role="alert"`, the other two as `role="status"` — a confirmation must not interrupt a screen reader mid-sentence.
- **Anatomy:** a message naming what happened; an optional `hint` one step quieter saying what to do about it (its presence promotes the message to medium weight); an optional `action` slot for the recovery control, which belongs in the banner rather than elsewhere on the screen.
- **Dismissal:** only banners the user can safely ignore (staged-file rejections) pass `onDismiss`; failures that block the task stay until the state changes.
- **Scope:** this is the surface for *messages*. A work queue with interactive rows (the unmatched-ingredients panel) or a confirm container with its own buttons (the recipe delete zone) borrows the token colors but is not a Banner.

### Navigation (Bottom Nav)
- **Style:** Fixed 4-column grid, Paper White background, 1px top border. Icon (lucide, 20px) above a 12px label. Active tab: `Ink` text + `aria-current="page"`; inactive: `Ink Muted`. No pill/indicator background on the active state — color and weight alone carry it.

### Loading & Motion
- **Skeletons:** `Soft Lavender` blocks at the height of the content they stand in for (`h-8`, `h-10`, `h-12`), `rounded-md`, `animate-pulse`. Used for lists and forms whose shape is known before the data arrives.
- **Spinner:** lucide `Loader2` at 16px with `animate-spin`, inside the button that triggered the work, next to a label that names the wait ("Rezept wird gelesen…"). Never a full-screen or standalone spinner.
- **Sheet height:** `transition-[height] duration-200` on the `BottomSheet` only.
- **Bars:** `transition-all` on macro goal fills, so a changed value slides rather than jumps.
- **Reduced motion:** a global `prefers-reduced-motion: reduce` block collapses every animation, transition and smooth scroll to 0.01ms. Motion is therefore never the only carrier of meaning.

### Bottom Sheet (signature component)
- **Style:** Portal-rendered to `<body>`, fixed to the viewport bottom, `rounded-t-xl` (12px) top corners only, `shadow-lg`, backdrop `bg-black/40`. A centered `h-1 w-10` `Soft Lavender` drag handle signals draggability even where drag isn't implemented. Default height `82dvh`; content-sized sheets pass a `max-h-…` override instead. Used for every full-screen form/picker/search flow in place of a route change.

### Header Macro Cells (signature component)
- **Style:** Three columns inside the indigo header gradient, each: a macro-identity dot (6px) + label in `white/70`, a tabular-numeral value in `white/90` (or a status color when over/under goal), and an optional macro-identity-colored fill bar (`white/20` track) showing 0–100% of goal. This is the one place the macro-identity colors get their brightened `-on` variants, for legibility on the dark gradient.

### Photo Staging (signature component)
- **Style:** 2-column (3 at `sm`) grid of square `object-cover` thumbnails in `rounded-md` bordered tiles. A position number sits top-left in a black scrim chip; reorder and remove controls sit bottom-right as three 40px scrim buttons with white 16px lucide icons. A `text-xs` count-and-size line and an 11px constraint caption ("JPEG, PNG oder WebP · max. 5 MB pro Foto") sit above the grid; rejections appear in a dismissible error banner between them.
- **Failure state:** a thumbnail whose preview cannot render falls back to a `Soft Lavender` tile with an `ImageOff` icon and an 11px caption — the tile never collapses or shows a broken-image glyph.

## Do's and Don'ts

### Do:
- **Do** keep Training Indigo to one fill per screen (the primary action or the header) — see The One Indigo Rule.
- **Do** use the fixed macro green/amber/blue for protein/carb/fat identity everywhere they appear, never reassigned.
- **Do** build every status surface from the `success` / `warning` / `destructive` tokens at low opacity with a matching border, and set status text in the `-ink` sibling.
- **Do** use `text-base` (16px) for any text input rendered on mobile — smaller sizes trigger iOS Safari's zoom-on-focus.
- **Do** route full-screen forms/pickers through `BottomSheet` rather than a new route, keeping the header/nav context in place.
- **Do** keep numeric values tabular (`tabular-nums`) wherever a figure updates or several must align in a column.
- **Do** draw icons from lucide-react, mark them `aria-hidden`, and label the control that holds them.
- **Do** give a control over a photo a 40px target and a black scrim; give overlay chrome 44px.
- **Do** pair an error message with what to do next, and put the recovery control inside the banner.
- **Do** pick the radius from what the element is — control `md`, container `lg`, overlay `xl`, micro-element `sm` — and never write bare `rounded`.
- **Do** reach for the primitive before the class string: `Button` (with `quiet` / `quietDestructive` / `onDark` / `scrim` / `accent` and `icon` / `iconSm`), `Banner`, `Select`, `Input`, `Field`, `Card`, `SegmentedControl`. If none fits, add a variant there rather than a one-off at the call site.

### Don't:
- **Don't** add a shadow to an element that isn't literally floating above the page (ordinary cards and buttons stay flat with a border).
- **Don't** introduce a display/hero type size — 18px semibold is the ceiling.
- **Don't** fill a second control with Training Indigo on the same screen as the primary action; use `outline` or `ghost` instead.
- **Don't** reuse a macro-identity color (protein/carb/fat) for anything other than that macro.
- **Don't** reach for a numbered Tailwind color (`amber-50`, `emerald-600`) for a status surface — the tokens exist, and the app has no remaining call site that does this.
- **Don't** set status text in the saturated fill token (`text-success`, `text-warning`); that pairing fails contrast on every light surface in the app.
- **Don't** stand a Unicode glyph in for an icon — no `✕`, `↑`, `‹`, `→` anywhere in a control. The app is glyph-free as of this revision; the only remaining Unicode operator is the `×` between a piece count and its per-piece weight, which is arithmetic, not an icon.
- **Don't** add motion outside the sanctioned vocabulary (skeleton pulse, action spinner, sheet height, bar fill) — no entrances, slides, fades or parallax.
- **Don't** show a raw server or fetch message to the user; map it to a German sentence that names the problem and the recovery.
- **Don't** hand-roll an icon button (`inline-flex h-9 w-9 items-center justify-center …`) or a status surface (`rounded-md border border-warning/50 bg-warning/10 p-3 …`) — both are primitives now, and hand-rolled copies are how the 36/40/44px sizes drifted apart in the first place.
