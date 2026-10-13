# Design

## Context

See proposal.md for the motivation. Current state:

- **README** (76 lines):
  - The Problem, Core Idea and Context sections, in the third person.
  - Six architecture subsections.
  - Data, with the German UI path "Einstellungen → Katalog verwalten".
  - AI recipe import, as a long paragraph of env vars.
  - Self-hosting (good, keep it), then License.
  - No screenshot, no demo link, no link to the website.
- **Model default:** `app-config.ts` sets `DEFAULT_MODEL = 'claude-sonnet-4-6'`; `backend/.env.example` sets `ANTHROPIC_MODEL=claude-haiku-4-5`.
- **GitHub:** the description reads "The meal planner and calorie tracker that finally rules them all." The homepage is empty.
- **Website try-now band** (`<aside class="try-now" id="try">`, EN and DE): a heading, the line "Run it on your own server now. The README on GitHub has the setup." and one `.button` to `…#self-hosting`. The header's "Try it" / "Ausprobieren" nav link jumps to `#try`.
- **Website buttons:** `website/DESIGN.md` (Components → Buttons) says "There is one button style. Secondary actions are plain lilac links." `.button` in `website/src/styles.css`:
  - Lilac fill, 48px tall, 14px radius, soft drop shadow.
  - Full width under 480px.
- **Screenshots:** `website/public/screenshots/en/week-plan.webp` exists, and GitHub renders `.webp` in Markdown.

## Goals / Non-Goals

**Goals:**

- A Show HN visitor reaches the demo in one click from the README, the website and the GitHub sidebar.
- The README reads like the website's author: first person, plain, short. It stays accurate to the code.

**Non-Goals:**

- Story copy changes on the website beyond the try-now band and the hero demo link (Decision 5).
- New screenshots. The existing ones are current.
- An architecture document. `AGENTS.md` already is one.

## Decisions

### 1. The README outline

1. **Title and lead.** `# forkcast`, then one sentence in the website's voice ("My take on meal planning and calorie tracking: plan the week ahead against your calorie and macro goals, then cook and shop from it."). Below it, a line of links: **[Try the demo](https://check-forkcast.tizzy.dev/demo/)** · [Why I built it](https://check-forkcast.tizzy.dev) · [Self-host it](#self-hosting).
2. **The week-plan screenshot.** It is referenced by its repo path, `website/public/screenshots/en/week-plan.webp`, at a fixed width so it doesn't fill a desktop screen.
3. **What it does.** Seven or eight bullets, one line each:
   - week planning against calorie and macro goals;
   - recipes that cook into ingredients;
   - the grocery list, with Bring! export;
   - cooking-session swaps;
   - barcode scan and Open Food Facts search;
   - the weight trend and goal calculator;
   - optional AI: photo recipe import, packaging capture, ingredient matching;
   - English and German.
4. **The demo.** Two sentences: it runs entirely in the browser, the data stays there, and what is turned off.
5. **Self-hosting.** It stays as it is, with the catalog path in English. It gains the AI env vars that leave the old AI paragraph, as one line pointing to `backend/.env.example`.
6. **How it's built.** One short paragraph:
   - stack: Hono and React;
   - a hexagonal backend persisting through JSON files;
   - spec-driven with OpenSpec (`openspec/specs/`).

   It ends with a link to `AGENTS.md` for the conventions.
7. **Development.** `pnpm install`, `pnpm dev`, `make check`, and a pointer to `backend/.env.example`.
8. **License.** Unchanged.

*Alternatives:* keeping the architecture sections, or moving them to `docs/`. Both were rejected: `AGENTS.md` holds them in more detail, and a second copy drifts.

### 2. Model default: `.env.example` documents it instead of overriding it

The `ANTHROPIC_MODEL=claude-haiku-4-5` line becomes:

```
# ANTHROPIC_MODEL=claude-sonnet-4-6 (default)
```

That's a comment saying what you get when the line is left out. The code default stays, because Sonnet is what the README and the AI features were tuned for. Nobody's running server changes: the file is only an example, and existing `.env` files keep whatever they set.

### 3. The try-now band: a primary and a secondary button

- **Copy.**
  - EN: "Try the demo in your browser, nothing to install. Or run it on your own server." The buttons are **Try the demo** (primary, `/demo/`) and **Self-host it** (secondary, `https://github.com/tizzyapunkt/forkcast#self-hosting`).
  - DE: "Probier die Demo im Browser aus, ohne Installation. Oder betreib es auf deinem eigenen Server." The buttons are **Demo ausprobieren** and **Selbst hosten**.
- **The secondary style.** A new `.button--secondary`: transparent fill, a 1.5px Lilac border, Lilac text, no shadow. Hover tints the fill to Lilac Wash and the border to Deep Lilac. It keeps the same height, radius, weight and focus. In dark mode the existing tokens carry it.
- **Layout.** The two buttons sit in a `.try-now-actions` row with a 12px gap, primary first. Under 480px both go full width and stack, primary on top.
- **The design rule.** "There is one button style. Secondary actions are plain lilac links" becomes: "One primary style. The try-now band is the one place with a secondary button (outline), because its two actions are equal choices. Elsewhere, secondary actions stay plain lilac links." The change is recorded with `/impeccable document target website` (merge), which also regenerates the sidecar.
- **The workflow.** Per `AGENTS.md`, a small visual change on the website goes through Impeccable directly. Build it, then run `/impeccable critique` on the band in both colour schemes and at phone width.

*Alternative:* a plain lilac link for "Self-host it", which the current rule would have. Rejected: the user asked for a secondary button, and two equal paths read better as a pair.

### 4. GitHub description and homepage

- **Proposed description:** "My take on meal planning and calorie tracking: plan the week against your macros, cook and shop from it. Self-hosted PWA, try the demo in your browser."
- **Homepage:** `https://check-forkcast.tizzy.dev`.

Both are applied with `gh repo edit` only after the user confirms the exact text. This is a public change.

### 5. Hero demo link and PRODUCT.md, from the critique

The band critique found two problems:

- **[P1] On phones, the demo can't be reached from the first screen.** The section nav hides under 760px, and the hero had no demo path.
- **[P2] `website/PRODUCT.md` still described a waitlist with nothing to try.**

The user chose to fix both here:

- **The hero link.** A plain lilac `.hero-demo` link under the hero lede: "Or try the demo in your browser" / "Oder probier die Demo im Browser aus". It follows the existing rule that secondary actions are plain links, and the interest check stays the hero's action.
- **PRODUCT.md.** The Launch Channel (now a Show HN), principle 1, the capabilities (the demo) and one stale evidence note are updated.

The user also approved the band copy as written.

## Risks / Trade-offs

- [The README screenshot path points into `website/public/`, so a renamed screenshot breaks it] → It's a relative path in the same repo. A broken image shows up in the PR preview.
- [The secondary button weakens the "one button style" discipline] → It's limited to the try-now band and recorded in DESIGN.md as the single exception.
- [Commenting out `ANTHROPIC_MODEL` in the example switches new installs from Haiku to Sonnet, at a higher cost per import] → That's the documented default. The comment names the variable, so changing it is one line.
