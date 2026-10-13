# Proposal

## Why

The README and the website tell different stories. The website is first person, honest and a little self-deprecating ("my take on…"); the README is third person, heavy on architecture, and the GitHub description claims forkcast "finally rules them all". The README also drifts from the code (the default AI model, a German-only UI path) and misses features the website shows. A Show HN visitor lands on one and checks the other, so they need to agree, and both need to lead to the demo.

## What Changes

- The README gets lean and takes the website's voice: one line plus a week-plan screenshot, links to the demo and to the website's story, a short "What it does" list (week planning against calorie and macro goals, recipes cooked as ingredients, grocery list with Bring! export, cooking-session swaps, barcode scan and Open Food Facts, weight trend and goal calculator, EN/DE), then self-hosting, optional AI, development and license.
- The long architecture section leaves the README. A short "How it's built" paragraph remains (stack, hexagonal backend, JSON files, spec-driven with OpenSpec) and links to `AGENTS.md`, which already holds the details.
- Drift fixed:
  - The model default: the code defaults to `claude-sonnet-4-6` and the README says "a current Claude Sonnet", but `backend/.env.example` pins `ANTHROPIC_MODEL=claude-haiku-4-5`, so anyone copying it silently gets Haiku. The example will show the default, commented out.
  - The catalog path in the README ("Einstellungen → Katalog verwalten") becomes the English UI path, Settings → Manage catalog.
  - The multi-arch note was already fixed by `multi-arch-images`.
- The website's try-now band ("Want to give it a try?") gets two buttons, in EN and DE:
  - primary "Try the demo", linking to `/demo/`;
  - secondary "Self-host it", linking to the repository's self-hosting section.

  Its one line of copy changes to match. The website's DESIGN.md rule "one button style; secondary actions are plain lilac links" changes to allow this one secondary button, recorded with `/impeccable document`.
- The GitHub repository description and homepage URL are aligned with the website (a public change, applied by the author or after explicit confirmation).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. README, website copy and repository metadata carry no spec-level behavior; the change opts out of specs (`skip_specs: true` in `.openspec.yaml`).

## Impact

- `README.md`, `backend/.env.example`, `website/index.html`, `website/de/index.html`, `website/src/styles.css`, `website/DESIGN.md` and its sidecar `website/.impeccable/design.json`.
- GitHub repository settings (description, homepage).
- `browser-demo` and `off-snapshot` are deployed, so the demo link works.
