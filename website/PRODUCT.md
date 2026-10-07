# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML plus a little vanilla JS, built by Vite+ as a multi-page app (EN at `/`, DE at `/de/`). No framework, no React, independent of the app's design system in `frontend/src/components/ui/`. Umami analytics is injected at build time only when `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` are set.

## Users

Two audiences, weighted equally — the interest check exists to learn which one is bigger:

- **People who track calories and macros** and are frustrated that apps like fddb, yazio or MyFitnessPal are built around daily logging, with weekly planning bolted on. Typically short on time, with concrete nutrition goals.
- **Self-hosters and developers** who would rather run forkcast on their own infrastructure than use a hosted service.

The site is bilingual: English and German carry the same content. English leads.

## Launch Channel

The page may be shared on Hacker News as a regular submission, not as a Show HN: it is a waitlist, not something people can try. Expect a technical, sceptical audience that distrusts marketing language, tracking, mandatory sign-ups and unbacked claims, and asks about stack, architecture and where data goes. Expect a traffic spike: the page must stay fast and static.

## Product Purpose

The public landing page for forkcast. It explains what the app does and runs an interest check: does the visitor want a hosted version, or to self-host? The interest check runs entirely through Tally: every submission records the hosted / self-host choice (one or both). The landing page never asks for an e-mail; an address for the waitlist is an optional field the visitor fills in on the Tally form itself. Umami only measures who visits (page views, referrers), never the interest check itself. Success means a clear signal of which offering people want, and a list of people to contact once it exists.

## Origin

forkcast was deliberately not built as a product. It started as a tool for exactly one person, the author, to solve their own weekly planning problem, with a product kept only as a distant option. Before forkcast, the author tried weekly planning in an Excel sheet; it worked on paper but was not ergonomic enough to keep up every week, which is why a dedicated tool exists at all. It has since grown to the point where other people might want to use it too, and the website exists to find out whether they do. The site tells this story as it happened: a personal tool opening up, not a startup launch.

## Positioning

forkcast is planning-first: the week is the primary unit, and ad-hoc daily tracking is the secondary, flexible path. Competing trackers take the opposite emphasis. It exists because planning a week of meals has to stay fast enough to actually happen every week.

## Capabilities and Constraints

What the app really does today (the site may describe only this):

- Weekly meal planning against user-defined calorie and macro goals (no fixed diet template)
- Recipe and ingredient management, with an editable food catalog
- Grocery list generated from the plan
- Packaged foods via Open Food Facts: search includes Open Food Facts branded products (toggle in the search panel), and barcode scans look products up there. When a barcode is missing from Open Food Facts, the product can be captured from packaging photos via AI and is stored locally. Open Food Facts data is ODbL-licensed, so the site credits it.
- Recipe import from photos (printed page, screenshot, recipe card) via AI, reviewed by the user before saving
- Installable, offline-capable PWA, mobile-first with full desktop support

Constraints:

- A hosted version does not exist yet. The app currently runs as a single-user, self-hosted setup.
- No pricing, launch dates, user counts or availability promises.

Open decisions:

- Tracked in `website/OPEN-ITEMS.md` (waitlist service, legal pages, license, domain, e-mail retention, screenshots).

## Brand Commitments

- Name is fixed: **forkcast**, always lowercase.
- Primary brand color is fixed: light purple/lilac, `244 36% 44%` (HSL, `--primary` in `frontend/src/components/ui/tokens.css`). Binding for the website as well as the app.
- No logo or other visual assets yet.
- Visual direction is the category standard, played straight: a familiar product landing page executed at full craft, no novelty world. The bar is the craft level of Cultured Code's Things site (culturedcode.com): friendly, uncluttered, the app at the centre. Standing preference for every website surface.

## Evidence on Hand

- Public source repository: https://github.com/tizzyapunkt/forkcast
- Real screenshots of the running app may be used. The app ships English and German (#69); the EN page shows English screenshots, the DE page German ones, both from seeded demo data (`scripts/demo/`).
- `docker-compose.yml` at the repo root runs prebuilt backend and frontend images. The root README's "no containerization" line is outdated.
- None of the following exist and must not be fabricated: testimonials, user counts, press, benchmarks, pricing, launch dates.

## Product Principles

1. **Honest about being early.** Say plainly that hosted is not available yet; the waitlist is the offer.
2. **Time is the pitch.** The value is that planning a week takes minutes, so the site should be just as quick to understand.
3. **Two audiences, one story.** Neither hosted nor self-hosted is the default path until the interest check says so.
4. **Same truth in both languages.** EN and DE make identical claims.
5. **Plain and checkable.** No marketing superlatives. Every claim can be verified in the repo, data flows are named and kept apart by where they happen — the app (photo import and packaging capture send images to the Anthropic API; product search and barcode lookups query Open Food Facts) versus this website (cookieless Umami analytics for visits; the interest check and waitlist via Tally) — and nothing is required to read the page: no JS, no cookies, no e-mail.
