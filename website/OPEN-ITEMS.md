# Website open items

Decisions and inputs the landing page needs before it goes public (and before any Hacker News submission). Nothing here may be invented while building; tick an item once it is decided and recorded in `PRODUCT.md` or the page.

## Before building can finish

- [ ] **Tally:** verify free-plan limits, where submission data is stored, that one form can carry the hosted / self-host choice (both selectable) plus an optional e-mail, how it embeds (inline, popup or own form posting to it), and whether the "Made with Tally" branding on the free plan is acceptable.
- [ ] **E-mail retention:** decide what happens to waitlist addresses (e.g. one launch e-mail, then deleted). The page states it, so it has to be true.
- [ ] **English app screenshots:** blocked on the `add-english-locale` change (`openspec/changes/add-english-locale/`). Until then the page uses labelled screenshot placeholders.

## Before going public

- [ ] **Impressum:** provider details for a public site operated from Germany.
- [ ] **Datenschutzerklärung / privacy policy:** covering the website only, i.e. Umami (cookieless analytics) and Tally (waitlist form).
- [ ] **License:** add a LICENSE file to the repo; `package.json` carries the default `ISC` but there is no license text, so the project is not formally open source yet.
- [ ] **Domain** and **hosting** for the website.
- [ ] **Umami account:** the Cloud Hobby plan allows 1 website and tizzy.dev already uses it. Check the Umami terms on a second free account; otherwise share the tizzy.dev website ID (filter by hostname), go Pro ($20/month) or self-host.
- [ ] **Umami config:** set `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` for the production build (`website/.env.example`).

- [ ] **Self-host path for strangers:** `docker-compose.yml` pulls `${DOCKERHUB_USERNAME}/forkcast-*` images. Decide whether those images are public or document a local build, then write deployment docs. Until then the page only shows the local `pnpm dev` path.

## App polish seen in the screenshots

Found while capturing the demo screenshots (`scripts/demo/`). Fixing these makes the next screenshot round better:

- [ ] Weight card shows `80.8 kg` and `-0.76 %/Wo.` with dots in the German UI (should be `80,8` / `-0,76`).
- [ ] Logged recipes in the daily log always show every ingredient, so a phone screenshot ends after the first few ingredients. There is no way to collapse them.
- [ ] Grocery list counts broccoli florets: `700 g · ≈ 24 Stück`.
- [ ] Every grocery item starts ticked.
- [ ] Open Food Facts results show raw names (`SKYR`, `skyr`) and a bare `OFF` badge; the "neu anlegen" card is more prominent than the results.
- [ ] Desktop planner has no max width, so the phone layout stretches across 1440 px.
- [ ] After the Open Food Facts and desktop fixes, recapture `food-search.webp` and `week-plan-desktop.webp`. The finish review flagged both as showing the feature in its weakest state.
- [ ] Planner day labels wrap (`5.` / `Oktober`), and the per-day kcal bar stays indigo even when over goal.

## Nice to fix alongside

- [ ] **Root README:** the "no containerization" line is outdated since `docker-compose.yml` exists; the self-host section on the page will link to it.
