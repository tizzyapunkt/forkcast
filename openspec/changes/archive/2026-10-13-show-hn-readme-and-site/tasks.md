# Tasks

## 1. README and drift

- [x] 1.1 Rewrite `README.md` to the outline in design Decision 1, in the website's first-person voice:
  - lead line, links and the week-plan screenshot;
  - "What it does", the demo, Self-hosting (catalog path in English, AI settings as one pointer to `backend/.env.example`), "How it's built", Development, License.

  Verify:
  - the screenshot and every relative link resolve (check the file paths exist, and render with `gh markdown-preview` or the PR's rich diff);
  - no German UI path is left;
  - every feature named exists in the app.
- [x] 1.2 In `backend/.env.example`, replace `ANTHROPIC_MODEL=claude-haiku-4-5` with the commented default (Decision 2). Verify it matches `DEFAULT_MODEL` in `backend/src/config/app-config.ts`, and that the README states the same default

## 2. Website try-now band

- [x] 2.1 Add `.button--secondary` and `.try-now-actions` to `website/src/styles.css` (Decision 3), and update the try-now band in `website/index.html` and `website/de/index.html`: new copy, primary "Try the demo" / "Demo ausprobieren" to `/demo/`, secondary "Self-host it" / "Selbst hosten" to the self-hosting section. Verify `make website-build` passes, and in the preview check:
  - both languages;
  - light and dark scheme;
  - desktop and 390px width, where the buttons stack full width with primary on top;
  - the hover and focus states;
  - the Impeccable hook reports nothing.
- [x] 2.2 Run `/impeccable critique` on the try-now band and fix what it finds. Verify the critique has no open material findings
- [x] 2.3 Run `/impeccable document target website` (merge) so `website/DESIGN.md` gets the new button rule and the sidecar regenerates. Verify:
  - the Buttons section names the try-now exception;
  - the try-now band paragraph mentions both buttons;
  - `/impeccable doctor` reports no website drift.

## 3. Repository metadata

- [x] 3.1 Show the user the proposed GitHub description and homepage (Decision 4), and apply them with `gh repo edit` only after they confirm. Verify with `gh repo view --json description,homepageUrl`

## 4. Integration check

- [x] 4.1 Run `make check` and verify it passes

## Workflow follow-up

- Archive after review. There is no spec delta (`skip_specs: true`).
