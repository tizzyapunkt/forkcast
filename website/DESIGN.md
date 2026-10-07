---
name: forkcast website
description: The public landing page for forkcast. Calm, plain, the real app at the centre.
colors:
  brand: "hsl(244 36% 44%)"
  brand-strong: "hsl(244 38% 36%)"
  brand-soft: "hsl(244 60% 96%)"
  brand-line: "hsl(244 30% 86%)"
  ink: "hsl(244 20% 14%)"
  ink-2: "hsl(244 10% 34%)"
  ink-3: "hsl(244 8% 44%)"
  ground: "hsl(0 0% 100%)"
  ground-2: "hsl(244 40% 98%)"
  line: "hsl(244 16% 90%)"
  selection: "hsl(244 60% 86%)"
  frame: "hsl(244 18% 16%)"
  on-brand: "hsl(0 0% 100%)"
  error: "hsl(0 66% 44%)"
  macro-p: "hsl(146 52% 38%)"
  macro-c: "hsl(28 80% 46%)"
  macro-f: "hsl(199 70% 42%)"
  terminal-ground: "hsl(244 24% 11%)"
  terminal-ink: "hsl(244 30% 92%)"
  terminal-prompt: "hsl(249 72% 76%)"
  terminal-comment: "hsl(244 14% 62%)"
  brand-dark: "hsl(249 72% 72%)"
  brand-strong-dark: "hsl(249 80% 80%)"
  brand-soft-dark: "hsl(244 30% 18%)"
  brand-line-dark: "hsl(244 22% 30%)"
  ink-dark: "hsl(244 30% 95%)"
  ink-2-dark: "hsl(244 14% 76%)"
  ink-3-dark: "hsl(244 10% 66%)"
  ground-dark: "hsl(244 24% 9%)"
  ground-2-dark: "hsl(244 22% 12%)"
  line-dark: "hsl(244 16% 22%)"
  selection-dark: "hsl(244 40% 32%)"
  frame-dark: "hsl(244 14% 4%)"
  on-brand-dark: "hsl(244 40% 10%)"
  error-dark: "hsl(0 80% 72%)"
  macro-p-dark: "hsl(145 60% 62%)"
  macro-c-dark: "hsl(34 95% 64%)"
  macro-f-dark: "hsl(196 92% 68%)"
typography:
  # Fluid steps (literal clamps in styles.css)
  display: # hero h1 only
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2.4rem, 1.4rem + 3.6vw, 4rem)"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline: # section-head h2, prose h2, closing h2
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.9rem, 1.3rem + 2vw, 2.8rem)"
    fontWeight: 720
    lineHeight: 1.12
    letterSpacing: "-0.022em"
  title: # step h3
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.022em"
  lede: # hero .lede
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.06rem, 1rem + 0.3vw, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.6
  # Fixed steps (--fs-* custom properties on :root)
  subtitle: # --fs-subtitle: wordmark, build-column h3
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.12
  large: # --fs-large: section intros, prose, step copy, closing copy, feature terms (680), FAQ summaries (650)
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  body: # --fs-body: body base text
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  label: # --fs-label: button, choice titles, interest legend, e-mail input
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.35
  small: # --fs-small: nav, form note and status, macro legend, data flows, stack line, terminal, screenshot placeholder, footer
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  caption: # --fs-caption: screenshot captions, language pill, choice hints, spreadsheet table and figcaption
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  mono: # code, pre (relative to context)
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.88em"
    lineHeight: 1.75
rounded:
  inline: "6px" # inline code, focus ring, checkbox
  control: "14px"
  browser: "12px"
  terminal: "16px"
  pill: "999px"
  device: "16% / 7.4%"
  device-screen: "13% / 6%"
spacing:
  gutter: "20px"
  max: "1120px"
  section: "112px"
  section-head: "56px"
  steps: "96px"
  steps-mobile: "72px"
  columns: "64px"
  hero-top: "56px"
  hero-bottom: "88px"
  control-gap: "10px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
    textColor: "{colors.on-brand}"
  choice:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px 12px 42px"
  choice-checked:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.ink}"
  input-email:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "48px"
  device-frame:
    backgroundColor: "{colors.frame}"
    rounded: "{rounded.device}"
    padding: "3.2%"
    width: "280px"
  browser-frame:
    backgroundColor: "{colors.ground-2}"
    rounded: "{rounded.browser}"
  terminal:
    backgroundColor: "{colors.terminal-ground}"
    textColor: "{colors.terminal-ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.terminal}"
    padding: "22px 24px"
  lang-pill:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: forkcast website

## Overview

**Creative North Star: "The App on the Table"**

A calm, honest product page in the Things tradition: the real app, in real device frames, does the persuading, and the copy stays plain. The world is white and near-white lilac-tinted ground, one brand colour, the platform's own sans, generous whitespace, and large rounded device frames lifted by soft shadows. Structure comes from whitespace, alternating section tints and hairline rules, never from cards.

The system is independent of the app's design system in `frontend/`. The only shared commitment is the brand lilac (`244 36% 44%`), which PRODUCT.md binds for both. Dark mode is a first-class redefinition of the same tokens on a deep indigo-tinted ground, switched by `prefers-color-scheme`, not a toggle.

Everything reads without JavaScript. Script only adds the scrolled-header hairline, a labelled placeholder for missing screenshots, and interest-check validation messages.

**Key Characteristics:**
- One brand colour (lilac) on actions, links, focus and the one accent word in the headline.
- System sans throughout; hierarchy by weight (650 to 750) and tight negative tracking, not by a second face.
- Real app screenshots in drawn device and browser frames are the only imagery.
- Sections alternate plain ground and a faint lilac tint; content is divided by 1px rules, not boxes.
- Exactly one authored motion: the hero devices settle in once on load.

## Colors

A near-monochrome lilac-tinted neutral scale carrying a single saturated brand lilac, with three macro colours held back for app context.

### Primary
- **forkcast Lilac** (`brand`): the binding brand colour. Primary button fill, link colour, focus outline, checked choice border and box, feature-list icon stroke, input caret, and the one highlighted word in the hero headline. In dark mode it lifts to a lighter, more saturated lilac (`brand-dark`) so it holds contrast on indigo.
- **Deep Lilac** (`brand-strong`): hover state for buttons and links.
- **Lilac Wash** (`brand-soft`): fill of a checked interest-check choice.
- **Lilac Hairline** (`brand-line`): hover border of an unchecked choice.

### Tertiary
- **Macro Green / Amber / Blue** (`macro-p`, `macro-c`, `macro-f`): protein, carbs, fat. They are the app's identity colours and appear on the page only inside app screenshots and in the single macro legend beside the week-plan step.

### Neutral
- **Ink** (`ink`): headings, strong labels, input text.
- **Ink Soft** (`ink-2`): body copy in sections, ledes, nav links, list detail.
- **Ink Muted** (`ink-3`): captions, form notes, placeholders, unchecked checkbox stroke, FAQ toggle icon, footer text.
- **Paper** (`ground`): page ground, control fill.
- **Lilac Paper** (`ground-2`): tinted section ground, hero gradient end, table header, inline code, screenshot placeholder.
- **Selection** (`selection`): the `::selection` highlight behind Ink text; a mid lilac in light mode, a deep lilac in dark mode.
- **Rule** (`line`): every hairline: header on scroll, control borders, feature and flow rows, FAQ dividers, footer top.
- **Frame** (`frame`): device bezel; near-black indigo, darker still in dark mode.
- **On Lilac** (`on-brand`): text and checkmark on lilac. White in light mode, deep indigo in dark mode because the dark lilac is light.
- **Error** (`error`): form error text and the spreadsheet `#REF!` cell.
- **Terminal Ink on Night** (`terminal-ground`, `terminal-ink`, `terminal-prompt`, `terminal-comment`): the shell block, dark in both schemes; prompts in lilac, comments muted.

### Named Rules
**The One Lilac Rule.** Lilac is the only colour that signals action or emphasis. No second accent, no gradient fills on controls.

**The Macro Quarantine Rule.** Green, amber and blue belong to the app. They appear in app imagery and the one macro legend, never as page decoration or UI state.

**The Paired Scheme Rule.** Every colour token has a dark-mode counterpart defined in the same `prefers-color-scheme: dark` block. A new token without a dark value is incomplete; the terminal colours are the one deliberate exception, dark in both schemes.

## Typography

**Display Font:** System sans (`-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`)
**Body Font:** the same stack
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for code and the terminal

**Character:** One family, chosen per the direction contract for UI-like clarity, zero font payload and the Things-site register. The page should feel continuous with the native app screenshots it shows.

### Hierarchy
Four fluid steps for headings and the lede; six fixed steps as `--fs-*` custom properties. Every font size in the stylesheet is one of these.
- **Display** (750, fluid 2.4 to 4rem, 1.12, -0.035em): the hero headline only, balanced wrapping, one word in lilac.
- **Headline** (720, fluid 1.9 to 2.8rem, 1.12, -0.022em): section titles and the closing question.
- **Title** (700, fluid 1.5 to 2rem): step titles.
- **Lede** (400, fluid 1.06 to 1.2rem, 1.6): hero subcopy, capped at 34em, in Ink Soft.
- **Subtitle** (700, 1.25rem): the wordmark (-0.03em) and build-column titles.
- **Large** (400, 1.125rem, 1.6): section intros, prose paragraphs, step copy and closing copy in Ink Soft; also feature terms (680) and FAQ summaries (650).
- **Body** (400, 17px, 1.6): base text; pretty wrapping; prose capped at 40rem.
- **Label** (650, 16px, 1.35): button text, choice titles, the interest legend; the e-mail input uses it at regular weight.
- **Small** (400, 14px): nav links, form note and status (550), macro legend, data-flow rows, stack line, terminal (1.75), screenshot placeholder, footer.
- **Caption** (400, 13px, Ink Muted): screenshot captions, choice hints (1.4), the language pill (600, 0.02em), spreadsheet table and figure caption.
- **Mono** (0.88em of context): inline code and the terminal.

### Named Rules
**The Weight-Not-Face Rule.** Hierarchy comes from weight steps between 650 and 750 and negative tracking on headings. Do not add a second typeface for display.

**The Measure Rule.** Running text never exceeds 40rem (prose) or 34em (ledes); step copy stops at 30em.

## Layout

A single centred column of `max` (1120px) plus `gutter` (20px) each side. Sections are full-bleed bands with `section` (112px) vertical padding; section intros sit above content with `section-head` (56px) below them.

**Section rhythm.** After the hero, sections strictly alternate plain ground and Lilac Paper tint (origin plain, how-it-works tint, capture plain, features tint, built plain, self-host tint, FAQ plain, closing tint). The hero carries its own vertical gradient from Paper to Lilac Paper so the first band hands off softly.

**Grids.** Two-column, equal-fraction grids with `columns` (64px) gaps: hero (48px gap), origin (1.1fr / 0.9fr), step rows, self-host. Step rows alternate text side on even rows. The features list and the build section are two-column definition grids with 1px top rules per row. The wide plan step stacks copy above a browser frame with a small phone overlapping at its bottom edge.

**Breakpoints.** 900px: hero, origin and self-host stack to one column; the tilted devices and sheet straighten. 760px: steps, features, build columns stack; section nav links hide; the browser frame is removed because a desktop shot is unreadable at that width. 480px: choices, e-mail row and button go full width.

## Elevation & Depth

Flat surfaces, with depth reserved for the app itself. Device and browser frames sit on one soft, long, offset shadow (`--shadow-device`, deeper in dark mode); the terminal and the primary button carry smaller soft drops. Nothing else casts a shadow. The sticky header uses an 88% ground mix with backdrop blur and gains a hairline only after scroll. The only gradient is the hero ground, a vertical Paper to Lilac Paper fade (`linear-gradient(180deg, ground 0%, ground-2 100%)`); tonal bands do the rest.

### Shadow Vocabulary
- **Device lift** (`0 30px 60px -20px hsl(240 10% 10% / 0.28), 0 12px 24px -12px hsl(240 10% 10% / 0.18)`; dark: `0 30px 60px -20px hsl(0 0% 0% / 0.6), 0 12px 24px -12px hsl(0 0% 0% / 0.5)`): phone and browser frames only.
- **Terminal drop** (`0 18px 40px -24px hsl(240 10% 10% / 0.45)`): the shell block.
- **Button press** (`0 6px 14px -8px hsl(240 10% 10% / 0.35)`): primary button.

### Named Rules
**The Lift-the-App Rule.** Shadows belong to the things that are the product (devices, browser, terminal) and its one action. Text, lists and sections never float.

## Shapes

Generous, soft corners. Controls share one radius (`control`, 14px). Device frames use elliptical radii proportional to the frame (`16% / 7.4%` outer, `13% / 6%` screen) so they scale like a phone at any width. Browser frames 12px, terminal 16px, inline code, the focus ring and the drawn checkbox 6px (`inline`), the language switch a full pill. Borders are 1px hairlines on structure and 1.5px on controls. Two pieces carry a slight tilt on desktop (back device -4deg, spreadsheet 1.2deg), straightened on narrow screens.

## Components

### Buttons
Confident and single.
- **Shape:** gently rounded (14px), 48px tall.
- **Primary:** Lilac fill, On Lilac text, 650 weight, 22px side padding, soft drop.
- **Hover / Focus / Active:** fill darkens to Deep Lilac over 0.15s; global 2px lilac focus outline at 3px offset; 1px press-down on active.
- **Busy:** `aria-disabled="true"` drops to 60% opacity with a progress cursor.
- There is one button style. Secondary actions are plain lilac links.

### Interest-check choices
Large, tappable checkbox cards (the only bordered boxes on the page, because they are controls).
- **Style:** Paper fill, 1.5px Rule border, 14px radius; a drawn 18px checkbox (6px radius) at left, title in Label and a muted Caption hint below.
- **States:** hover tints the border to Lilac Hairline; checked turns the border Lilac, fill Lilac Wash, the box solid Lilac and scales in a drawn checkmark (0.15s); keyboard focus gets a 2px lilac outline at 2px offset. The native input stays in place, transparent, covering the card.
- **Layout:** two equal columns, 10px gap; one column under 480px.

### Inputs / Fields
- **Style:** e-mail field 48px tall, Paper fill, 1.5px Rule border, 14px radius, Label-size text, Ink Muted placeholder, lilac caret. Visible label is the placeholder; a visually-hidden label carries the name.
- **Focus:** border and a 2px Lilac outline at 1px offset.
- **Status line:** a polite live region under the form; empty is hidden; error tone in Error, sent tone in Lilac.

### Navigation
- Sticky 64px header: wordmark (favicon plus lowercase "forkcast", Subtitle at 700, -0.03em), section links in Ink Soft at Small turning Ink on hover, a GitHub link with its mark, and a bordered pill language switch (Caption, 600). Section links hide under 760px.

### Device frame (signature)
A drawn phone: Frame-coloured bezel at 3.2% padding, elliptical radii, Device lift shadow, holding a 390:844 screenshot cropped from the top. 280px default; in the hero a front phone (week plan) overlaps a smaller tilted back phone (grocery list), captioned beneath. Missing rasters are replaced by a labelled Lilac Paper placeholder, never a broken image.

### Browser frame
A 12px-rounded, shadow-lifted 16:10 crop of the desktop app, paired with a small phone (22% width) at its lower edge. Hidden under 760px.

### Rule lists
Features, data flows and FAQ are lists separated by 1px Rule top borders, no fills. Feature terms (Large, 680) carry a 22px lilac line icon (1.75 stroke); FAQ summaries end in a muted plus that rotates 45deg when open (0.2s).

### Terminal
Dark shell block in both schemes: Night ground, 16px radius, mono at Small (14px) with 1.75 line height, lilac non-selectable prompts, muted comments.

### Hero settle (motion)
The one authored motion. On load, hero devices rise 28px and un-blur from 6px over 0.9s (`cubic-bezier(0.16, 1, 0.3, 1)`), the back phone 0.12s later. It runs only under `prefers-reduced-motion: no-preference`; content is visible by default. Smooth anchor scrolling is likewise disabled for reduced motion. All other motion is 0.15 to 0.2s ease-out state transitions.

## Do's and Don'ts

### Do:
- **Do** use the brand lilac (`244 36% 44%`) for every action, link and focus state, and its dark counterpart in dark mode.
- **Do** define every new colour in both the light `:root` and the `prefers-color-scheme: dark` block.
- **Do** show the product through real screenshots in the device or browser frame, with a plain caption about what is shown.
- **Do** alternate plain and tinted section bands and divide content with 1px rules.
- **Do** keep controls at 48px tall with the shared 14px radius.
- **Do** gate any new motion behind `prefers-reduced-motion: no-preference` with content visible by default.

### Don't:
- **Don't** use cards or filled boxes as section structure; the interest-check choices are the only bordered boxes because they are controls.
- **Don't** put icons in tinted tiles; line icons sit inline beside their term.
- **Don't** use macro green, amber or blue outside app imagery and the macro legend.
- **Don't** add a second typeface or a webfont.
- **Don't** add a second authored animation beside the hero settle.
- **Don't** share tokens or components with the app's design system in `frontend/`; only the lilac value is common.
