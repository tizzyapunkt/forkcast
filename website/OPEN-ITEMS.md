# Website open items

Decisions and inputs the landing page needs before it goes public (and before any Hacker News submission). Nothing here may be invented while building; tick an item once it is decided and recorded in `PRODUCT.md` or the page.

## Before building can finish

- [x] **Tally:** two forms, `vGQVl4` (EN) and `Me9lW8` (DE), set in `.env.production`. Each takes the page's `hosted` and `selfhost` as hidden fields and counts the choice with one button; the e-mail is an optional question on the form only, never sent from the page. Free plan: no hard limits under the fair use policy; data is stored in the EU (Tally is based in Belgium, DPA available). Both forms are published and tested end to end (EN: `hosted` only; DE: both choices plus an e-mail typed on the form).
- [ ] **"Made with Tally" badge:** shown on the free plan (removing it needs Tally Pro, $29/month). Decide whether that is acceptable.
- [x] **E-mail retention:** one message when there is something to try, then deleted. Stated on the page and in both forms; both also say the choice counts without an e-mail.
- [x] **English app screenshots:** captured after #69 into `public/screenshots/en/` with `scripts/demo/` (`LOCALE=en`).

## Before going public

- [ ] **Impressum:** provider details for a public site operated from Germany.
- [ ] **Datenschutzerklärung / privacy policy:** covering the website only, i.e. GitHub Pages (hosting, receives visitors' IP addresses), Umami (cookieless analytics) and Tally (interest check and optional e-mail).
- [ ] **License:** add a LICENSE file to the repo; `package.json` carries the default `ISC` but there is no license text, so the project is not formally open source yet.
- [x] **Domain:** `check-forkcast.tizzy.dev`.
- [x] **Hosting:** GitHub Pages, deployed by `.github/workflows/website.yml` on pushes to `main` that touch `website/`.
- [ ] **Pages setup:** repo Settings → Pages → Source "GitHub Actions" and custom domain `check-forkcast.tizzy.dev`; DNS `check-forkcast CNAME tizzyapunkt.github.io`; verify `tizzy.dev` under the account's Pages settings; tick "Enforce HTTPS" once the certificate is issued.
- [x] **Umami account:** the Cloud Hobby plan allows 1 website and tizzy.dev already uses it. Check the Umami terms on a second free account; otherwise share the tizzy.dev website ID (filter by hostname), go Pro ($20/month) or self-host.
- [x] **Umami config:** `website/.env.production` sets the Umami Cloud script, the website ID and `UMAMI_DOMAINS=check-forkcast.tizzy.dev`, so only the live host is counted.

- [ ] **Self-host path for strangers:** `docker-compose.yml` pulls `${DOCKERHUB_USERNAME}/forkcast-*` images. Decide whether those images are public or document a local build, then write deployment docs. Until then the page only shows the local `pnpm dev` path.

## App polish seen in the screenshots

Found while capturing the demo screenshots (`scripts/demo/`). Fixing these makes the next screenshot round better:

- [x] Weight card shows `80.8 kg` and `-0.76 %/Wo.` with dots in the German UI (should be `80,8` / `-0,76`).
- [x] Logged recipes in the daily log always show every ingredient, so a phone screenshot ends after the first few ingredients. There is no way to collapse them.
- [x] Grocery list counts broccoli florets: `700 g · ≈ 24 Stück`.
- [x] Every grocery item starts ticked.
- [x] Open Food Facts results show raw names (`SKYR`, `skyr`) and a bare `OFF` badge; the "neu anlegen" card is more prominent than the results.
- [x] Desktop planner has no max width, so the phone layout stretches across 1440 px.
- [x] After the Open Food Facts and desktop fixes, recapture `food-search.webp` and `week-plan-desktop.webp`. The finish review flagged both as showing the feature in its weakest state.
- [x] English planner shows German-style dates: `5.–11. October` in the week header and `5.` / `October` under each day (should be `5–11 October` / `5 Oct`). Visible in the EN screenshots.
- [x] Planner day labels wrap (`5.` / `Oktober`), and the per-day kcal bar stays indigo even when over goal.

## Nice to fix alongside

- [ ] **Root README:** the "no containerization" line is outdated since `docker-compose.yml` exists; the self-host section on the page will link to it.
